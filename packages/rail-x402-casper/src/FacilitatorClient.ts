/**
 * Client for the CSPR.cloud x402 facilitator (real v2 API).
 *
 * Auth is the raw access token in the `authorization` header (NOT `Bearer`),
 * per the documented examples. /verify and /settle take the same body:
 *   { paymentPayload, paymentRequirements }.
 */
import type { PaymentPayload } from "@nickthelegend/webrtc-payment-sdk-core";
import type {
  FacilitatorSettleResponse,
  FacilitatorVerifyResponse,
} from "./types.js";

/** Facilitator-shaped paymentRequirements (distinct from the SDK's). */
export interface WireRequirements {
  scheme: string;
  network: string;
  payTo: string; // "00<64hex>"
  amount: string;
  asset: string; // 64hex package hash
  maxTimeoutSeconds: number;
  extra: Record<string, string>;
}

export class FacilitatorClient {
  constructor(
    private baseUrl: string,
    private apiKey?: string,
  ) {}

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      accept: "application/json",
      ...(this.apiKey ? { authorization: this.apiKey } : {}),
    };
  }

  private async post<T>(
    path: string,
    paymentPayload: PaymentPayload,
    paymentRequirements: WireRequirements,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ paymentPayload, paymentRequirements }),
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`facilitator ${path}: ${res.status} ${text.slice(0, 200)}`);
    }
    // /settle always returns 200; /verify returns 200 with isValid flag.
    return json as T;
  }

  verify(
    payload: PaymentPayload,
    requirements: WireRequirements,
  ): Promise<FacilitatorVerifyResponse> {
    return this.post<FacilitatorVerifyResponse>("/verify", payload, requirements);
  }

  settle(
    payload: PaymentPayload,
    requirements: WireRequirements,
  ): Promise<FacilitatorSettleResponse> {
    return this.post<FacilitatorSettleResponse>("/settle", payload, requirements);
  }
}
