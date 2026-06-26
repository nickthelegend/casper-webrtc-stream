/**
 * POST /api/join  { room, paymentPayload }
 * Mode 1: verify (and settle) the consumer's whole-stream payment server-side.
 * On success the consumer is cleared to complete the SDP handshake over the
 * signaling WebSocket (the browser provider holds the MediaStream).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import type { PaymentPayload } from "@nickthelegend69/webrtc-payment-sdk-core";
import { createServerRail } from "../../lib/server-rail";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") return res.status(405).end();

  const { room, paymentPayload } = req.body as {
    room?: string;
    paymentPayload?: PaymentPayload;
  };
  if (!room || !paymentPayload) {
    return res.status(400).json({ accepted: false, reason: "missing room or paymentPayload" });
  }

  const rail = createServerRail();
  const verified = await rail.verify(paymentPayload);
  if (!verified.valid) {
    return res.status(402).json({ accepted: false, reason: verified.error ?? "invalid payment" });
  }

  let txHash: string | undefined;
  try {
    txHash = (await rail.settle(paymentPayload)).txHash;
  } catch (err) {
    return res.status(502).json({ accepted: false, reason: `settle failed: ${(err as Error).message}` });
  }

  return res.status(200).json({ accepted: true, room, txHash });
}
