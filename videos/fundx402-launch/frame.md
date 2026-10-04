---
version: 1
name: Fund402 + Clawback — Frame (dark fintech)
description: >
  Dark, near-black premium-fintech frame system for the Fund402 + Clawback launch. ONE
  accent (mint #22E0A6) used only as scarce voltage — the active word, a code keyword, an
  active node/edge, a single emphasised number, the karaoke active word. Structure is drawn
  with 1px hairlines over a faint grid; no heavy shadows. Inter for display+body, JetBrains
  Mono for code/data/chrome. Premium, clean, kinetic, low-hype.
unit: the frame — 1920×1080
principle: near-black canvas · one accent, rationed · hairline elevation · every number is real

colors:
  canvas:     "#07070A"
  surface:    "#0E0F13"
  surface-2:  "#14161B"
  ink:        "#F4F5F7"
  muted:      "#8A8FA0"
  dim:        "#4A4E5C"
  line:       "#1C1F26"
  accent:     "#22E0A6"
  accent-ink: "#06160F"

borders:
  hairline: "1px solid #1C1F26"
  grid:     "1px solid rgba(255,255,255,0.04)"
shadows:
  none: "none"
  lift: "0 24px 60px rgba(0,0,0,0.5)"

typography:
  display:  { fontFamily: "Inter", weight: 900, lineHeight: 1.0,  tracking: "-0.03em" }
  headline: { fontFamily: "Inter", weight: 800, lineHeight: 1.05, tracking: "-0.02em" }
  lead:     { fontFamily: "Inter", weight: 500, lineHeight: 1.4 }
  body:     { fontFamily: "Inter", weight: 400, lineHeight: 1.5 }
  kicker:   { fontFamily: "JetBrains Mono", weight: 600, tracking: "0.22em", upper: true }
  code:     { fontFamily: "JetBrains Mono", weight: 500, lineHeight: 1.55 }
  data:     { fontFamily: "JetBrains Mono", weight: 700 }
  caption:  { fontFamily: "Inter", weight: 700, lineHeight: 1.25, tracking: "-0.01em" }

spacing:
  frame-pad: "80px"
  grid-cell: "64px"
  radius-sm: "8px"
  radius-md: "14px"
  radius-pill: "9999px"
  hairline: "1px"

components:
  grid-bg:      "1px hairline grid (rgba white 4%), 64px cells, radial-masked to fade at edges"
  card:         "surface fill + 1px hairline (line), radius-md, no shadow (one hero card per frame may use lift)"
  chip:         "surface-2 + 1px hairline, radius-pill, JetBrains Mono label"
  code-surface: "surface-2 fill, 1px hairline, JetBrains Mono; syntax in ink/muted with accent on keywords ONLY"
  flow-node:    "card + mono kicker + title; connectors are 1px lines that draw on; the active node/edge takes the accent"
  accent-rule:  "accent touches exactly ONE element per beat; never a large fill, never two things at once"
---

# Fund402 + Clawback — Frame system

Dark, technical, premium-fintech. The frame is near-black; structure is drawn with 1px
hairlines and a faint 64px grid; the single mint accent is **scarce voltage** — it touches
only the one thing that matters in a beat (the active word, a keyword in code, an active
node, a number being emphasised, the karaoke word). Everything else is ink / muted / hairline.

## The frame
1920×1080, ~80px padding. A faint 64px hairline grid sits under everything, masked to fade
at the edges. Content lives on hairline-bordered cards/nodes — no heavy shadows (one soft
`lift` is allowed on a single hero card per frame, never stacked).

## Type
Inter carries display→body (900 hooks, 800 headlines, 500 lead, 400 body). JetBrains Mono
carries the technical voice: mono kickers (eyebrows, 0.22em UPPER), code, and data (numbers,
deploy hashes, read-outs). Sentence case for headlines; UPPER only for mono kickers.

## Colour discipline (the one rule)
ONE accent — mint `#22E0A6` — rationed. It may touch: the active word in a kinetic line, the
highlighted keyword in a code snippet, the active node/edge in a flow, a single emphasised
number, and the karaoke active word. It is **never** a background wash and never applied to
two things at once in the same beat. Success/active reads mint; everything structural is
hairline + muted.

## Motion intent
Calm and precise, paced to the voice. Reveals are short and confident (power3/power4),
hairlines draw on, the accent arrives on the beat. No bounce-heavy or loud motion — low-hype
premium.

## Karaoke captions
Lower-third, one line at a time. Base words sit in muted ink; the **active word is near-black
text (`accent-ink`) on a mint (`accent`) block** — never white-on-accent; spoken words settle
to full ink.
