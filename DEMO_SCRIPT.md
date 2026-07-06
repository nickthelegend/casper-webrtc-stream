# Demo Recording Script — casper-webrtc-stream

A ~2.5–3 minute **screen recording** that proves it's real. Each shot has **SCREEN**
(what to show + do) and **SAY** (the narration — speak it, or run it through TTS and
lay it under the recording).

> **Golden rule:** the on-chain proof is the anchor. Whatever else flakes, land the
> `402 → pay → 200 + a real tx on cspr.live`.

---

## ⏱ Pre-flight checklist (do this BEFORE you hit record)

1. **Start the stack** and leave it running:
   ```bash
   npm install
   npm run dev          # signaling + provider :3000 + consumer :3002
   ```
2. **Test the paid-API once** (so you know it settles today):
   ```bash
   npm -w @casper-webrtc/example-paid-api run server   # terminal A
   npm -w @casper-webrtc/example-paid-api run client   # terminal B → expect a tx hash
   ```
3. **Open these tabs** ahead of time (so you're not waiting on camera):
   - npm: the two `@nickthelegend69/...` package pages
   - `https://testnet.cspr.live` (ready to paste a deploy hash)
   - provider `http://localhost:3000`, consumer `http://localhost:3002`
4. **Wallet/keys:** use the proven **testnet hot-key** path for the recording (it just
   works). Only show CSPR.click connect if you've tested it succeeds end-to-end.
5. **Big terminal font**, dark theme, 1080p+ capture, hide secrets (don't show `.env`).
6. Have **`videos/casper-launch/renders/casper-launch.mp4`** ready — optional cold-open.

---

## 🎬 The flow (record in this order)

### 0 · Cold open (optional, 5s)
**SCREEN:** Play the first ~5s of the promo (`casper-launch.mp4`) — the `402` monogram + wordmark — then cut to your screen.
**SAY:** *(none — let the promo title land)*

### 1 · The hook (0:00–0:15)
**SCREEN:** The GitHub repo page (or the npm package pages).
**SAY:**
> "This is casper-webrtc-stream — an x402 micropayments SDK for Casper. It lets any app charge per call, or per second, and settle it on-chain."

### 2 · The problem (0:15–0:30)
**SCREEN:** Stay on the repo / a slide. Gesture at the README one-liner.
**SAY:**
> "Apps and AI agents need to pay per use — per request, per second. Card rails can't do micropayments, and crypto checkout is clunky. HTTP has no money rail. x402 is that rail."

### 3 · It's shipped (0:30–0:45)
**SCREEN:** The two npm pages — `webrtc-payment-sdk-core` and `webrtc-payment-rail-x402`, both `0.2.1`.
**SAY:**
> "It's two published npm packages — framework-agnostic. One for the HTTP payment layer, one for the Casper settlement rail."

### 4 · Drop it into any app — THE money shot (0:45–1:30)
**SCREEN:**
- Split or switch to two terminals.
- Terminal A: `npm -w @casper-webrtc/example-paid-api run server` → "listening on :4021".
- Briefly show the server file: the **one line** — `app.get("/premium", paymentMiddleware({ rail, amount, payTo }), handler)`.
- Terminal B: `npm -w @casper-webrtc/example-paid-api run client`.
- Let the output land: `← 402 Payment Required → paying…` then `→ status: 200`, the unlocked content, and **`settledTx: 3e04ec4e…`**.
- **Copy that tx hash → paste into `testnet.cspr.live` → show SUCCESS**, the CEP-18 transfer, the block.
**SAY:**
> "Here's the whole integration. On the server, one middleware gates a route. On the client, one wrapped fetch. Watch — the client hits the endpoint, gets a 402, signs the payment, retries, and gets a 200 with the content. And that payment is real: a CEP-18 transfer, settled on Casper testnet. Here it is on the explorer — confirmed, on an actual block."

### 5 · The flagship: pay-per-second streaming (1:30–2:20)
**SCREEN:**
- Provider studio `http://localhost:3000` (the premium dark UI). Show price `0.01 CSPR/s`, source **Big Buck Bunny**, gating **Track**. Click **Go Live**.
- Click **Copy link**. Open the consumer `http://localhost:3002/?room=…`.
- Connect the wallet (or the hot key) → **Start watching**. The video plays.
- Point at the **⛓ On-chain settlements** feed ticking up (one tx per ~15s segment) and the gold **earnings** counter rising.
- Click a settlement → it opens on `testnet.cspr.live`.
**SAY:**
> "And here's a real app built on the rail — pay-per-second video streaming. The creator goes live, the viewer starts watching, and every segment they watch settles on-chain — the creator gets paid directly, per second, no platform, no thirty-percent cut. Each of these is a real transaction on Casper."

### 6 · Close (2:20–2:40)
**SCREEN:** Back to the close frame / install line `npm i @nickthelegend69/webrtc-payment-sdk-core`, or the cspr.live list of settlements.
**SAY:**
> "Real on-chain micropayments, in one line. Two published packages, framework-agnostic — any rail, any app, any agent. casper-webrtc-stream: the payment rail for the agent economy, on Casper."

---

## 🛟 If the streaming demo flakes (TURN/WebRTC)
Cut Act 5 and **lead harder on Act 4** (paid-API + cspr.live) — that's the proof that
matters and it's deterministic. You can mention streaming verbally over the on-chain
settlements list. Never let a flaky WebRTC connection eat your demo.

---

## 🎙 Full narration (for TTS — paste straight in)

> This is casper-webrtc-stream — an x402 micropayments SDK for Casper. It lets any app charge per call, or per second, and settle it on-chain.
>
> Apps and AI agents need to pay per use — per request, per second. Card rails can't do micropayments, and crypto checkout is clunky. HTTP has no money rail. x402 is that rail.
>
> It's two published npm packages, framework-agnostic. One for the HTTP payment layer, one for the Casper settlement rail.
>
> Here's the whole integration. On the server, one middleware gates a route. On the client, one wrapped fetch. The client hits the endpoint, gets a four-oh-two, signs the payment, retries, and gets a two hundred with the content. And that payment is real — a CEP-18 transfer, settled on Casper testnet. Here it is on the explorer, confirmed on an actual block.
>
> And here's a real app built on the rail — pay-per-second video streaming. The creator goes live, the viewer starts watching, and every segment they watch settles on-chain. The creator gets paid directly, per second — no platform, no thirty-percent cut. Each of these is a real transaction on Casper.
>
> Real on-chain micropayments, in one line. Two published packages, framework-agnostic — any rail, any app, any agent. casper-webrtc-stream: the payment rail for the agent economy, on Casper.

_(~150 words ≈ ~75–90s of calm VO; the rest of the 2.5–3 min is screen action + pauses. If you want it tighter, drop Act 2 or Act 3.)_

---

## TTS tip
You already have the local Kokoro voice wired:
```bash
npx hyperframes tts "‹paste a paragraph›" --voice bm_george -o vo.wav
```
Record each paragraph to its own file and lay them under the matching shot, or just
speak it live — low-hype, calm, let each line land.
