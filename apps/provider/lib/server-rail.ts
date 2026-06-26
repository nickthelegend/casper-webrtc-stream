/**
 * Server-side rail (API routes only). Holds the secret CSPR_CLOUD_API_KEY and
 * talks to the real facilitator. Never imported into client bundles.
 */
import type { PaymentRail, TokenMeta } from "@nickthelegend69/webrtc-payment-sdk-core";
import {
  CasperX402Rail,
  type CasperNetwork,
} from "@nickthelegend69/webrtc-payment-rail-x402";

export function createServerRail(): PaymentRail {
  const token: TokenMeta = {
    name: process.env.CEP18_TOKEN_NAME ?? "Cep18x402",
    version: process.env.CEP18_TOKEN_VERSION ?? "1",
    decimals: process.env.CEP18_TOKEN_DECIMALS,
    symbol: process.env.CEP18_TOKEN_SYMBOL,
  };
  return new CasperX402Rail({
    facilitatorUrl:
      process.env.X402_FACILITATOR_URL ?? "https://x402-facilitator.cspr.cloud",
    facilitatorApiKey: process.env.CSPR_CLOUD_API_KEY,
    network: (process.env.CASPER_NETWORK as CasperNetwork) ?? "casper:casper-test",
    tokenContractHash: process.env.CEP18_TOKEN_CONTRACT ?? "",
    token,
    providerAccountHash: process.env.PROVIDER_ACCOUNT_HASH,
  });
}

export function serverConfigured(): boolean {
  return Boolean(
    process.env.CSPR_CLOUD_API_KEY &&
      process.env.CEP18_TOKEN_CONTRACT &&
      process.env.PROVIDER_ACCOUNT_HASH,
  );
}
