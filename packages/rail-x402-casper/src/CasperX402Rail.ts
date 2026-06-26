/**
 * CasperX402Rail — real PaymentRail against the CSPR.cloud x402 facilitator.
 *
 *   Provider: buildRequirements() → verify() → settle()
 *   Consumer: buildPayload()  (real EIP-712 TransferAuthorization signature)
 *
 * No demo short-circuits. verify()/settle() hit the live facilitator; if it's
 * not configured (no API key / token), they fail honestly. See STATUS.md for
 * what is verified vs. unverified.
 */
import type {
  BuildRequirementsOpts,
  PaymentPayload,
  PaymentRail,
  PaymentRequirements,
  SettleResult,
  SignFn,
  VerifyResult,
} from "@nickthelegend69/webrtc-payment-sdk-core";
import { FacilitatorClient } from "./FacilitatorClient.js";
import { buildPaymentPayload, buildWireRequirements } from "./PayloadBuilder.js";
import { bytesToHex } from "./casperFormat.js";
import type { CasperX402RailConfig } from "./types.js";

function randomNonce(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return bytesToHex(b);
}

export class CasperX402Rail implements PaymentRail {
  private facilitator: FacilitatorClient;
  private maxTimeoutSeconds: number;

  constructor(private config: CasperX402RailConfig) {
    this.facilitator = new FacilitatorClient(
      config.facilitatorUrl,
      config.facilitatorApiKey,
    );
    this.maxTimeoutSeconds = Math.max(6, config.maxTimeoutSeconds ?? 300);
  }

  buildRequirements(opts: BuildRequirementsOpts): PaymentRequirements {
    if (!this.config.providerAccountHash) {
      throw new Error("providerAccountHash required to build requirements");
    }
    return {
      network: this.config.network,
      scheme: "exact",
      asset: this.config.tokenContractHash,
      amount: opts.amount,
      payTo: this.config.providerAccountHash,
      description:
        opts.segmentIndex !== undefined
          ? `Stream segment ${opts.segmentIndex}`
          : "Stream session access",
      sessionId: opts.sessionId,
      segmentIndex: opts.segmentIndex,
      nonce: randomNonce(),
      requiredDeadlineSeconds: this.maxTimeoutSeconds,
      extra: this.config.token,
    };
  }

  async buildPayload(
    requirements: PaymentRequirements,
    signFn?: SignFn,
  ): Promise<PaymentPayload> {
    const from = this.config.consumerAccountHash;
    if (!from) throw new Error("consumerAccountHash required to build payload");
    const publicKeyHex = this.config.consumerPublicKeyHex;
    if (!publicKeyHex) {
      throw new Error("consumerPublicKeyHex required to build payload");
    }
    return buildPaymentPayload({
      requirements,
      network: this.config.network,
      tokenContractHash: this.config.tokenContractHash,
      token: this.config.token,
      from,
      publicKeyHex,
      maxTimeoutSeconds: this.maxTimeoutSeconds,
      resourceUrl: this.config.resourceUrl ?? `x402://${requirements.sessionId}`,
      signDigest: signFn ?? this.config.signDigest,
      privateKeyHex: this.config.consumerPrivateKeyHex,
    });
  }

  async verify(payload: PaymentPayload): Promise<VerifyResult> {
    const req = payload.paymentRequirements;
    if (!req) return { valid: false, error: "payload missing paymentRequirements" };
    try {
      const wire = buildWireRequirements(req, this.config.token, this.maxTimeoutSeconds);
      const res = await this.facilitator.verify(payload, wire);
      return {
        valid: res.isValid,
        error: res.isValid ? undefined : res.invalidMessage ?? res.invalidReason,
      };
    } catch (err) {
      return { valid: false, error: (err as Error).message };
    }
  }

  async settle(payload: PaymentPayload): Promise<SettleResult> {
    const req = payload.paymentRequirements;
    if (!req) throw new Error("payload missing paymentRequirements");
    const wire = buildWireRequirements(req, this.config.token, this.maxTimeoutSeconds);
    const res = await this.facilitator.settle(payload, wire);
    if (!res.success || !res.transaction) {
      throw new Error(
        `settlement failed: ${res.errorMessage ?? res.errorReason ?? "unknown"}`,
      );
    }
    return { txHash: res.transaction };
  }
}
