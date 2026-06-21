/**
 * PaymentGate — provider-side gating + accounting.
 *
 * Owns the decision of whether a consumer's track should be enabled, tracks
 * per-viewer spend, and runs verify (+ optional settle) against the rail.
 * Used by PaywalledRTCProvider for Mode 1 (signaling) and Mode 2 (track).
 */
import type { PaymentPayload, PaymentRail, ViewerState } from "./types.js";
import { SessionManager } from "./SessionManager.js";
export interface GateDecision {
    ok: boolean;
    txHash?: string;
    reason?: string;
}
export declare class PaymentGate {
    private rail;
    private sessions;
    /** Settle on-chain after verify? (Mode 1 usually settles; Mode 2 batches.) */
    private settleOnVerify;
    private viewers;
    constructor(rail: PaymentRail, sessions: SessionManager, 
    /** Settle on-chain after verify? (Mode 1 usually settles; Mode 2 batches.) */
    settleOnVerify?: boolean);
    ensureViewer(consumerId: string, address?: string): ViewerState;
    getViewer(consumerId: string): ViewerState | undefined;
    listViewers(): ViewerState[];
    removeViewer(consumerId: string): void;
    totalEarnings(): string;
    /**
     * Verify a payment for a consumer/segment. Enforces nonce binding +
     * replay protection, then runs rail.verify and (optionally) rail.settle.
     * Updates viewer accounting on success.
     */
    processPayment(consumerId: string, segmentIndex: number, payload: PaymentPayload): Promise<GateDecision>;
}
//# sourceMappingURL=PaymentGate.d.ts.map