/**
 * PaymentGate — provider-side gating + accounting.
 *
 * Owns the decision of whether a consumer's track should be enabled, tracks
 * per-viewer spend, and runs verify (+ optional settle) against the rail.
 * Used by PaywalledRTCProvider for Mode 1 (signaling) and Mode 2 (track).
 */
import type {
  PaymentPayload,
  PaymentRail,
  ViewerState,
} from "./types.js";
import { SessionManager } from "./SessionManager.js";

export interface GateDecision {
  ok: boolean;
  txHash?: string;
  reason?: string;
}

export class PaymentGate {
  private viewers = new Map<string, ViewerState>();

  constructor(
    private rail: PaymentRail,
    private sessions: SessionManager,
    /** Settle on-chain after verify? (Mode 1 usually settles; Mode 2 batches.) */
    private settleOnVerify = true,
  ) {}

  ensureViewer(consumerId: string, address?: string): ViewerState {
    let v = this.viewers.get(consumerId);
    if (!v) {
      v = {
        consumerId,
        address,
        segmentsPaid: 0,
        totalPaid: "0",
        enabled: false,
        lastSegmentIndex: -1,
      };
      this.viewers.set(consumerId, v);
    }
    if (address) v.address = address;
    return v;
  }

  getViewer(consumerId: string): ViewerState | undefined {
    return this.viewers.get(consumerId);
  }

  listViewers(): ViewerState[] {
    return [...this.viewers.values()];
  }

  removeViewer(consumerId: string): void {
    this.viewers.delete(consumerId);
  }

  totalEarnings(): string {
    let total = 0n;
    for (const v of this.viewers.values()) total += BigInt(v.totalPaid || "0");
    return total.toString();
  }

  /**
   * Verify a payment for a consumer/segment. Enforces nonce binding +
   * replay protection, then runs rail.verify and (optionally) rail.settle.
   * Updates viewer accounting on success.
   */
  async processPayment(
    consumerId: string,
    segmentIndex: number,
    payload: PaymentPayload,
  ): Promise<GateDecision> {
    const v = this.ensureViewer(consumerId, payload.payload.authorization.from);
    const req = payload.paymentRequirements;
    if (!req) {
      return { ok: false, reason: "payload missing paymentRequirements" };
    }

    // 1. nonce must match the expected segment nonce AND be unused
    const nonceOk = this.sessions.validateNonce(
      req.nonce,
      req.sessionId,
      segmentIndex,
      Math.max(60, (req.requiredDeadlineSeconds ?? 30) * 2),
    );
    if (!nonceOk) {
      v.enabled = false;
      return { ok: false, reason: "nonce invalid or replayed" };
    }

    // 2. rail verify
    const verified = await this.rail.verify(payload);
    if (!verified.valid) {
      v.enabled = false;
      return { ok: false, reason: verified.error ?? "verification failed" };
    }

    // 3. optional settle
    let txHash: string | undefined;
    if (this.settleOnVerify) {
      try {
        const settled = await this.rail.settle(payload);
        txHash = settled.txHash;
      } catch (err) {
        // verified but settlement failed — let the stream continue, surface error
        return {
          ok: true,
          reason: `verified; settle deferred: ${(err as Error).message}`,
        };
      }
    }

    // 4. accounting
    v.segmentsPaid += 1;
    v.lastSegmentIndex = segmentIndex;
    v.totalPaid = (BigInt(v.totalPaid || "0") + BigInt(req.amount)).toString();
    v.enabled = true;

    return { ok: true, txHash };
  }
}
