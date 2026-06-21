//! `Cep18X402` — a CEP-18 token with an on-chain, EIP-712-authorized transfer.
//!
//! `transfer_with_authorization` lets a payer sign an off-chain EIP-712
//! `TransferWithAuthorization` and anyone (e.g. an x402 facilitator) submit it.
//! The contract reconstructs the digest, verifies the signature, enforces the
//! validity window, and rejects nonce replays before moving tokens.
//!
//! SCOPE / HONESTY: this verifies an EIP-712 signature with the official
//! `casper-eip-712` crate's **secp256k1** recovery path (the path that crate
//! ships + tests). It is OdraVM-tested below. The CSPR.cloud *hosted*
//! facilitator settles a **closed-source, ed25519-native** token
//! (`Cep18X402.wasm`); this contract is the project's own token demonstrating
//! the on-chain pattern, not a byte-drop-in for that hosted facilitator. See
//! ONCHAIN.md.
extern crate alloc;

use alloc::string::{String, ToString};
use alloc::vec::Vec;

use casper_eip_712::prelude::*;
use casper_eip_712::verify::recover_eth_address;
// The crate's EIP-712 address type, aliased so it doesn't clash with the Odra
// runtime `Address` (Account/Contract) used everywhere else.
use casper_eip_712::encoding::Address as Address712;
use odra::casper_types::{account::AccountHash, bytesrepr::Bytes, U256};
use odra::prelude::*;
use odra::prelude::Address;
use odra_modules::cep18_token::Cep18;

/// CAIP-2 chain name baked into the EIP-712 domain (shared with tests/clients).
pub const DOMAIN_CHAIN_NAME: &str = "casper:casper-test";

#[derive(PartialEq, Eq, Debug)]
#[odra::odra_error]
pub enum Error {
    AuthorizationNotYetValid = 40_000,
    AuthorizationExpired = 40_001,
    NonceAlreadyUsed = 40_002,
    MalformedSignature = 40_003,
    MalformedNonce = 40_004,
    InvalidSignature = 40_005,
    InvalidOwnerEthAddress = 40_006,
}

#[odra::module(errors = Error)]
pub struct Cep18X402 {
    token: SubModule<Cep18>,
    /// Replay protection: a 32-byte authorization nonce can be spent once.
    used_nonces: Mapping<Bytes, bool>,
    domain_name: Var<String>,
    domain_version: Var<String>,
}

#[odra::module]
impl Cep18X402 {
    pub fn init(
        &mut self,
        name: String,
        symbol: String,
        decimals: u8,
        initial_supply: U256,
        domain_version: String,
    ) {
        self.token.init(symbol, name.clone(), decimals, initial_supply);
        self.domain_name.set(name);
        self.domain_version.set(domain_version);
    }

    delegate! {
        to self.token {
            fn name(&self) -> String;
            fn symbol(&self) -> String;
            fn decimals(&self) -> u8;
            fn total_supply(&self) -> U256;
            fn balance_of(&self, address: &Address) -> U256;
            fn allowance(&self, owner: &Address, spender: &Address) -> U256;
            fn approve(&mut self, spender: &Address, amount: &U256);
            fn transfer(&mut self, recipient: &Address, amount: &U256);
            fn transfer_from(&mut self, owner: &Address, recipient: &Address, amount: &U256);
        }
    }

    /// Settle a signed transfer authorization. The signer authorizes moving
    /// `value` from its proxy account to `to`; the signature covers the full
    /// EIP-712 `TransferWithAuthorization` digest.
    pub fn transfer_with_authorization(
        &mut self,
        owner_eth_address: Bytes,
        to: Address,
        value: U256,
        valid_after: u64,
        valid_before: u64,
        nonce: Bytes,
        signature: Bytes,
    ) {
        let now = self.current_block_time_secs();
        if now < valid_after {
            self.env().revert(Error::AuthorizationNotYetValid);
        }
        if now > valid_before {
            self.env().revert(Error::AuthorizationExpired);
        }
        if owner_eth_address.len() != 20 {
            self.env().revert(Error::InvalidOwnerEthAddress);
        }
        if signature.len() != 65 {
            self.env().revert(Error::MalformedSignature);
        }
        if nonce.len() != 32 {
            self.env().revert(Error::MalformedNonce);
        }
        if self.used_nonces.get(&nonce).unwrap_or(false) {
            self.env().revert(Error::NonceAlreadyUsed);
        }

        let owner_eth = slice_to_20(&owner_eth_address)
            .unwrap_or_revert_with(self, Error::InvalidOwnerEthAddress);
        let nonce_arr = slice_to_32(&nonce).unwrap_or_revert_with(self, Error::MalformedNonce);

        let domain = self.build_casper_domain();
        let message = TransferWithAuthorization {
            from: Address712::Eth(owner_eth),
            to: address_to_casper_712(&to),
            value: u256_to_bytes32(value),
            valid_after: u256_to_bytes32(U256::from(valid_after)),
            valid_before: u256_to_bytes32(U256::from(valid_before)),
            nonce: nonce_arr,
        };
        let digest = hash_typed_data(&domain, &message);

        let sig_array: [u8; 65] = match signature.as_slice().try_into() {
            Ok(sig) => sig,
            Err(_) => self.env().revert(Error::MalformedSignature),
        };
        match recover_eth_address(digest, &sig_array) {
            Some(recovered) if recovered == owner_eth => {}
            _ => self.env().revert(Error::InvalidSignature),
        }

        self.used_nonces.set(&nonce, true);
        let owner = owner_proxy_address(owner_eth);
        self.token.raw_transfer(&owner, &to, &value);
    }

