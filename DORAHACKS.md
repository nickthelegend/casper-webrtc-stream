# casper-webrtc-stream

### Monetize live WebRTC video — chunk by chunk — with x402 micropayments on Casper. Pay to watch, per second. Creators paid directly, on-chain.

**Casper Agentic Buildathon 2026**

| | |
|---|---|
| 🎥 **Demo video** | _‹paste your recorded demo link here›_ |
| 💻 **GitHub** | https://github.com/nickthelegend/casper-webrtc-stream |
| 🚀 **Live — Creator Studio** | https://provider-nicolas-projects-f497bb7f.vercel.app |
| 🚀 **Live — Viewer** | https://consumer-nicolas-projects-f497bb7f.vercel.app |
| 📦 **npm** | [`@nickthelegend69/webrtc-payment-sdk-core`](https://www.npmjs.com/package/@nickthelegend69/webrtc-payment-sdk-core) · [`@nickthelegend69/webrtc-payment-rail-x402`](https://www.npmjs.com/package/@nickthelegend69/webrtc-payment-rail-x402) |
| ⛓️ **On-chain proof** | [testnet.cspr.live](https://testnet.cspr.live) (real tx links below) |

---

## 🧠 TL;DR

**casper-webrtc-stream** turns a live WebRTC video stream into a **pay-per-second** experience. The video is delivered peer-to-peer in short segments, and **each segment is unlocked by an x402 micropayment that settles on Casper.** The viewer pays for a few seconds of video, it settles on-chain, the next segment plays. Stop paying, the stream pauses.

No subscription. No platform. No 30% cut. The creator is paid **directly, per second, on a real chain** — and it's all packaged as a **framework-agnostic SDK** (two published npm packages) that any app can drop in to gate *anything* — video, an API, data, or an AI agent's request.

## 🎯 The Problem

Streaming and content monetization is broken for small creators and, increasingly, for **machines**:

- **Subscriptions are all-or-nothing** — you pay for a month to watch five minutes.
- **Platforms take 30%+** and own the relationship with your audience.
- **Card rails can't do micropayments** — fees dwarf a per-second charge.
- **AI agents have no money rail** — autonomous software that consumes streamed data or inference has no clean, HTTP-native way to pay per use.

There's no primitive for *"pay exactly for what you watch/consume, per unit, directly to the creator."*

## 💡 The Solution

We use **x402** — the HTTP `402 Payment Required` status, turned into a real payment handshake — and make it settle on **Casper**:

```
GET /segment            →  402 Payment Required + price
sign EIP-712 (wallet)   →  X-PAYMENT header
GET /segment + payment  →  verify → settle on Casper → 200 (segment unlocked)
```

WebRTC carries the video; x402 gates every chunk; Casper is where the money lands as a real **CEP-18 `transfer_with_authorization`** via the **CSPR.cloud x402 facilitator**.

## ⚙️ How It Works

```
                    signaling (WebSocket)
     ┌──────────────────────────────────────────────┐
  ┌──┴───────────┐     WebRTC video + data     ┌─────┴────────┐
  │  Creator     │ ◀─────────────────────────▶ │   Viewer     │
  │  (Studio)    │   "casper-pay" DataChannel   │  (pays/sec)  │
  └──────┬───────┘                              └──────┬───────┘
         │ per-segment: verify → settle on-chain       │ signs each segment
         ▼                                              ▼
     CSPR.cloud x402 facilitator ───▶ Casper (CEP-18 transfer_with_authorization)
```

1. **Creator goes live** in the Studio — the stream is split into ~15s segments.
2. **Viewer joins** and, each segment, signs an EIP-712 authorization over a payment channel.
3. The creator **verifies** it instantly (video keeps playing) and **settles** it on Casper — **one real transaction per segment watched**.
4. Miss a payment → the track is suspended within one segment.

The same primitive powers a **one-line HTTP paywall** for any resource:
```ts
// server — gate anything in one line
app.get("/premium", paymentMiddleware({ rail, amount, payTo }), handler);
// client — the 402 is paid + retried automatically
const pay = wrapFetch(fetch, { rail, signFn });
```

## ✨ Key Features

- 🎬 **Pay-per-second WebRTC streaming** — real peer-to-peer video, monetized per segment.
- 🔌 **Drop-in x402 SDK** — one line on the server (`paymentMiddleware`), one on the client (`wrapFetch`). Gate a video chunk, an API, or an agent request.
- ⛓️ **Real on-chain settlement** — CEP-18 `transfer_with_authorization` on Casper testnet, via the CSPR.cloud facilitator.
- 👛 **Wallet + agent support** — sign with CSPR.click (human) or a raw key (autonomous agent / server).
- 🔒 **Trust-minimized** — server-side policy checks (payee, amount, asset) before settling; optional AES-GCM per-segment encryption so bytes are useless without paying.
- 📦 **Shipped** — two published, versioned npm packages; framework-agnostic.

## 🔗 Live On-Chain Proof (real, verifiable)

Every payment is a real CEP-18 transfer on Casper testnet:

| Flow | Tx | Result |
|------|----|--------|
| **Live Vercel backend** settles x402 | [`0cc30a50…`](https://testnet.cspr.live/deploy/0cc30a50be9e74ab9dabf9433fcc298bfbe85fbe22696965168d308459918a71) | ✅ SUCCESS · block 8416055 |
| Paid-API drop-in (`wrapFetch`) | [`3e04ec4e…`](https://testnet.cspr.live/deploy/3e04ec4e1ade22418747d7c36f0b5f71554c27d861180ea317bd2f48958465e7) | ✅ SUCCESS · block 8309369 |
| Server-driven settle | [`448eafae…`](https://testnet.cspr.live/deploy/448eafaefce0ec4d730531a3e6b205d6677359438ec0f800cfc279e8e92c2c15) | ✅ SUCCESS · block 8308737 |

Plus one settlement per segment during live streaming. CEP-18 x402 token deployed at package `3931f6de…0687b`.

## 🛠️ Tech Stack

TypeScript · WebRTC (RTCPeerConnection + DataChannel) · Next.js (Creator Studio + Viewer) · Node (signaling + settlement) · **Casper** (CEP-18, EIP-712 `TransferWithAuthorization`) · **CSPR.cloud x402 facilitator** · CSPR.click · Odra (Rust) contract · `@noble/curves` + `@noble/hashes` · deployed on **Vercel** (frontends) + **Cloudflare** (signaling).

## 🧪 Try It

```bash
git clone https://github.com/nickthelegend/casper-webrtc-stream && cd casper-webrtc-stream
npm install && npm test          # 40 tests

# x402 drop-in, settles on-chain (no WebRTC):
npm -w @casper-webrtc/example-paid-api run server   # terminal 1
npm -w @casper-webrtc/example-paid-api run client   # terminal 2 → 402 → pays → 200 + tx hash

# The streaming app:
npm run dev                       # signaling + Studio(:3000) + Viewer(:3002)
```

Or install the SDK into your own app:
```bash
npm i @nickthelegend69/webrtc-payment-sdk-core @nickthelegend69/webrtc-payment-rail-x402
```

## 🗺️ Roadmap

- Verify CSPR.click real-wallet signing end-to-end; production TURN for rock-solid P2P.
- Mainnet token + hosted facilitator-key proxy.
- **Agent commerce:** an autonomous AI agent that pays per call / per stream, and a paid-MCP server — the machine-payable web on Casper.
- Creator payouts, analytics, and multi-viewer scaling.

## 🟣 Why Casper / Why This Buildathon

The agent economy needs **machine-payable money rails**. x402 is HTTP-native pay-per-use, and this is a **battle-ready x402 SDK on Casper** — published, on-chain-proven, and droppable into any app or agent. Pay-per-second WebRTC streaming is the flagship we built to prove it, but the rail monetizes *anything* served over HTTP.

## 👤 Team

**@nickthelegend** — built for the Casper Agentic Buildathon 2026.
