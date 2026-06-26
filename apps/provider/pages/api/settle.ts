/**
 * POST /api/settle { payload }
 * Server-side x402 settlement (submits the on-chain deploy via the facilitator).
 */
import type { NextApiRequest, NextApiResponse } from "next";
import type { PaymentPayload } from "@nickthelegend69/webrtc-payment-sdk-core";
import { createServerRail, serverConfigured } from "../../lib/server-rail";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  if (!serverConfigured()) {
    return res.status(200).json({ error: "facilitator not configured" });
  }
  const { payload } = req.body as { payload?: PaymentPayload };
  if (!payload) return res.status(400).json({ error: "missing payload" });

  const rail = createServerRail();
  console.log("[api/settle] → submitting on-chain settle…");
  try {
    const { txHash } = await rail.settle(payload);
    console.log(`[api/settle] ⛓ settled → ${txHash}`);
    return res.status(200).json({ txHash });
  } catch (err) {
    console.error("[api/settle] ✗ failed:", (err as Error).message);
    return res.status(200).json({ error: (err as Error).message });
  }
}