    pub fn is_nonce_used(&self, nonce: Bytes) -> bool {
        self.used_nonces.get(&nonce).unwrap_or(false)
    }

    pub fn owner_proxy(&self, owner_eth_address: Bytes) -> Address {
        owner_proxy_address(
            slice_to_20(&owner_eth_address)
                .unwrap_or_revert_with(self, Error::InvalidOwnerEthAddress),
        )
    }

    /// DEMO ONLY: unrestricted mint so tests/examples can fund a proxy account.
    pub fn mint_to(&mut self, recipient: Address, amount: U256) {
        self.token.raw_mint(&recipient, &amount);
    }
}

impl Cep18X402 {
    fn build_casper_domain(&self) -> DomainSeparator {
        let name = self.domain_name.get().unwrap_or_else(|| "Cep18x402".to_string());
        let version = self.domain_version.get().unwrap_or_else(|| "1".to_string());
        DomainBuilder::new()
            .name(&name)
            .version(&version)
            .custom_field("chain_name", DomainFieldValue::String(DOMAIN_CHAIN_NAME.into()))
            .custom_field(
                "contract_package_hash",
                DomainFieldValue::Bytes32(self.contract_package_hash_bytes()),
            )
            .build()
    }

    fn contract_package_hash_bytes(&self) -> [u8; 32] {
        match self.env().self_address() {
            Address::Contract(hash) => hash.value(),
            Address::Account(hash) => hash.value(),
        }
    }

    fn current_block_time_secs(&self) -> u64 {
        let millis: u64 = self.env().get_block_time().into();
        millis / 1000
    }
}

/// EIP-712 `TransferWithAuthorization` — field names + order must match the
/// facilitator/client typed-data exactly (they feed the typeHash).
pub struct TransferWithAuthorization {
    pub from: Address712,
    pub to: Address712,
    pub value: [u8; 32],
    pub valid_after: [u8; 32],
    pub valid_before: [u8; 32],
    pub nonce: [u8; 32],
}

impl Eip712Struct for TransferWithAuthorization {
    fn type_string() -> &'static str {
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    }

    fn encode_data(&self) -> Vec<u8> {
        let mut data = Vec::with_capacity(192);
        data.extend_from_slice(&encode_address(self.from));
        data.extend_from_slice(&encode_address(self.to));
        data.extend_from_slice(&encode_uint256(self.value));
        data.extend_from_slice(&encode_uint256(self.valid_after));
        data.extend_from_slice(&encode_uint256(self.valid_before));
        data.extend_from_slice(&encode_bytes32(self.nonce));
        data
    }
}

/// Map a 20-byte eth signer to a deterministic Casper proxy account that holds
/// its token balance (the eth address occupies the leading 20 bytes).
pub fn owner_proxy_address(owner_eth: [u8; 20]) -> Address {
    let mut bytes = [0u8; 32];
    bytes[..20].copy_from_slice(&owner_eth);
    Address::Account(AccountHash::new(bytes))
}

/// Encode an Odra Address as a 33-byte Casper address (`00`/`01` tag + 32-byte hash).
pub fn address_to_casper_712(addr: &Address) -> Address712 {
    let mut out = [0u8; 33];
    match addr {
        Address::Account(hash) => {
            out[0] = 0x00;
            out[1..].copy_from_slice(&hash.value());
        }
        Address::Contract(hash) => {
            out[0] = 0x01;
            out[1..].copy_from_slice(&hash.value());
        }
    }
    Address712::Casper(out)
}

pub fn u256_to_bytes32(value: U256) -> [u8; 32] {
    let mut bytes = [0u8; 32];
    value.to_big_endian(&mut bytes);
    bytes
}

fn slice_to_20(bytes: &[u8]) -> Option<[u8; 20]> {
    bytes.try_into().ok()
}

fn slice_to_32(bytes: &[u8]) -> Option<[u8; 32]> {
    bytes.try_into().ok()
}
