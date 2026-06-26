/**
 * EIP-712 signing for the Casper x402 `exact` scheme.
 *
 * Uses the official @casper-ecosystem/casper-eip-712 package to build the
 * Casper-native domain + TransferWithAuthorization digest, then signs the
 * 32-byte digest with Ed25519 via WebCrypto.
 *
 * The typed-data here is matched byte-for-byte to the facilitator's verifier
 * (make-software/casper-x402 → js/.../exact/facilitator/scheme.ts): the primary
 * type is `TransferWithAuthorization`, the timestamp fields are camelCase, and
 * `from`/`to` are hashed in their "00"-tagged account-hash form ("0x00"+64hex).
 * Any drift from that produces a different digest and `invalid_signature`.
 */
import {
  hashTypedData,
  buildDomain,
  CASPER_DOMAIN_TYPES,
} from "@casper-ecosystem/casper-eip-712";
import { ed25519 } from "@noble/curves/ed25519";
import type { SignFn, TokenMeta } from "@nickthelegend/webrtc-payment-sdk-core";
import type { CasperNetwork } from "./types.js";
import { bareHash, bareNonce, bytesToHex, hexToBytes, tagged } from "./casperFormat.js";

/**
 * Typed-data definition for the CEP-18 `transfer_with_authorization` entry
 * point. MUST stay identical to the facilitator's `transferWithAuthorizationTypes`
 * (field names + order + primary type name all feed the EIP-712 typeHash).
 */
const transferWithAuthorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

export interface TransferDigestInput {
  network: CasperNetwork;
  tokenContractHash: string;
  token: TokenMeta;
  from: string;
  to: string;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: string;
}

/** Build the 32-byte EIP-712 digest for a TransferWithAuthorization. */
export function buildTransferDigest(i: TransferDigestInput): Uint8Array {
  // Domain's contract_package_hash is the bare 32-byte package hash ("0x"+64hex),
  // NOT account-tagged — contract package hashes carry no key tag.
  const domain = buildDomain(
    i.token.name,
    i.token.version,
    i.network,
    "0x" + bareHash(i.tokenContractHash),
  );
  // from/to are the 33-byte "00"-tagged account hashes ("0x00"+64hex), exactly
  // as the facilitator reconstructs them (`"0x" + authorization.from`).
  const message = {
    from: "0x" + tagged(i.from),
    to: "0x" + tagged(i.to),
    value: BigInt(i.value),
    validAfter: BigInt(i.validAfter),
    validBefore: BigInt(i.validBefore),
    nonce: "0x" + bareNonce(i.nonce),
  };
  const digest = hashTypedData(
    domain,
    transferWithAuthorizationTypes,
    "TransferWithAuthorization",
    message,
    { domainTypes: CASPER_DOMAIN_TYPES },
  );
  return typeof digest === "string" ? hexToBytes(digest) : (digest as Uint8Array);
}

/**
 * Sign a digest with an Ed25519 seed; returns "01" + 64-byte sig (65 bytes).
 * Uses @noble/curves (pure JS) rather than WebCrypto's `Ed25519`, which isn't
 * available in every browser — and signs deterministically (RFC 8032), so the
 * output is identical to a WebCrypto signature for the same key + message.
 */
export async function signEd25519(
  digest: Uint8Array,
  seedHex: string,
): Promise<string> {
  const seed = hexToBytes(seedHex);
  if (seed.length !== 32) throw new Error("ed25519 seed must be 32 bytes");
  const sig = ed25519.sign(digest, seed);
  return "01" + bytesToHex(sig);
}

/**
 * Build a SignFn from a raw ed25519 seed. The SignFn receives the 32-byte
 * digest hex and returns the 65-byte signature hex. DEMO/agent use only.
 */
export function makeEd25519SignFn(seedHex: string): SignFn {
  return (digestHex: string) => signEd25519(hexToBytes(digestHex), seedHex);
}

/**
 * Production browser signing does NOT use this digest-based SignFn path.
 * CSPR.click's `signTypedData` takes the structured typed data (not a pre-hashed
 * digest) and signs the raw EIP-712 digest internally — so the browser path
 * builds the whole payload via `signX402PaymentWithCsprClick()` in
 * apps/consumer/lib/csprclick-signer.ts, not through buildPayload(signFn).
 *
 * This stub stays as a guard: if something tries to use a browser SignFn for the
 * digest, fail loudly rather than ship a wrong signature.
 */
export function createBrowserSigner(): (digestHex: string) => Promise<string> {
  return async () => {
    throw new Error(
      "Don't sign the raw digest in the browser. Use signX402PaymentWithCsprClick() " +
        "(CSPR.click signTypedData) for production, or supply consumerPrivateKeyHex for the demo.",
    );
  };
}
