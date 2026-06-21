/**
 * POST /api/webhook
 * Optional x402 settlement webhook. The CSPR.cloud facilitator can call this
 * once a deploy is confirmed on-chain so the provider can reconcile earnings.
 * For the demo we just log and ack.
 */
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  // eslint-disable-next-line no-console
  console.log("[webhook] settlement event:", JSON.stringify(req.body));
  res.status(200).json({ received: true });
}
