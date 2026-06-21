//! OdraVM tests for Cep18X402.transfer_with_authorization.
//!
//! These sign a real EIP-712 digest with a secp256k1 key and submit it to the
//! contract, which independently rebuilds the digest and verifies the signature
//! on-chain — proving the authorize → verify → transfer path end to end, plus
//! replay / expiry / wrong-signer rejection. No network required.
use casper_eip_712::prelude::*;
use casper_eip_712::encoding::Address as Address712;
use k256::ecdsa::{signature::hazmat::PrehashSigner, SigningKey};
use odra::casper_types::{bytesrepr::Bytes, U256};
use odra::host::{Deployer, HostEnv};
use odra::prelude::{Address, Addressable};
use cep18_x402::cep18_x402::{
    address_to_casper_712, owner_proxy_address, u256_to_bytes32, Cep18X402, Cep18X402HostRef,
    Cep18X402InitArgs, TransferWithAuthorization, DOMAIN_CHAIN_NAME,
};

const TOKEN_NAME: &str = "Cep18x402";
const TOKEN_SYMBOL: &str = "CSPRX";
const TOKEN_DECIMALS: u8 = 2;
const INITIAL_SUPPLY: u64 = 1_000_000;
const DOMAIN_VERSION: &str = "1";

fn setup() -> (HostEnv, Cep18X402HostRef) {
    let env = odra_test::env();
    let token = Cep18X402::deploy(
        &env,
        Cep18X402InitArgs {
            name: TOKEN_NAME.into(),
            symbol: TOKEN_SYMBOL.into(),
            decimals: TOKEN_DECIMALS,
            initial_supply: INITIAL_SUPPLY.into(),
            domain_version: DOMAIN_VERSION.into(),
        },
    );
    (env, token)
}

fn test_keypair(seed: u8) -> (SigningKey, [u8; 20]) {
    let key = SigningKey::from_bytes((&[seed; 32]).into()).unwrap();
    let encoded = key.verifying_key().to_encoded_point(false);
    let hash = casper_eip_712::keccak::keccak256(&encoded.as_bytes()[1..]);
    let mut addr = [0u8; 20];
    addr.copy_from_slice(&hash[12..32]);
    (key, addr)
}

fn sign_digest(key: &SigningKey, digest: [u8; 32]) -> Vec<u8> {
    let (sig, recid) = key.sign_prehash(&digest).unwrap();
    let mut sig_bytes = vec![0u8; 65];
    sig_bytes[..64].copy_from_slice(&sig.to_bytes());
    sig_bytes[64] = recid.to_byte();
    sig_bytes
}

fn contract_bytes(addr: Address) -> [u8; 32] {
    match addr {
        Address::Contract(hash) => hash.value(),
        Address::Account(hash) => hash.value(),
    }
}

fn casper_domain(token: &Cep18X402HostRef) -> DomainSeparator {
    DomainBuilder::new()
        .name(TOKEN_NAME)
        .version(DOMAIN_VERSION)
        .custom_field("chain_name", DomainFieldValue::String(DOMAIN_CHAIN_NAME.into()))
        .custom_field(
            "contract_package_hash",
            DomainFieldValue::Bytes32(contract_bytes(token.address())),
        )
        .build()
}

fn build_message(
    owner_eth: [u8; 20],
    to: &Address,
    value: U256,
    valid_after: u64,
    valid_before: u64,
    nonce: [u8; 32],
) -> TransferWithAuthorization {
    TransferWithAuthorization {
        from: Address712::Eth(owner_eth),
        to: address_to_casper_712(to),
        value: u256_to_bytes32(value),
        valid_after: u256_to_bytes32(U256::from(valid_after)),
        valid_before: u256_to_bytes32(U256::from(valid_before)),
        nonce,
    }
}

