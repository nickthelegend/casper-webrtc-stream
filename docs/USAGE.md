# Usage Guide — casper-webrtc-stream

End-to-end guide to building a **pay-per-second WebRTC stream** that settles on
Casper Network with x402 micropayments.

- [`@nickthelegend69/webrtc-payment-sdk-core`](https://www.npmjs.com/package/@nickthelegend69/webrtc-payment-sdk-core) — rail-agnostic WebRTC + gating engine.
- [`@nickthelegend69/webrtc-payment-rail-x402`](https://www.npmjs.com/package/@nickthelegend69/webrtc-payment-rail-x402) — Casper x402 settlement rail.

---

## Table of contents

1. [Install](#1-install)
2. [Architecture in 60 seconds](#2-architecture-in-60-seconds)
3. [Prerequisites](#3-prerequisites)
4. [The signaling server](#4-the-signaling-server)
5. [Build the rail](#5-build-the-rail)
6. [Provider — paywall a stream](#6-provider--paywall-a-stream)
7. [Consumer — pay to watch](#7-consumer--pay-to-watch)
8. [Gating modes](#8-gating-modes)
9. [Signers](#9-signers)
10. [Events reference](#10-events-reference)
11. [Replay protection](#11-replay-protection)
12. [Security checklist](#12-security-checklist)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Install

```bash
npm install @nickthelegend69/webrtc-payment-sdk-core \
            @nickthelegend69/webrtc-payment-rail-x402
```

Both packages are pure ESM with bundled TypeScript types. The provider/consumer
run in the browser; the rail's settle path and the signaling server run in
Node 18+.

---

## 2. Architecture in 60 seconds

```
                    signaling (WebSocket)
   ┌───────────────────────────────────────────────────┐
   │                                                     │
┌──┴───────────┐        WebRTC media + data        ┌─────┴────────┐
│  Provider    │ ◀───────────────────────────────▶ │  Consumer    │
│ (streamer)   │     "casper-pay" DataChannel       │  (viewer)    │
└──────┬───────┘                                    └──────┬───────┘
       │ rail.verify()  → POST /verify  (gate)             │ signFn (EIP-712)
       │ rail.settle()  → POST /settle  (on-chain tx)      │
       ▼                                                   ▼
   CSPR.cloud x402 facilitator  ───────▶  Casper Network (CEP-18 transfer)
```

Each segment: the provider asks for payment → the consumer signs an EIP-712
authorization and sends it over the DataChannel → the provider **verifies** to
unlock the next segment instantly, then **settles** it on-chain (one real tx).
Stop paying and your track is suspended within one segment.

---

## 3. Prerequisites

You need:

| Thing | Where to get it |
|-------|-----------------|
| A **CEP-18 token** that supports `transfer_with_authorization` | Deploy the contract in `contracts/cep18-x402`, or use an existing x402 token. Note its **package hash**. |
| A **CSPR.cloud API key** | https://console.cspr.cloud — used server-side for `/verify` + `/settle`. |
| A **funded testnet account** for the consumer (payer) | https://testnet.cspr.live faucet. |
| A **payee account hash** for the provider | Any Casper account you control. |

Set these as env vars (see `apps/*/.env.example`).

---

## 4. The signaling server

WebRTC needs a tiny signaling relay so peers can exchange SDP + ICE. A reference
WebSocket server lives in `apps/signaling` (Express + `ws`). Run it anywhere both
peers can reach:

```bash
npm -w @casper-webrtc/signaling run dev   # ws://localhost:3001
```

It only brokers the handshake — no media or payments flow through it.

---

## 5. Build the rail

The rail is the only Casper-specific object. Build it on **both** sides, but with
different fields:

```ts
import { CasperX402Rail } from "@nickthelegend69/webrtc-payment-rail-x402";

const token = { name: "Cep18x402", version: "1", decimals: "9", symbol: "X402" };

// Provider (server): can verify + settle
const providerRail = new CasperX402Rail({
  facilitatorUrl: "https://x402-facilitator.cspr.cloud",
  facilitatorApiKey: process.env.CSPR_CLOUD_API_KEY,   // secret
  network: "casper:casper-test",
  tokenContractHash: process.env.CEP18_TOKEN_CONTRACT!,
  token,
  providerAccountHash: process.env.PROVIDER_ACCOUNT_HASH!,
});

// Consumer (browser): only builds + signs
const consumerRail = new CasperX402Rail({
  facilitatorUrl: "https://x402-facilitator.cspr.cloud",
  network: "casper:casper-test",
  tokenContractHash: process.env.NEXT_PUBLIC_CEP18_TOKEN_CONTRACT!,
  token,
  consumerAccountHash: walletAddress,
  consumerPublicKeyHex: publicKeyHex,
});
```

> In a real browser app, don't put the facilitator API key on the client. Proxy
> `verify`/`settle` through your backend (the reference app does this in
> `apps/provider/pages/api/{verify,settle}.ts`).

---

## 6. Provider — paywall a stream

```ts
import { PaywalledRTCProvider } from "@nickthelegend69/webrtc-payment-sdk-core";

const SEGMENT_SECONDS = 15;                 // one on-chain settle per segment
const pricePerSegment = "150000000";        // base units (token decimals)

const provider = new PaywalledRTCProvider({
  paymentRail: providerRail,
  gating: {
    mode: "track",
    segmentDurationSeconds: SEGMENT_SECONDS,
    pricePerSegment,
  },
  signalingServerUrl: "ws://localhost:3001",
});

provider.on("consumer:joined",      (id)            => ui.addViewer(id));
provider.on("consumer:paid",        (id, amt, seg)  => ui.markPaid(id, seg));
provider.on("consumer:settled",     (id, seg, tx)   => ui.onChain(seg, tx));
provider.on("consumer:settle_failed", (id, seg, e)  => console.warn("settle failed", e));
provider.on("consumer:defaulted",   (id)            => ui.suspend(id));
provider.on("earnings:update",      (motes)         => ui.earnings(motes));

const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
await provider.startStream(media);

const watchLink = `https://your.app/watch?room=${provider.room}`;
```

> **Picking the segment length:** Casper finality is ~30–60s and the facilitator
> settles sequentially, so keep segments ≥ ~10s to stop settles piling up. The
> stream is *gated on verify* (instant), so viewers never wait for finality —
> settlement just trails behind.

---

## 7. Consumer — pay to watch

```ts
import { PaywalledRTCConsumer } from "@nickthelegend69/webrtc-payment-sdk-core";

const consumer = new PaywalledRTCConsumer({
  paymentRail: consumerRail,
  signalingServerUrl: "ws://localhost:3001",
  walletAddress,                     // payer account hash
  signFn,                            // see §9
});

consumer.enableAutoPayment({
  maxTotalSpend: "1000000000",       // 1 token hard cap — never exceeded
  onPayment:    (amt, i) => console.log("sent payment for segment", i),
  onMaxReached: ()       => console.log("cap reached — stream will pause"),
});

consumer.on("stream:started",    (stream)     => (videoEl.srcObject = stream));
consumer.on("stream:paused",     ()           => ui.showPaused());
consumer.on("stream:resumed",    ()           => ui.hidePaused());
consumer.on("payment:confirmed", (seg, txHash) => ui.settlement(seg, txHash));

const { stream, sessionId } = await consumer.joinStream(
  `ws://localhost:3001?room=${room}`,
);
```

---

## 8. Gating modes

Set `gating.mode` on the provider.

### `signaling` — pay once, whole stream
The consumer pays before the SDP offer is sent. Enforced server-side. One tx
total. Good for ticketed access.

### `track` — pay per segment (the default for pay-per-second)
Every `segmentDurationSeconds`, the provider requests a payment over the
DataChannel. Miss one and your media track is toggled off until you pay again.
N segments → N on-chain txs.

### `crypto` — pay per segment, cryptographically enforced
Like `track`, but RTP frames are **AES-GCM encrypted** and the per-segment key
is only sent after the payment verifies. Even if a viewer captures the bytes,
they're useless without paying. Requires **Encoded Transforms** (Chromium):

```ts
const consumer = new PaywalledRTCConsumer({ /* … */, cryptoMode: true });
```

---

## 9. Signers

`signFn(digestHex) => Promise<signatureHex>` — the consumer's only crypto duty.

### Production (browser wallet)

```ts
import { createBrowserSigner } from "@nickthelegend69/webrtc-payment-rail-x402";
const signFn = createBrowserSigner();   // delegates to the connected wallet (CSPR.click)
```

### Demo / agents (raw ed25519 key)

```ts
import { makeEd25519SignFn } from "@nickthelegend69/webrtc-payment-rail-x402";
const signFn = makeEd25519SignFn(process.env.CONSUMER_PRIVATE_KEY!); // hot key — testnet only
```

`makeEd25519SignFn` uses `@noble/curves` (pure JS), so it works identically in the
browser and in Node — handy for headless AI-agent consumers.

---

## 10. Events reference

### Provider

| Event | Args | Fires when |
|-------|------|-----------|
| `consumer:joined` | `(id)` | A viewer connects. |
| `consumer:paid` | `(id, amount, segmentIndex)` | A segment payment verifies. |
| `consumer:settled` | `(id, segmentIndex, txHash)` | The segment settles on-chain. |
| `consumer:settle_failed` | `(id, segmentIndex, error)` | On-chain settle errored. |
| `consumer:defaulted` | `(id)` | A viewer missed a payment. |
| `consumer:left` | `(id)` | A viewer disconnected. |
| `earnings:update` | `(totalMotes)` | Running settled total changed. |
| `error` | `(Error)` | Anything threw. |

### Consumer

| Event | Args | Fires when |
|-------|------|-----------|
| `stream:started` | `(MediaStream)` | First media track arrives. |
| `stream:paused` | `()` | Suspended (missed payment / cap). |
| `stream:resumed` | `()` | Payment resumed delivery. |
| `payment:sent` | `(amount, segmentIndex)` | A payment proof was sent. |
| `payment:confirmed` | `(segmentIndex, txHash?)` | Provider confirmed the segment (txHash once settled). |
| `error` | `(Error)` | Signing or transport failed. |

---

## 11. Replay protection

Per-segment nonces are `SHA-256(sessionId:segmentIndex)` — derivable by both
peers and recorded by the provider's `SessionManager` on first use. A replayed or
mismatched nonce fails the gate **before** the rail is called, so a captured
payload can't be reused.

---

## 12. Security checklist

- ❌ **Never** ship the CSPR.cloud API key to the browser. Proxy `verify`/`settle`.
- ❌ **Never** ship a raw private key to the browser in production — use a wallet
  via `createBrowserSigner()`. `makeEd25519SignFn` is for testnet demos / agents.
- ✅ Set a `maxTotalSpend` cap on every consumer.
- ✅ Use a dedicated low-balance testnet account for demos.
- ✅ Keep `.env*`, `.npmrc`, and key files out of git.

---

## 13. Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| ICE `connection state: failed`, only host/STUN candidates | Add a TURN relay. `DEFAULT_ICE_SERVERS` ships one; override via `iceServers` in the config for production. |
| `/verify` returns `isValid: false` | Token `decimals`/`symbol` in `token` don't match the on-chain CEP-18, or the payee/asset hash is wrong. |
| `joinStream timed out waiting for offer` | Signaling server unreachable, or provider isn't streaming to that `room`. |
| Stream stays paused | Spend cap (`maxTotalSpend`) reached, or the segment payment failed to sign — check the consumer console. |
| `crypto` mode shows a black frame | Browser lacks Encoded Transforms (use Chromium), or the first segment key hasn't arrived yet. |
| Settles lag far behind | Segment too short for Casper finality — raise `segmentDurationSeconds`. |

---

For the contract and on-chain settlement details, see
[`ONCHAIN.md`](../ONCHAIN.md). For a runnable reference, see `apps/provider`,
`apps/consumer`, and `apps/signaling` in this repo.
