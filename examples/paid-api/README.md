# Example — Paid HTTP API (x402, no WebRTC)

The smallest possible "x402 in any app": an Express route gated behind a Casper
micropayment, and a client that auto-pays. **This is the whole pitch** — the
WebRTC streamer is just one app built on the same payment layer.

```
client                          server (/premium)
  │  GET /premium  ───────────────▶  402 Payment Required + requirements
  │  ◀── 402 ───────────────────────┘
  │  sign EIP-712 (wrapFetch)
  │  GET /premium  + X-PAYMENT  ──▶  verify → settle on-chain → 200 + content
  │  ◀── 200 + X-Payment-Tx ─────────┘
```

## Server (3 lines that matter)

```js
import { paymentMiddleware } from "@nickthelegend69/webrtc-payment-sdk-core";
import { CasperX402Rail } from "@nickthelegend69/webrtc-payment-rail-x402";

const rail = new CasperX402Rail({ /* facilitator, token, providerAccountHash, apiKey */ });

app.get("/premium",
  paymentMiddleware({ rail, amount: "100000000", payTo: PROVIDER_ACCOUNT_HASH }),
  (req, res) => res.json({ content: "🔓 unlocked" }),
);
```

The middleware validates the payment against your policy (correct payee, not
underpaid, right asset), verifies it with the facilitator, settles on-chain, and
only then calls your handler — with the tx hash in `X-Payment-Tx`.

## Client (1 line that matters)

```js
import { wrapFetch } from "@nickthelegend69/webrtc-payment-sdk-core";
const pay = wrapFetch(fetch, { rail, signFn, maxValue: "1000000000" });
const res = await pay("http://localhost:4021/premium");   // 402 handled invisibly
```

## Run it

Uses the same testnet env as the demo apps (`apps/provider/.env.local` +
`apps/consumer/.env.local`).

```bash
# terminal 1 — the paid API
npm -w @casper-webrtc/example-paid-api run server

# terminal 2 — a client that pays
npm -w @casper-webrtc/example-paid-api run client
```

Expected client output:

```
← 402 Payment Required → signing + paying 100000000 base units…
→ status: 200
→ body: { unlocked: true, content: '🔓 …', settledTx: '3e04ec4e…' }
✅ settled on-chain: https://testnet.cspr.live/deploy/3e04ec4e…
```

That `settledTx` is a real CEP-18 `transfer_with_authorization` on Casper testnet.