#[test]
fn transfer_with_authorization_moves_tokens() {
    let (env, mut token) = setup();
    let (key, owner_eth) = test_keypair(0x11);
    let recipient = env.get_account(2);
    let owner_proxy = owner_proxy_address(owner_eth);
    token.mint_to(owner_proxy, U256::from(5_000u64));

    let value = U256::from(1_000u64);
    let nonce = [0x42u8; 32];
    let (valid_after, valid_before) = (0u64, u64::MAX);
    let digest = hash_typed_data(
        &casper_domain(&token),
        &build_message(owner_eth, &recipient, value, valid_after, valid_before, nonce),
    );
    let signature = sign_digest(&key, digest);

    token.transfer_with_authorization(
        Bytes::from(owner_eth.to_vec()),
        recipient,
        value,
        valid_after,
        valid_before,
        Bytes::from(nonce.to_vec()),
        Bytes::from(signature),
    );

    assert_eq!(token.balance_of(&recipient), value);
    assert_eq!(token.balance_of(&owner_proxy), U256::from(4_000u64));
    assert!(token.is_nonce_used(Bytes::from(nonce.to_vec())));
}

#[test]
fn replayed_nonce_reverts() {
    let (env, mut token) = setup();
    let (key, owner_eth) = test_keypair(0x22);
    let recipient = env.get_account(2);
    token.mint_to(owner_proxy_address(owner_eth), U256::from(5_000u64));

    let value = U256::from(100u64);
    let nonce = [0x07u8; 32];
    let digest = hash_typed_data(
        &casper_domain(&token),
        &build_message(owner_eth, &recipient, value, 0, u64::MAX, nonce),
    );
    let signature = sign_digest(&key, digest);

    token.transfer_with_authorization(
        Bytes::from(owner_eth.to_vec()),
        recipient,
        value,
        0,
        u64::MAX,
        Bytes::from(nonce.to_vec()),
        Bytes::from(signature.clone()),
    );
    // second submission of the same nonce must revert
    assert!(token
        .try_transfer_with_authorization(
            Bytes::from(owner_eth.to_vec()),
            recipient,
            value,
            0,
            u64::MAX,
            Bytes::from(nonce.to_vec()),
            Bytes::from(signature),
        )
        .is_err());
}

#[test]
fn wrong_signer_reverts() {
    let (env, mut token) = setup();
    let (_, claimed_owner) = test_keypair(0x11);
    let (wrong_key, _) = test_keypair(0x99);
    let recipient = env.get_account(2);
    token.mint_to(owner_proxy_address(claimed_owner), U256::from(5_000u64));

    let value = U256::from(100u64);
    let nonce = [0x08u8; 32];
    // sign the claimed owner's message with the WRONG key
    let digest = hash_typed_data(
        &casper_domain(&token),
        &build_message(claimed_owner, &recipient, value, 0, u64::MAX, nonce),
    );
    let signature = sign_digest(&wrong_key, digest);

    assert!(token
        .try_transfer_with_authorization(
            Bytes::from(claimed_owner.to_vec()),
            recipient,
            value,
            0,
            u64::MAX,
            Bytes::from(nonce.to_vec()),
            Bytes::from(signature),
        )
        .is_err());
}

#[test]
fn expired_authorization_reverts() {
    let (env, mut token) = setup();
    let (key, owner_eth) = test_keypair(0x33);
    let recipient = env.get_account(2);
    token.mint_to(owner_proxy_address(owner_eth), U256::from(5_000u64));

    let value = U256::from(100u64);
    let nonce = [0x09u8; 32];
    let (valid_after, valid_before) = (0u64, 0u64);
    let digest = hash_typed_data(
        &casper_domain(&token),
        &build_message(owner_eth, &recipient, value, valid_after, valid_before, nonce),
    );
    let signature = sign_digest(&key, digest);

    // push block time past valid_before (1000ms => 1s, > 0)
    env.advance_block_time(1000);

    assert!(token
        .try_transfer_with_authorization(
            Bytes::from(owner_eth.to_vec()),
            recipient,
            value,
            valid_after,
            valid_before,
            Bytes::from(nonce.to_vec()),
            Bytes::from(signature),
        )
        .is_err());
}
