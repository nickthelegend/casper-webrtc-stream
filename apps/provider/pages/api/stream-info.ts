/**
 * GET /api/stream-info?room=xxx&amount=10000
 * Mode 1 (signaling gate): returns HTTP 402 + PaymentRequirements so a
 * consumer knows exactly what to pay before any SDP is exchanged.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { createServerRail } from "../../lib/server-rail";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const room = String(req.query.room ?? "demo");
  const amount = String(req.query.amount ?? "50000");
  const rail = createServerRail();

  const requirements = rail.buildRequirements({ amount, sessionId: room });

  res.status(402).json({
    error: "payment_required",
    x402Version: 1,
    accepts: [requirements],
  });
}
