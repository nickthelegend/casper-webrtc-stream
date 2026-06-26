/**
 * Client for the CSPR.cloud x402 facilitator (real v2 API).
 *
 * Auth is the raw access token in the `authorization` header (NOT `Bearer`),
 * per the documented examples. /verify and /settle take the same body:
 *   { paymentPayload, paymentRequirements }.
 */
import type { PaymentPayload } from "@nickthelegend69/webrtc-payment-sdk-core";
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

export interface FacilitatorClientOpts {
  /** Per-request timeout in ms (default 20000). */
  timeoutMs?: number;
  /** Retries on network error / 5xx (default 2). */
  retries?: number;
}

export class FacilitatorClient {
  private timeoutMs: number;
  private retries: number;

  constructor(
    private baseUrl: string,
    private apiKey?: string,
    opts: FacilitatorClientOpts = {},
  ) {
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.retries = Math.max(0, opts.retries ?? 2);
  }

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
    const body = JSON.stringify({ paymentPayload, paymentRequirements });
    let lastErr: Error | undefined;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      try {
        const res = await fetch(`${this.baseUrl}${path}`, {
          method: "POST",
          headers: this.headers(),
          body,
          signal: ctrl.signal,
        });
        const text = await res.text();
        // Retry transient 5xx (the facilitator may be briefly unavailable).
        if (res.status >= 500 && attempt < this.retries) {
          lastErr = new Error(`facilitator ${path}: ${res.status} ${text.slice(0, 160)}`);
          continue;
        }
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error(
            `facilitator ${path}: ${res.status} non-JSON response: ${text.slice(0, 200)}`,
          );
        }
        return json as T;
      } catch (err) {
        lastErr =
          (err as Error)?.name === "AbortError"
            ? new Error(`facilitator ${path}: timed out after ${this.timeoutMs}ms`)
            : (err as Error);
        if (attempt >= this.retries) break;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr ?? new Error(`facilitator ${path}: request failed`);
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
