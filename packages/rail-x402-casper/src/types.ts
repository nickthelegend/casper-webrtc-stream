/**
 * Casper x402 rail config + facilitator wire types (real CSPR.cloud v2 API).
 */
import type { SignFn, TokenMeta } from "@nickthelegend/webrtc-payment-sdk-core";

export type CasperNetwork = "casper:casper" | "casper:casper-test";

export interface CasperX402RailConfig {
  /** CSPR.cloud facilitator base URL, e.g. https://x402-facilitator.cspr.cloud */
  facilitatorUrl: string;
  /** CSPR.cloud access token — sent as the `authorization` header (NOT Bearer). */
  facilitatorApiKey?: string;
  network: CasperNetwork;
  /** CEP-18 token contract PACKAGE hash, 64 hex chars (no prefix). */
  tokenContractHash: string;
  /** CEP-18 metadata used to build the EIP-712 domain + facilitator `extra`. */
  token: TokenMeta;
  /** Payee account hash (provider side). Accepts account-hash-/00/0x/raw. */
  providerAccountHash?: string;
  /** Payer account hash (consumer side). */
  consumerAccountHash?: string;
  /** Payer public key hex, algorithm-prefixed (01 ed25519 / 02 secp256k1). */
  consumerPublicKeyHex?: string;
  /** Payer ed25519 seed hex (32 bytes). DEMO/agent only — never in a browser. */
  consumerPrivateKeyHex?: string;
  /** Custom digest signer (e.g. CSPR.click). Receives the 32-byte digest hex,
   *  returns a 65-byte signature hex (algo-prefix + 64-byte sig). */
  signDigest?: SignFn;
  /** Max seconds the authorization stays valid (facilitator min 6). */
  maxTimeoutSeconds?: number;
  /** Resource URL embedded in the payload (informational). */
  resourceUrl?: string;
}

/** POST /verify response. */
export interface FacilitatorVerifyResponse {
  isValid: boolean;
  payer?: string;
  invalidReason?: string;
  invalidMessage?: string;
  extensions?: Record<string, unknown>;
}

/** POST /settle response (always HTTP 200; check `success`). */
export interface FacilitatorSettleResponse {
  success: boolean;
  transaction?: string;
  network?: string;
  payer?: string;
  errorReason?: string;
  errorMessage?: string;
}
