# skills/

Downloaded reference skills for building casper-webrtc-stream on-chain. These
were fetched from their official sources and saved here so the code and docs
stay grounded in real APIs (not guesses).

| Skill | What it covers | Source |
|-------|----------------|--------|
| `cspr-cloud/` | CSPR.cloud REST/Streaming/Node APIs, auth, pagination | cspr.cloud/skill.md |
| `cspr-click/` | Wallet connect + signing in the browser (incl. x402) | docs.cspr.click |
| `casper-x402/` | Facilitator /verify + /settle, payload shapes, EIP-712 | docs.cspr.cloud + make-software/casper-x402 |
| `odra/` | Writing/deploying Casper contracts in Rust (CEP-18) | odra.dev/llms.txt |

## Note on "installing" skills

`claude skill install cspr-click` registers a skill in your **Claude
environment** — it's done from the Claude Code CLI or **Cowork → Settings →
Capabilities**, not from inside a chat session. The files here are the *content*
of those references saved into the repo so they travel with the project and can
be cited while coding. To make them first-class Claude skills, add them via
Settings → Capabilities (or your plugin marketplace).
