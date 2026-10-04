---
format: 1920x1080
message: "Fund402 + Clawback — the credit & settlement layer for the machine economy"
arc: PAS → second mechanism → CTA (hook → problem → Fund402 → live proof → yield → bridge → Clawback → stack → CTA)
audience: developers building autonomous AI agents on Casper
music: minimal electronic premium-fintech underscore — confident, restrained, low-hype, ~90 bpm, no drops
voice: HeyGen — calm, assured, low-hype narrator
language: en
mix: voice 100% · bgm 5% · sfx 20% (transition clicks/whooshes only — not on every element)
---

## Video direction

Dark near-black (`#07070A`), 1px hairline grid under everything, ONE accent (mint `#22E0A6`)
used only for the active word / a code keyword / an active node / one emphasised number / the
karaoke word. Inter (display+body) + JetBrains Mono (code+data+chrome). Motion is calm and
precise, paced to the voice — short power3/power4 reveals, hairlines draw on, the accent
arrives on the beat. No bounce-heavy or loud motion. The two halves (Fund402 → Clawback)
share the exact same system so the transition at Frame 6 reads as one continuous film, not a
split. Karaoke captions lower-third: active word = near-black text on a mint block.

**Audio mix:** narration at full level; BGM (premium-fintech underscore) at ~5%; a few
transition SFX only (a soft click/whoosh on the major cuts, a quiet "tick" on the 402, the
200-OK, the release, and the clawback) at ~20% — never a sound per element.

---

## Frame 1 — Hook

- scene: "A new kind of software is online." — kinetic statement, agents that pay as they go
- duration: 9s
- src: compositions/frames/01-hook.html
- transition_in: cut
- status: animated
- blueprint: kinetic-statement / cold-open (confirm in Step 4)
- voiceover: "A new kind of software is online — agents that act on their own. And to do almost anything, they have to pay."
- asset_candidates: invented (kinetic type; faint agent/endpoint glyphs on the grid)
- note: open on near-black + the hairline grid resolving; the word "pay" takes the accent as it lands.

## Frame 2 — The problem (402)

- scene: An agent request returns `402 PAYMENT REQUIRED`; wallet reads 0.00; the agent stalls
- duration: 11.2s
- src: compositions/frames/02-problem.html
- transition_in: cut
- status: animated
- blueprint: problem-reveal / terminal-readout (confirm in Step 4)
- voiceover: "But the moment an agent's wallet is empty, it stops. The server returns a four-oh-two — payment required — and there's no credit card for a machine."
- sfx: soft ui click as the 402 stamps in
- asset_candidates: invented (request card: GET → 402; wallet chip 0.00)
- note: 402 is the only red-adjacent moment — but stays mint-free; the stall is shown by a dimming, not color.

## Frame 3 — Fund402 (the two functions)

- scene: "Two functions." server `paywall()` + client `fund402Fetch()`, side by side
- duration: 8.5s
- src: compositions/frames/03-code.html
- transition_in: wipe-up (the 402 lifts away to reveal the fix)
- status: animated
- blueprint: code-reveal / split-pane (confirm in Step 4)
- voiceover: "Fund402 fixes that with two functions: a paywall on your server, and one fetch on the agent."
- sfx: soft whoosh on the wipe
- asset_candidates: invented (two hairline code surfaces; accent on the keywords paywall / fund402Fetch only)
- note: code types/reveals paced to the line; exactly one keyword per card carries the accent.

## Frame 4 — The live flow (borrow → settle → serve)

- scene: agent (0 balance) → 402 → pool fronts → settled on Casper → 200 OK + data, with the real receipt
- duration: 12.5s
- src: compositions/frames/04-flow.html
- transition_in: cut
- status: animated
- blueprint: pipeline / left-to-right flow (confirm in Step 4)
- voiceover: "The agent calls with an empty wallet. A liquidity pool fronts the payment, settles it on Casper, and the data comes back — two hundred, OK. Every hash you see is real."
- sfx: soft click when 200 OK lands
- asset_candidates: invented (4 hairline nodes + drawn connectors; receipt: deploy 96f30ddf…, status processed; the active node/edge takes the accent as the pulse moves)
- note: the accent travels with the payment — only the active node is mint at any instant.

