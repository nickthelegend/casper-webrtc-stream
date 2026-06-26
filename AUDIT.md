# Project Audit — casper-webrtc-stream

_Casper Agentic Buildathon 2026 · honest completion + path-to-win assessment_

## TL;DR

A working, **real on-chain** x402 micropayment-gated WebRTC streaming SDK with two
published npm packages, three demo apps, a deployed CEP-18 contract, and live
testnet settlements. The **engineering is strong (~85%)**. The gap to *winning* is
not more code — it's **the agentic story and the pitch**: this is an *Agentic*
buildathon, and the headline feature (an AI agent that autonomously pays to watch)
exists in code but hasn't been demonstrated live, and there's no demo video.

**Overall completion: ~80%.** Engineering ~85%, "win-readiness" ~60%.

---

## What's verified working (not claims — observed)

| Capability | Evidence |
|-----------|----------|
| Pay-per-second WebRTC stream, browser↔browser | Live demo: Big Buck Bunny streamed, 3 on-chain settlements |
| Real x402 settle through the server | tx `448eafae…2c2c15`, **SUCCESS**, block 8308737 |
| Live facilitator `/verify` → `valid:true` | Isolated test of published packages |
| CEP-18 x402 token deployed | package `3931f6de…0687b` on testnet |
| EIP-712 `TransferWithAuthorization` correct | facilitator accepts the signature |
| 33/33 unit/integration tests pass | `npm test` |
| Both SDK packages published + installable | `@nickthelegend69/webrtc-payment-{sdk-core,rail-x402}@0.1.1` |
| Provider + consumer apps build clean | `next build` ✓ both |
| Premium UI | redesigned provider studio + viewer |

---

## Component-by-component

| Component | State | % | Notes |
|-----------|-------|---|-------|
| Core SDK (`webrtc-payment-sdk-core`) | Solid | 90 | 3 gating modes, events, replay protection, crypto frames. |
| Casper x402 rail | Solid | 90 | Live verify+settle confirmed. |
| CEP-18 x402 contract (Odra) | Deployed + 4/4 contract tests | 80 | wasm build needed a pinned nightly; documented. |
| Provider app (streamer) | Working + premium UI | 85 | Live demo proven. |
| Consumer app (viewer) | Working + premium UI | 85 | Real wallet pill, settlement feed. |
| Signaling server | Working | 80 | In-memory rooms; fine for demo, not multi-instance. |
| **AI-agent consumer example** | **Code only — not run live** | **40** | **The buildathon's whole theme. Highest-leverage gap.** |
| CSPR.click production wallet | Wired, **unverified end-to-end** | 50 | Demo uses a hot key; judges may ask "real wallet?". |
| Docs (READMEs, USAGE, INTEGRATION, ONCHAIN) | Strong | 90 | Just expanded. |
| Demo video / pitch deck | **Missing** | 0 | Judges often score from the video first. |
| Tests | Good unit coverage | 70 | No automated browser E2E (hard; manual proof exists). |

---

## Path to win — ranked by impact

### P0 — do these or you can't win an *agentic* hackathon
1. **Make the AI-agent consumer run live.** `examples/ai-agent-stream` already
   has the headless Node consumer. Get it to actually join a stream, auto-pay N
   segments, and settle on-chain — then capture the terminal + the cspr.live
   txs. *This is the differentiator:* "an autonomous agent that pays per second
   for data it consumes." Effort: ~half a day.
2. **Record a 2–3 min demo video.** Provider goes live → human viewer pays per
   second → **then an AI agent joins and pays autonomously** → show the on-chain
   settlements ticking up on testnet.cspr.live. Effort: a few hours.

### P1 — strongly differentiating
3. **Verify CSPR.click signing end-to-end** with a real wallet (not the hot
   key), even just once on camera. Removes the biggest "is it real?" doubt.
4. **One-command demo** (`npm run demo`) that boots signaling + provider +
   consumer so judges can run it in 30 seconds. (`npm run dev` exists; wrap +
   document it with a seeded `.env`.)
5. **Tighten the pitch narrative** in the top-level README: lead with the
   agentic use-case (agents paying for streamed data / inference / RTC), not the
   plumbing. Add the architecture diagram + the live tx links as proof.

### P2 — polish that wins close calls
6. **Robustness guards:** friendly error when token `name`/env missing (today it
   surfaces `invalid_exact_casper_missing_token_name`); reconnect on signaling
   drop; surface settle failures in the UI.
7. **Swap the free TURN relay** for a reliable one (openrelay can flake mid-demo
   — a dead demo loses). Or run a 5-line coturn.
8. **A basic browser E2E** (Playwright two-context) so "it works" is reproducible.
9. **Mainnet note / cost story:** state gas per settle (~6 CSPR observed) and how
   batching/segment length controls cost — shows you understand economics.

### P3 — nice to have
10. Multi-viewer load demo; analytics panel; mobile viewport pass; unpublish/
    rotate the leaked npm + GitHub tokens after the event.

---

## Risks to a live demo

- **TURN flakiness** → connection fails on judges' network. (P2 #7)
- **Casper finality 30–60s** → keep segments ≥10s so settles don't pile up (already tuned to 15s).
- **Hot key in browser** → fine for testnet demo, but call it out as demo-only.
- **Single signaling instance** → don't scale-test on stage.

---

## Bottom line

The hard, risky part — real on-chain x402 micropayments wired into live WebRTC —
is **done and proven**. To win, stop polishing plumbing and **show the agent
paying autonomously, on video, with the on-chain proof on screen.** That single
deliverable converts a strong technical project into a winning *agentic* one.
