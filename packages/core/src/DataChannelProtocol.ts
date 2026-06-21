/**
 * DataChannel payment protocol helpers (Mode 2 / Mode 3).
 *
 * Thin, well-typed wrappers around the DCMessage union so the provider and
 * consumer never hand-roll JSON.parse/stringify or guess message shapes.
 */
import type { DCMessage, PaymentPayload, PaymentRequirements } from "./types.js";

export const DC_LABEL = "casper-pay";

export function encodeDC(msg: DCMessage): string {
  return JSON.stringify(msg);
}

export function decodeDC(data: string): DCMessage | null {
  try {
    const parsed = JSON.parse(data);
    if (parsed && typeof parsed.type === "string") return parsed as DCMessage;
    return null;
  } catch {
    return null;
  }
}

export const dc = {
  paymentRequest(segmentIndex: number, requirements: PaymentRequirements): DCMessage {
    return { type: "segment_payment_request", segmentIndex, requirements };
  },
  paymentProof(segmentIndex: number, payload: PaymentPayload): DCMessage {
    return { type: "segment_payment_proof", segmentIndex, payload };
  },
  confirmed(segmentIndex: number, txHash?: string): DCMessage {
    return { type: "segment_confirmed", segmentIndex, txHash };
  },
  rejected(segmentIndex: number, reason: string): DCMessage {
    return { type: "segment_rejected", segmentIndex, reason };
  },
  key(segmentIndex: number, key: string): DCMessage {
    return { type: "segment_key", segmentIndex, key };
  },
  suspended(reason: "payment_missed" | "max_segments_reached"): DCMessage {
    return { type: "stream_suspended", reason };
  },
  resumed(): DCMessage {
    return { type: "stream_resumed" };
  },
};
