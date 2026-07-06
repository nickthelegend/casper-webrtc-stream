# casper-webrtc-stream — Hackathon Submission

**Casper Agentic Buildathon 2026**

> **A battle-ready x402 micropayments SDK for Casper.** Charge for anything over
> HTTP — per call or per second — and settle it on-chain. One line on the server,
> one on the client. The payment rail for the agent economy.

- **GitHub:** https://github.com/nickthelegend/casper-webrtc-stream
- **npm:** [`@nickthelegend69/webrtc-payment-sdk-core`](https://www.npmjs.com/package/@nickthelegend69/webrtc-payment-sdk-core) · [`@nickthelegend69/webrtc-payment-rail-x402`](https://www.npmjs.com/package/@nickthelegend69/webrtc-payment-rail-x402) (both `0.2.1`, published)
- **Demo video:** _‹paste your recorded demo link here›_
- **Network:** Casper **testnet** · CSPR.cloud x402 facilitator

---

## The problem

Apps and AI agents increasingly need to **pay per use** — per API request, per
second of a stream, per unit of data or inference. But:

- **Card rails can't do micropayments** (fees dwarf the payment, no per-call billing).
- **Crypto checkout is clunky** — connect, approve, sign, wait, per purchase.
- **HTTP has no native money rail.** There's no clean "pay-per-call" primitive.

This is exactly the gap the **agent economy** runs into: autonomous software that
needs to pay for what it consumes, programmatically, in small amounts.

## The solution

**x402** turns the dormant HTTP `402 Payment Required` status into a real payment
handshake, and this SDK makes it work on **Casper**:

```
GET /thing                          → 402 Payment Required + requirements
GET /thing  + X-PAYMENT: <payload>  → verify → settle on-chain → 200 OK
```

The consumer signs an **EIP-712 `TransferWithAuthorization`**; the provider verifies
and settles it through the **CSPR.cloud x402 facilitator** as a real **CEP-18
`transfer_with_authorization`**. The SDK is **framework-agnostic** — drop it into any
HTTP app — and ships a flagship app on top: **pay-per-second WebRTC streaming**.

## How it works

```
                signaling (WebSocket)
   ┌──────────────────────────────────────────────┐
┌──┴────────┐      WebRTC media + data       ┌─────┴──────┐
│ Provider  │ ◀────────────────────────────▶ │  Consumer  │
│ (server)  │       "casper-pay" channel      │  (client)  │
└────┬──────┘                                 └─────┬──────┘
     │ verify() → POST /verify  (gate)              │ sign EIP-712
     │ settle() → POST /settle  (on-chain tx)       │
     ▼                                              ▼
  CSPR.cloud x402 facilitator  ───▶  Casper (CEP-18 transfer_with_authorization)
```

- **Client:** `wrapFetch(fetch, { rail, signFn })` — any `402` is paid + retried, invisibly.
- **Server:** `paymentMiddleware({ rail, amount, payTo })` — gate any route in one line;
  it validates payer/amount/asset, verifies, settles, and only then serves the resource.
- **Rail:** `CasperX402Rail` — builds the EIP-712 payload and talks to the facilitator.

## What's built

| Piece | What it is |
|-------|-----------|
| **`webrtc-payment-sdk-core`** | Framework-agnostic core: the x402-over-HTTP layer (`wrapFetch`, `paymentMiddleware`, `X402Gate`) + WebRTC provider/consumer + 3 gating modes. |
| **`webrtc-payment-rail-x402`** | Casper settlement rail: EIP-712 `TransferWithAuthorization`, CSPR.cloud facilitator client, ed25519/secp256k1 signing, account-hash derivation. |
| **CEP-18 x402 token** | Deployed on testnet (package `3931f6de…0687b`) supporting `transfer_with_authorization`. |
| **Pay-per-second streaming app** | Provider "studio" + viewer, premium UI; Big Buck Bunny streamed over WebRTC with **one on-chain settlement per segment**. |
| **Paid-API example** | Standalone, no WebRTC: an Express route gated by `paymentMiddleware` + a `wrapFetch` client — drop-in proof. |
| **CSPR.click wallet** | Real Casper Wallet connect wired in the viewer (sign x402 with the connected wallet). |
| **Tests** | 40 unit/integration tests (`npm test`), incl. the x402 HTTP layer + security policy. |

## On-chain proof (real, verifiable)

Every payment is a real CEP-18 `transfer_with_authorization` on Casper testnet:

| Flow | Tx | Result |
|------|----|--------|
| Paid-API (`wrapFetch` → server `/settle`) | [`3e04ec4e…8465e7`](https://testnet.cspr.live/deploy/3e04ec4e1ade22418747d7c36f0b5f71554c27d861180ea317bd2f48958465e7) | **SUCCESS** · block 8309369 |
| Server-driven settle | [`448eafae…2c2c15`](https://testnet.cspr.live/deploy/448eafaefce0ec4d730531a3e6b205d6677359438ec0f800cfc279e8e92c2c15) | **SUCCESS** · block 8308737 |

Plus per-segment settlements from the live streaming demo (one tx per ~15s segment).

## Tech stack

TypeScript · Node 18+ · WebRTC (RTCPeerConnection + DataChannel) · Next.js (pages
router) · Casper (CEP-18, EIP-712 via `@casper-ecosystem/casper-eip-712`) ·
CSPR.cloud x402 facilitator · CSPR.click · `@noble/curves` + `@noble/hashes` ·
Odra (Rust) for the contract.

## Quick start

```bash
git clone https://github.com/nickthelegend/casper-webrtc-stream && cd casper-webrtc-stream
npm install          # builds the SDK packages
npm test             # 40 tests

# Drop-in x402, no WebRTC (proves the on-chain settle):
npm -w @casper-webrtc/example-paid-api run server   # terminal 1
npm -w @casper-webrtc/example-paid-api run client   # terminal 2 → 402 → pays → 200 + tx hash

# The flagship streaming app:
npm run dev          # signaling + provider(:3000) + consumer(:3002)
```

Install into your own app:

```bash
npm i @nickthelegend69/webrtc-payment-sdk-core @nickthelegend69/webrtc-payment-rail-x402
```

## Honest status (what's verified vs in-progress)

**Verified live:** on-chain settlement (the two txs above), the paid-API drop-in
flow end-to-end, the pay-per-second streaming demo, both npm packages installable,
40/40 tests, the deployed CEP-18 token.

**In progress / not fully verified:** CSPR.click live wallet signing is wired but
not yet confirmed against a real wallet on camera (the demo uses a testnet hot key,
which is proven); free TURN relay can be flaky on restrictive networks; the promo
video's karaoke timing is synthesized (close, not Whisper-perfect).

## What's next

- Verify CSPR.click real-wallet signing end-to-end; production TURN.
- Mainnet token + a hosted facilitator-key proxy.
- Agent SDK examples (an autonomous agent paying per call) and a paid-MCP server.

## Why it fits the Agentic Buildathon

The agent economy needs **machine-payable money rails**. x402 is HTTP-native
pay-per-use, and this is the first **battle-ready x402 SDK on Casper** — published,
on-chain-proven, and droppable into any app or agent. WebRTC pay-per-second
streaming is just the first thing we built on it.

---

_Team: @nickthelegend · Built for the Casper Agentic Buildathon 2026._
