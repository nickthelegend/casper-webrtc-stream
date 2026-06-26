/**
 * A paid HTTP API — the "drop x402 into any app" demo. No WebRTC.
 *
 * GET /premium is gated by `paymentMiddleware`: with no payment it answers
 * 402 + requirements; with a valid `X-PAYMENT` header it verifies, settles
 * on-chain, sets `X-Payment-Tx`, and serves the content.
 */
import express from "express";
import { CasperX402Rail } from "@nickthelegend69/webrtc-payment-rail-x402";
import { paymentMiddleware, X402_TX_HEADER } from "@nickthelegend69/webrtc-payment-sdk-core";

const E = process.env;
const token = {
  name: E.CEP18_TOKEN_NAME,
  version: E.CEP18_TOKEN_VERSION,
  decimals: E.CEP18_TOKEN_DECIMALS,
  symbol: E.CEP18_TOKEN_SYMBOL,
};

const rail = new CasperX402Rail({
  facilitatorUrl: E.X402_FACILITATOR_URL ?? "https://x402-facilitator.cspr.cloud",
  facilitatorApiKey: E.CSPR_CLOUD_API_KEY, // server-side secret
  network: "casper:casper-test",
  tokenContractHash: E.CEP18_TOKEN_CONTRACT,
  token,
  providerAccountHash: E.PROVIDER_ACCOUNT_HASH,
});

const PRICE = E.PRICE ?? "100000000"; // 0.1 token (9 decimals)
const app = express();

app.get(
  "/premium",
  paymentMiddleware({
    rail,
    amount: PRICE,
    payTo: E.PROVIDER_ACCOUNT_HASH,
    asset: E.CEP18_TOKEN_CONTRACT,
    network: "casper:casper-test",
  }),
  (req, res) => {
    res.json({
      unlocked: true,
      content: "🔓 Premium content: x402 makes HTTP-native money real on Casper.",
      settledTx: res.getHeader(X402_TX_HEADER) ?? null,
    });
  },
);

// A free route, for contrast.
app.get("/", (_req, res) =>
  res.json({ ok: true, try: "/premium (costs " + PRICE + " base units)" }),
);

const port = Number(E.PORT ?? 4021);
app.listen(port, () =>
  console.log(`[paid-api] listening on http://localhost:${port}  ·  /premium = ${PRICE} base units`),
);