## Frame 5 — The pool earns (yield)

- scene: deposit 2,000,000 → withdraw 2,050,000 (+2.5%); 5% fee → LP yield; `repay_latest()`
- duration: 8.5s
- src: compositions/frames/05-yield.html
- transition_in: cut
- status: animated
- blueprint: stat-readout / number-climb (confirm in Step 4)
- voiceover: "Each borrow pays a small fee, and that fee flows back to the providers. The pool quietly compounds."
- asset_candidates: invented (a thin pool bar that grows; the +2.5% figure is the one accent)
- note: understated; only the yield delta (+50,000 / +2.5%) is mint.

## Frame 6 — The bridge (credit in → protection out)

- scene: "Credit gets an agent paid in." → a question forms: what protects the payment? Clawback shield resolves
- duration: 8.1s
- src: compositions/frames/06-bridge.html
- transition_in: crossfade (continuous — NOT a hard part-two split)
- status: animated
- blueprint: pivot / question-to-reveal (confirm in Step 4)
- voiceover: "Credit gets an agent paid in. But when one agent pays another, what protects the money if the work is wrong?"
- sfx: soft whoosh as the shield/word "Clawback" resolves
- asset_candidates: invented (the line "paid in" stays; a hairline shield draws on; the word Clawback takes the accent)
- note: same grid, same system — the camera just turns to the other half. No logo wall, no reset.

## Frame 7 — Clawback (escrow → AI verifier → release | clawback)

- scene: buyer escrows (HELD 1,000,000) → seller delivers → AI verifier → RELEASE (seller paid) OR DISPUTE → REFUND (clawed back)
- duration: 13.3s
- src: compositions/frames/07-clawback.html
- transition_in: cut
- status: animated
- blueprint: decision-tree / dual-path (confirm in Step 4)
- voiceover: "Clawback holds the payment in escrow. An AI verifier checks the delivery against the spec — good work is released to the seller; bad work is disputed, and clawed back to the buyer."
- sfx: soft click on release, soft click on the clawback
- asset_candidates: invented (buyer · escrow HELD · AI verifier nodes; two branches — release / refund; real proofs open 02bfd9cf… release 87a30923… · dispute 0106f5e0… resolve f6f6c5db…; accent marks only the active verdict/branch)
- note: the AI verdict is the hero; the accent moves to whichever branch is active.

## Frame 8 — The stack

- scene: "One install." SDK · Agent · MCP · Skills · Clawback — 8 open-source repos, live on casper-test
- duration: 9s
- src: compositions/frames/08-stack.html
- transition_in: cut
- status: animated
- blueprint: feature-row / inventory (confirm in Step 4)
- voiceover: "It's one install: the SDK, an agent, an MCP server, skills, and Clawback — all live on Casper."
- sfx: soft click as the five chips settle in
- asset_candidates: invented (5 hairline chips on a thin spine; `npm i @nickthelegend69/fund402`; accent only on the active chip during the sweep)
- note: chips reveal in time with the inventory list in the VO.

## Frame 9 — CTA

- scene: Fund402 + Clawback lockup · "the credit & settlement layer for the machine economy" · npm + github
- duration: 9.9s
- src: compositions/frames/09-cta.html
- transition_in: crossfade
- status: animated
- blueprint: logo-cta / end-card (confirm in Step 4)
- voiceover: "Fund402, and Clawback. The credit and settlement layer for the machine economy."
- asset_candidates: invented (two marks — Fund402 bolt-in-chip + Clawback shield; `npm i @nickthelegend69/fund402` · github.com/nickthelegend; accent on the install command)
- note: hold calm; the install line is the single accent; fade BGM out under the last phrase.
