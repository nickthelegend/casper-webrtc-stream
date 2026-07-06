---
format: 1920x1080
message: "HTTP-native money on Casper — charge per call, settle on-chain, in one line."
arc: Hook → Problem → How it works (x402 flow) → 3 features (one-line · on-chain · packages) → CTA
audience: hackathon judges + developers (Casper Agentic Buildathon 2026)
music: "minimal electronic, premium fintech — confident, restrained, low synth pad, soft pulse, unhurried"
captions: "karaoke — active word is dark ink on a solid violet (#8b6cff) block; inactive words muted light on transparent"
notes: "Continuous arc — the problem half flows into the how/proof half; no hard split. BGM ~5%, SFX ~20% and ONLY soft UI ticks/clicks on transitions + the 402/200 beats."
---

## Frame 1 — Hook

- src: compositions/frames/01-hook.html

- type: hook
- persuasion: name the category in one calm line; premium cold open
- beat: intrigue, quiet confidence
- scene: Deep-navy, hairline grid. Violet "402" monogram springs in; wordmark "casper-webrtc-stream" reveals; a violet underline draws; mono kicker "x402 micropayments · settled on Casper"
- duration: 5.632s
- transition_in: fade
- sfx: tick-soft
- voiceover: "This is casper-webrtc-stream — HTTP-native money, settled on Casper."
- status: outline

The thesis, stated quietly. One violet voltage. Everything pays this off.

## Frame 2 — The problem

- src: compositions/frames/02-problem.html

- type: pain_point
- persuasion: agitate a real, known gap — micropayments don't exist in HTTP
- beat: recognition
- scene: "per request · per second · per call" tick in, each tagged ✗ against a dimming credit-card glyph; a small unpaid agent node blinks
- duration: 7.531s
- transition_in: crossfade
- sfx: tick-soft
- voiceover: "Apps and agents need to pay per call — per request, per second. Card rails can't. Crypto checkout is clunky."
- status: outline

The pain is everywhere, not loud. Restrained, muted — then violet enters with the fix.

## Frame 3 — How it works (the x402 flow)

- src: compositions/frames/03-flow.html

- type: product_intro
- persuasion: make the mechanism feel inevitable and elegant
- beat: clarity — "oh, that's clean"
- scene: CLIENT ⇄ SERVER ⇄ CASPER diagram. A violet packet travels GET → 402 (gold) → sign EIP-712 → retry with X-PAYMENT → settle on-chain (tx 448eafae…) → 200 (green); client flips to "unlocked"
- duration: 13.461s
- transition_in: crossfade
- sfx: click-402, click-200
- voiceover: "x402 makes payment part of HTTP. The server asks for payment, the client signs and retries, and the server settles it on-chain — a real token transfer, confirmed in seconds."
- status: outline

The core. The traveling packet completing the loop is the hero motion. This is the longest beat — let the flow breathe. A soft click on the 402 and on the 200 confirm; nothing else.

## Frame 4 — Feature 1 · one line each

- src: compositions/frames/04-code.html

- type: feature_showcase
- persuasion: the effort cost is ~zero
- beat: "that's it?"
- scene: server.ts + client.ts code cards SIDE BY SIDE; SDK imports lead (package names glow), then paymentMiddleware (server) and wrapFetch (client) highlight violet; a "// 402 → // 200 OK" red→green dissolve
- duration: 9.877s
- transition_in: crossfade
- sfx: tick-soft
- voiceover: "Integrating it takes one line each. paymentMiddleware gates any route on the server. wrapFetch pays automatically on the client. Drop it into any app."
- status: outline

Real code, JetBrains Mono. The imports are the cool focal point. One token glows per card.

## Frame 5 — Feature 2 · real on-chain

- src: compositions/frames/05-proof.html

- type: social_proof
- persuasion: it's real money on a real chain, verifiable
- beat: trust, weight
- scene: Two green "Confirmed" settlement cards slide in — tx 448eafae… block 8308737, tx 3e04ec4e… block 8309369; "0.20 CSPR settled · 2 settlements"; testnet.cspr.live + CSPR.cloud facilitator tags
- duration: 9.813s
- transition_in: crossfade
- sfx: confirm-soft
- voiceover: "Every payment is real, and verifiable. These are live settlements on Casper testnet — actual CEP-18 transfers, on actual blocks."
- status: outline

The credibility frame. Real tx hashes, real blocks. Green = confirmed. Hold a beat longer.

## Frame 6 — Feature 3 · the packages

- src: compositions/frames/06-packages.html

- type: feature_showcase
- persuasion: it's shipped, framework-agnostic, reusable
- beat: substance
- scene: Two npm package chips settle in — @nickthelegend69/webrtc-payment-sdk-core + …-rail-x402; small orbiting labels "any rail · any app · any agent"; a faint "npm" mark
- duration: 5.483s
- transition_in: crossfade
- sfx: tick-soft
- voiceover: "Two published packages. Framework-agnostic. Any rail, any app, any agent."
- status: outline

Brief, confident. Proof it's a real product, not a demo.

## Frame 7 — Close / CTA

- src: compositions/frames/07-cta.html

- type: cta
- persuasion: name + install + positioning
- beat: resolve
- scene: Monogram + wordmark center; "npm i @nickthelegend69/webrtc-payment-sdk-core" mono line reveals; tagline "The payment rail for the agent economy — on Casper" fades up; gentle fade to near-black
- duration: 5.248s
- transition_in: crossfade
- sfx: tick-soft
- voiceover: "casper-webrtc-stream. The payment rail for the agent economy — on Casper."
- status: outline

Quiet, premium landing. One violet voltage, then fade.
