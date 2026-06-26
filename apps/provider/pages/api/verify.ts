/**
 * POST /api/verify { payload }
 * Server-side x402 verification (holds the secret API key). Called by the
 * browser provider's ProxyRail so the key never reaches the client.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import type { PaymentPayload } from "@nickthelegend69/webrtc-payment-sdk-core";
import { createServerRail, serverConfigured } from "../../lib/server-rail";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  if (!serverConfigured()) {
    return res
      .status(200)
      .json({ valid: false, error: "facilitator not configured (set CSPR_CLOUD_API_KEY + token)" });
  }
  const { payload } = req.body as { payload?: PaymentPayload };
  if (!payload) return res.status(400).json({ valid: false, error: "missing payload" });

  const rail = createServerRail();
  const result = await rail.verify(payload);
  console.log(
    `[api/verify] ${result.valid ? "✓ valid" : "✗ " + result.error} — payer ${payload.payload?.authorization?.from?.slice(0, 12)}…`,
  );
  return res.status(200).json(result);
}
