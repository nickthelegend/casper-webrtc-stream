/**
 * DataChannel payment protocol helpers (Mode 2 / Mode 3).
 *
 * Thin, well-typed wrappers around the DCMessage union so the provider and
 * consumer never hand-roll JSON.parse/stringify or guess message shapes.
 */
import type { DCMessage, PaymentPayload, PaymentRequirements } from "./types.js";
export declare const DC_LABEL = "casper-pay";
export declare function encodeDC(msg: DCMessage): string;
export declare function decodeDC(data: string): DCMessage | null;
export declare const dc: {
    paymentRequest(segmentIndex: number, requirements: PaymentRequirements): DCMessage;
    paymentProof(segmentIndex: number, payload: PaymentPayload): DCMessage;
    confirmed(segmentIndex: number, txHash?: string): DCMessage;
    rejected(segmentIndex: number, reason: string): DCMessage;
    key(segmentIndex: number, key: string): DCMessage;
    suspended(reason: "payment_missed" | "max_segments_reached"): DCMessage;
    resumed(): DCMessage;
};
//# sourceMappingURL=DataChannelProtocol.d.ts.map