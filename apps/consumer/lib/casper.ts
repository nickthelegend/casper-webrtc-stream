/**
 * Consumer-side rail + signer.
 *
 * The consumer only builds + signs payment payloads (it never calls the
 * facilitator), so no API key is needed here. Signing is REAL:
 *   - DEMO: ed25519 via WebCrypto using NEXT_PUBLIC_CONSUMER_PRIVATE_KEY
 *           (a hot key in the browser — demo only, clearly insecure).
 *   - PROD: replace with CSPR.click via createBrowserSigner().
 */
import type {
  PaymentRail,
  SignFn,
  TokenMeta,
} from "@nickthelegend69/webrtc-payment-sdk-core";
import {
  CasperX402Rail,
  createBrowserSigner,
  makeEd25519SignFn,
  type CasperNetwork,
} from "@nickthelegend69/webrtc-payment-rail-x402";

const NETWORK = (process.env.NEXT_PUBLIC_CASPER_NETWORK as CasperNetwork) ?? "casper:casper-test";
const ASSET = process.env.NEXT_PUBLIC_CEP18_TOKEN_CONTRACT ?? "";
const FACILITATOR =
  process.env.NEXT_PUBLIC_X402_FACILITATOR_URL ?? "https://x402-facilitator.cspr.cloud";

const TOKEN: TokenMeta = {
  name: process.env.NEXT_PUBLIC_CEP18_TOKEN_NAME ?? "Cep18x402",
  version: process.env.NEXT_PUBLIC_CEP18_TOKEN_VERSION ?? "1",
  decimals: process.env.NEXT_PUBLIC_CEP18_TOKEN_DECIMALS,
  symbol: process.env.NEXT_PUBLIC_CEP18_TOKEN_SYMBOL,
};

export function isConfigured(): boolean {
  return Boolean(ASSET && process.env.NEXT_PUBLIC_CONSUMER_ACCOUNT_HASH);
}

export function hasDemoKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CONSUMER_PRIVATE_KEY);
}

export interface ConsumerRailBundle {
  rail: PaymentRail;
  signFn: SignFn;
  walletAddress: string;
  publicKeyHex: string;
}

export function createConsumerRail(): ConsumerRailBundle {
  const walletAddress = process.env.NEXT_PUBLIC_CONSUMER_ACCOUNT_HASH ?? "";
  const publicKeyHex = process.env.NEXT_PUBLIC_CONSUMER_PUBLIC_KEY ?? "";
  const seed = process.env.NEXT_PUBLIC_CONSUMER_PRIVATE_KEY;

  const signFn: SignFn = seed ? makeEd25519SignFn(seed) : createBrowserSigner();

  const rail = new CasperX402Rail({
    facilitatorUrl: FACILITATOR,
    network: NETWORK,
    tokenContractHash: ASSET,
    token: TOKEN,
    consumerAccountHash: walletAddress,
    consumerPublicKeyHex: publicKeyHex,
  });

  return { rail, signFn, walletAddress, publicKeyHex };
}
