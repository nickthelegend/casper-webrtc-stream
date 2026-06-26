/**
 * Provider-side rail (browser).
 *
 * SECURITY: the CSPR.cloud API key must never reach the browser. So the
 * provider uses a ProxyRail: it builds PaymentRequirements locally (no secret)
 * but routes verify()/settle() through this app's own /api/verify and
 * /api/settle routes, which hold the key server-side and call the facilitator.
 */
import type {
  BuildRequirementsOpts,
  PaymentPayload,
  PaymentRail,
  PaymentRequirements,
  SettleResult,
  TokenMeta,
  VerifyResult,
} from "@nickthelegend69/webrtc-payment-sdk-core";

const NETWORK = process.env.NEXT_PUBLIC_CASPER_NETWORK ?? "casper:casper-test";
const ASSET = process.env.NEXT_PUBLIC_CEP18_TOKEN_CONTRACT ?? "";
const PAYEE = process.env.NEXT_PUBLIC_PROVIDER_ACCOUNT_HASH ?? "";

const TOKEN: TokenMeta = {
  name: process.env.NEXT_PUBLIC_CEP18_TOKEN_NAME ?? "Cep18x402",
  version: process.env.NEXT_PUBLIC_CEP18_TOKEN_VERSION ?? "1",
  decimals: process.env.NEXT_PUBLIC_CEP18_TOKEN_DECIMALS,
  symbol: process.env.NEXT_PUBLIC_CEP18_TOKEN_SYMBOL,
};

function randomHex32(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

class ProxyRail implements PaymentRail {
  buildRequirements(opts: BuildRequirementsOpts): PaymentRequirements {
    return {
      network: NETWORK,
      scheme: "exact",
      asset: ASSET,
      amount: opts.amount,
      payTo: PAYEE,
      description:
        opts.segmentIndex !== undefined
          ? `Stream segment ${opts.segmentIndex}`
          : "Stream session access",
      sessionId: opts.sessionId,
      segmentIndex: opts.segmentIndex,
      nonce: randomHex32(),
      requiredDeadlineSeconds: 300,
      extra: TOKEN,
    };
  }

  async buildPayload(): Promise<PaymentPayload> {
    throw new Error("provider does not build payloads (consumer signs)");
  }

  async verify(payload: PaymentPayload): Promise<VerifyResult> {
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      return (await res.json()) as VerifyResult;
    } catch (err) {
      return { valid: false, error: (err as Error).message };
    }
  }

  async settle(payload: PaymentPayload): Promise<SettleResult> {
    const res = await fetch("/api/settle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload }),
    });
    const json = (await res.json()) as { txHash?: string; error?: string };
    if (!json.txHash) throw new Error(json.error ?? "settle failed");
    return { txHash: json.txHash };
  }
}

export function isConfigured(): boolean {
  return Boolean(ASSET && PAYEE);
}

export function createProviderRail(): PaymentRail {
  return new ProxyRail();
}
