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

  /** Fired when a segment's on-chain settle confirms (async, one tx per segment). */
  onSettled?: (consumerId: string, segmentIndex: number, txHash: string) => void;
  /** Fired when a segment's on-chain settle fails (video already flowed on verify). */
  onSettleError?: (consumerId: string, segmentIndex: number, error: Error) => void;

  constructor(
    private rail: PaymentRail,
    private sessions: SessionManager,
    /** Settle every verified payment on-chain? Settlement is ASYNC and never
     *  blocks the stream — so each segment produces one on-chain tx (matching the
     *  reference SDK's partial-time mode: "On-chain tx count: N") while the video
     *  is gated on the instant `verify`. */
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

    // 2. rail verify — this is the gate. Passing verify proves the payer signed a
    //    valid, unspent authorization, so we enable the segment IMMEDIATELY (the
    //    stream never waits on chain finality).
    const verified = await this.rail.verify(payload);
    if (!verified.valid) {
      v.enabled = false;
      return { ok: false, reason: verified.error ?? "verification failed" };
    }

    // 3. accounting + enable on verify
    v.segmentsPaid += 1;
    v.lastSegmentIndex = segmentIndex;
    v.totalPaid = (BigInt(v.totalPaid || "0") + BigInt(req.amount)).toString();
    v.enabled = true;

    // 4. settle THIS segment on-chain, asynchronously — one real tx per segment
    //    (the reference SDK's partial-time model). It runs during playback and
    //    confirms in the background; failure doesn't interrupt the already-paid-
    //    for segment.
    if (this.settleOnVerify) {
      void this.rail
        .settle(payload)
        .then((r) => this.onSettled?.(consumerId, segmentIndex, r.txHash))
        .catch((e) => this.onSettleError?.(consumerId, segmentIndex, e as Error));
    }

    return { ok: true };
  }
}
