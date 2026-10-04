---
format: 1920x1080
message: "HTTP-native money on Casper — charge per call, settle on-chain, in one line."
arc: Hook → Problem → Solution → Server → Client → Proof → Close
audience: hackathon judges + developers (Casper Agentic Buildathon 2026)
music: calm, warm, minimal ambient tech — soft pulse, low synth pad, unhurried
---

## Frame 1 — Hook

- type: hook
- persuasion: name the category in three words; premium cold open
- beat: intrigue, calm confidence
- scene: Wordmark "casper-webrtc-stream" fades up on deep navy; a faint "402" watermark breathes behind it; one violet underline draws in
- duration: 6s
- poster: 4s
- transition_in: fade
- status: outline
- voiceover: "This is casper-webrtc-stream — HTTP-native money, settled on Casper."
- src: compositions/frames/01-hook.html

The thesis, stated quietly. Deep-navy, one violet voltage line. Everything after pays this off.

## Frame 2 — The problem

- type: pain_point
- persuasion: agitate a real, known gap (micropayments)
- beat: recognition, mild friction
- scene: A row — "per API call", "per second", "per request" — each tagged ✗ against a fading credit-card glyph; a small agent node blinks, unpaid
- duration: 7s
- transition_in: crossfade
- status: outline
- voiceover: "Apps and agents need to pay per call. Card rails can't. Crypto checkout is clunky."
- src: compositions/frames/02-problem.html

The pain: there's no clean pay-per-use money rail in HTTP. Keep it muted, restrained — the problem isn't loud, it's everywhere.

## Frame 3 — The solution (x402)

- type: product_intro
- persuasion: name the mechanism; make it feel inevitable
- beat: clarity, "oh, that's elegant"
- scene: Three nodes light in sequence — 402 Payment Required → pay → retry → 200 — a request dot travels the path; two npm package chips settle below
- duration: 6s
- transition_in: crossfade
- status: outline
- voiceover: "x402 fixes it. The server asks for payment, the client pays, the request retries."
- src: compositions/frames/03-x402-flow.html

The reveal of the protocol loop. The dot completing the path is the hero motion. Violet for the request, green when it resolves to 200.

## Frame 4 — Server, one line

- type: feature_showcase
- persuasion: show the effort cost is ~zero (one line gates a route)
- beat: "that's it?"
- scene: A dark code card; `app.get("/premium", paymentMiddleware({ rail, amount, payTo }), handler)` types/settles in; the `paymentMiddleware(...)` token underlines in violet
- duration: 7s
- transition_in: crossfade
- status: outline
- voiceover: "Gate any route in one line — paymentMiddleware."
- src: compositions/frames/04-server.html

JetBrains Mono, real code, syntax-restrained. One token glows — the whole pitch is that single call.

## Frame 5 — Client, one line

- type: feature_showcase
- persuasion: symmetry — the client side is just as small; the 402 "disappears"
- beat: satisfaction
- scene: Second code card; `const pay = wrapFetch(fetch, { rail, signFn })` then `await pay("/premium")`; a "402" chip rises and dissolves into a green "200"
- duration: 6s
- transition_in: crossfade
- status: outline
- voiceover: "Pay automatically with one wrapped fetch. The 402 just disappears."
- src: compositions/frames/05-client.html

The 402→200 dissolve is the beat. Calm, slow fade — the friction evaporating.

## Frame 6 — Proof, on-chain

- type: social_proof
- persuasion: it's real money, on a real chain, verifiable
- beat: trust, weight
- scene: Two settlement cards slide in — tx 448eafae… ✓ block 8308737, tx 3e04ec4e… ✓ block 8309369 — green checks, "CEP-18 transfer_with_authorization · CSPR.cloud", a cspr.live tag
- duration: 8s
- transition_in: crossfade
- status: outline
- voiceover: "Every payment is real — a CEP-18 transfer, settled on-chain, confirmed in seconds."
- src: compositions/frames/06-proof.html

The credibility frame. Real testnet tx hashes, real blocks. Green = confirmed. Let it hold longer; this is the proof judges remember.

## Frame 7 — Close

- type: cta
- persuasion: name + install + the one-line positioning
- beat: resolve, aspiration
- scene: Wordmark returns centered; `npm i @nickthelegend69/webrtc-payment-sdk-core` on a mono line; tagline "The payment rail for the agent economy — on Casper" fades up
- duration: 5s
- transition_in: crossfade
- status: outline
- voiceover: "casper-webrtc-stream. The payment rail for the agent economy. On Casper."
- src: compositions/frames/07-close.html

Land on the name and the install line. Quiet, confident, premium. One violet voltage, then fade.
