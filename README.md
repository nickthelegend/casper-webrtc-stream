# casper-webrtc-stream

> **A battle-ready x402 micropayments SDK for Casper** — charge for anything over
> HTTP, settle on-chain. Plus a pay-per-second WebRTC streamer built on top.

Built for the **Casper Agentic Buildathon 2026**.

## What it does

At its core this is a **consumer-grade x402 payments SDK**: gate any HTTP route
behind a Casper micropayment with one middleware, and have clients auto-pay with
one wrapped `fetch`. Every payment settles on-chain as a real CEP-18
`transfer_with_authorization` via the CSPR.cloud x402 facilitator.

```ts
// server — gate a route behind a payment
app.get("/premium", paymentMiddleware({ rail, amount: "100000000", payTo }), handler);

// client — the 402 is paid + retried invisibly
const pay = wrapFetch(fetch, { rail, signFn, maxValue: "1000000000" });
const res = await pay("https://api.example.com/premium");   // 200, content unlocked
```

→ **[docs/X402.md](./docs/X402.md)** is the integration guide. **[examples/paid-api](./examples/paid-api)**
is a runnable, non-WebRTC demo (proven live on testnet:
[`3e04ec4e…`](https://testnet.cspr.live/deploy/3e04ec4e1ade22418747d7c36f0b5f71554c27d861180ea317bd2f48958465e7)).

**The flagship app on top of it:** drop ~10 lines into your app and a WebRTC
stream becomes a pay-per-second broadcast — viewers pay the creator directly per
segment, no platform, no 30% cut. See **[docs/USAGE.md](./docs/USAGE.md)**.

Published on npm:
[`@nickthelegend69/webrtc-payment-sdk-core`](https://www.npmjs.com/package/@nickthelegend69/webrtc-payment-sdk-core)
· [`@nickthelegend69/webrtc-payment-rail-x402`](https://www.npmjs.com/package/@nickthelegend69/webrtc-payment-rail-x402)

> **No mocks.** Payments are wired to the real CSPR.cloud x402 facilitator with
> real EIP-712 signatures. There is no fake "demo mode" that pretends a payment
> happened. Read **[STATUS.md](./STATUS.md)** for exactly what is verified vs.
> unverified before you rely on it.

## Run it

```bash
cd casper-dev
npm install        # also builds the SDK packages (postinstall)
npm run dev        # starts signaling + provider + consumer together
npm test              # full unit + integration suite (40 tests, node:test)
npm run test:signing  # EIP-712 payload verifies against the facilitator's digest
npm run test:crypto   # Mode 3 crypto gate (AES-GCM frames)
npm run test:contract # Odra contract on-chain logic (cargo odra test → 4/4)
```

The suite (`tests/*.test.mjs`) covers casperFormat, SessionManager (nonces/replay),
the DataChannel protocol, PaymentGate (accept/replay/settle modes/earnings), the
Mode 3 crypto gate, EIP-712 signing (incl. a facilitator-digest verification), the
payload builder, and the facilitator transport (mocked fetch). The live round-trip
is `npm run test:facilitator` (needs a CSPR.cloud key + token — see HANDOFF.md).

To take it on-chain (CSPR.cloud API key + a deployed token + funds) and to wire
CSPR.click / Mode 3 in the apps, follow **[HANDOFF.md](./HANDOFF.md)**.

- **Provider:** http://localhost:3000 → **Start Stream** (camera + WebRTC work
  with no setup).
- **Consumer:** http://localhost:3002?room=<roomId> → **Start Watching**.
- The provider's **Copy Stream Link** gives the exact consumer URL.

**Video streams immediately**, but `/verify` and `/settle` only succeed once you
configure a CSPR.cloud API key + a deployed CEP-18 x402 token (below). Until
then the apps show "payments not configured" — honestly, rather than faking it.

## Make payments real (Casper testnet)

1. `npm run generate-wallet` → fund it at https://testnet.cspr.live/tools/faucet
2. Get a CSPR.cloud API key: https://cspr.cloud
3. Deploy a CEP-18 x402 token (`Cep18X402.wasm` from
   [make-software/casper-x402](https://github.com/make-software/casper-x402));
   note its package hash + `name`/`version`/`decimals`/`symbol`.
4. Fill `apps/provider/.env.local` + `apps/consumer/.env.local` (token hash,
   account hashes, API key — server-side only).
5. Validate the signature against the live facilitator:
   ```bash
   npm run test:facilitator     # must print isValid: true
   ```
6. `npm run dev` and run the two-tab demo end-to-end.

For production, replace the consumer's hot key with **CSPR.click**
(`createBrowserSigner` in `packages/rail-x402-casper`). Never ship a raw key to
the browser.

## Architecture

- **`packages/core`** — `@nickthelegend69/webrtc-payment-sdk-core`
  - Rail-agnostic WebRTC payment middleware
  - `PaywalledRTCProvider` + `PaywalledRTCConsumer` peer classes
  - DataChannel payment protocol (Mode 2: per-segment)
  - AES-GCM crypto gate (Mode 3: trust-free)
  - `SessionManager` — deterministic segment nonces + replay protection
- **`packages/rail-x402-casper`** — `@nickthelegend69/webrtc-payment-rail-x402`
  - Casper x402 payment rail
  - CSPR.cloud facilitator integration (`/verify`, `/settle`)
  - EIP-712 typed-data signing for CEP-18 tokens (`@casper-ecosystem/casper-eip-712` + ed25519 via WebCrypto)
- **`apps/signaling`** — WebSocket signaling server (port 3001)
- **`apps/provider`** — broadcaster dashboard (port 3000)
- **`apps/consumer`** — viewer app (port 3002)
- **`examples/`** — `basic-stream` (~50 lines) + `ai-agent-stream` (headless paying agent)

## Gating modes

| Mode           | How                                  | Security        |
|----------------|--------------------------------------|-----------------|
| Signaling gate | Pay once before SDP                  | Trust-based     |
| Track gate     | Pay per segment via DataChannel      | Trust-based     |
| Crypto gate    | AES-GCM-encrypted RTP frames         | Cryptographic   |

Track gate is the demo default.

## SDK usage (10 lines)

```typescript
import { PaywalledRTCProvider } from "@nickthelegend69/webrtc-payment-sdk-core";
import { CasperX402Rail } from "@nickthelegend69/webrtc-payment-rail-x402";

const rail = new CasperX402Rail({ /* facilitator + token + provider hash */ });
const provider = new PaywalledRTCProvider({
  paymentRail: rail,
  gating: { mode: "track", segmentDurationSeconds: 5, pricePerSegment: "10000" },
  signalingServerUrl: "ws://localhost:3001",
});

const stream = await navigator.mediaDevices.getUserMedia({ video: true });
await provider.startStream(stream);
provider.on("earnings:update", (motes) => console.log("Earned:", motes));
```

## Demo script for judges (90 seconds)

1. Open http://localhost:3000 → **Start Stream** (camera goes live, 🔴 LIVE).
2. **Copy Stream Link**.
3. Open the link (http://localhost:3002?room=…) in another tab.
4. **Start Watching** → consent to the per-second price.
5. Stream unlocks, video plays.
6. Earnings tick up on the provider: +price every 5s.
7. Hit the spend cap (or stop paying) → stream suspends → "awaiting payment".
8. Resume → stream comes back.

## Resources

- [CSPR.cloud x402 docs](https://docs.cspr.cloud/x402-facilitator-api/reference)
- [casper-x402 reference](https://github.com/make-software/casper-x402)
- [Casper Testnet faucet](https://testnet.cspr.live/tools/faucet)
- Architecture reference (Algorand): [GoPlausible/webrtc-micropayments-sdk](https://github.com/GoPlausible/webrtc-micropayments-sdk)

## License

MIT.
