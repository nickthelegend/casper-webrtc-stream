/**
 * POST /api/settle { payload }
 * Server-side x402 settlement (submits the on-chain deploy via the facilitator).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import type { PaymentPayload } from "@nickthelegend/webrtc-payment-sdk-core";
import { createServerRail, serverConfigured } from "../../lib/server-rail";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  if (!serverConfigured()) {
    return res.status(200).json({ error: "facilitator not configured" });
  }
  const { payload } = req.body as { payload?: PaymentPayload };
  if (!payload) return res.status(400).json({ error: "missing payload" });

  const rail = createServerRail();
  try {
    const { txHash } = await rail.settle(payload);
    return res.status(200).json({ txHash });
  } catch (err) {
    return res.status(200).json({ error: (err as Error).message });
  }
}
