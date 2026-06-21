# STATUS — what's real, what's mocked, what's left

Honest accounting. No spin.

## TL;DR

The **WebRTC streaming + gating engine is real and tested**. The **payment
layer is now wired to the real CSPR.cloud x402 facilitator API and the official
`@casper-ecosystem/casper-eip-712` typed-data package, and the EIP-712 digest is
now matched byte-for-byte to the facilitator's own verifier and verified
cryptographically offline** (`npm run test:signing` builds a payload and checks
the ed25519 signature against a digest recomputed exactly the way the facilitator
recomputes it). What is still **not** validated is the *live network round-trip*
(`/verify` → `/settle` → on-chain), because that needs a CSPR.cloud API key, a
deployed CEP-18 x402 token, and a funded payer — external resources only you can
provide. See [ONCHAIN.md](./ONCHAIN.md).

### 2026-06-21 correction (important)

A prior pass described the signing as "spec-correct, unverified." That was
generous: cross-checked against `make-software/casper-x402`'s reference client
**and** facilitator, the digest was actually **spec-WRONG** in three ways, each
of which alone causes `invalid_signature`. All three are now fixed:

| Bug (was) | Now | Source of truth |
|-----------|-----|-----------------|
| Primary type `TransferAuthorization` + snake_case `valid_after`/`valid_before` (from the npm package's default export) | `TransferWithAuthorization` + camelCase `validAfter`/`validBefore` (facilitator's inline types) | `exact/facilitator/scheme.ts` L38-47, L282-299 |
| `from`/`to` hashed as bare `0x`+64hex (32-byte) | `0x`+`00`+64hex (33-byte "00"-tagged account hash) | facilitator `"0x" + payer` |
| `validAfter = now` (rejectable as `not_yet_valid` under clock skew) | `validAfter = now - 600` | reference client `exact/client/scheme.ts` |

Also fixed: the monorepo **did not compile** — the rail's `tsconfig` resolved
the core package to its source, breaking `tsc` (TS6059). Removed the bad `paths`
override; `npm run build` is now green and `npm test` + `npm run test:signing`
pass.

### 2026-06-21 (later): the four remaining items

| Item | Status | Proof |
|------|--------|-------|
| Mode 3 crypto gate | **Wired E2E + verified offline** | `npm run test:crypto` (frame opaque without key → key-on-pay recovers → rotated key locks out non-payer) |
| CSPR.click prod signing | **Written to the official pattern** | `apps/consumer/lib/csprclick-signer.ts` mirrors make-software's `csprclick-x402` `signTypedData` (raw digest, no wrapping); needs a live wallet to validate |
| Odra CEP-18 x402 contract | **Compiles + OdraVM-tested (nightly)** | `cd contracts/cep18-x402 && cargo odra test` → 4/4 (transfer, replay, wrong-signer, expiry) |
| Live testnet round-trip | **Documented hand-off** | [HANDOFF.md](./HANDOFF.md) — needs your API key + token + funds |

Contract scope note: it verifies EIP-712 via the official `casper-eip-712`
crate's **secp256k1** path (OdraVM-tested). The CSPR.cloud *hosted* facilitator
settles a closed-source, **ed25519-native** token, so for that path deploy the
official `Cep18X402.wasm`; this Odra contract is the project's own token / a
template for a self-hosted facilitator. The contract needs **nightly Rust**
(Odra 2.5 macros), pinned via `rust-toolchain.toml`.

## What was mocked before this pass (and is now removed)

| Mock | Where | Status |
|------|-------|--------|
| `verify()` returned `{valid:true}` without calling anything | `CasperX402Rail` DEMO short-circuit | **removed** — now calls the real `/verify` |
| `settle()` returned `demo-tx-…` fake hashes | `CasperX402Rail` DEMO short-circuit | **removed** — now calls the real `/settle` |
| `buildPayload()` returned `demo-sig-…` | `PayloadBuilder` DEMO short-circuit | **removed** — now builds a real EIP-712 signature |
| Invented EIP-712 structure (`domain:{name:"CEP-18"}`, `TransferFrom`) | `PayloadBuilder` | **replaced** with the official `TransferAuthorization` typed data |
| `ethers.SigningKey` (secp256k1/EVM) used for signing | `PayloadBuilder` | **replaced** — Casper uses ed25519/secp256k1 over the EIP-712 digest |
| Hard-coded "Balance: 5.00 CSPR" | consumer `WalletConnect` | **removed** |
| Random fake account hash on "connect wallet" | consumer `WalletConnect` | **removed** — uses the configured account |
| `~$0.05/CSPR` price label | provider `EarningsPanel` | kept but labeled illustrative |

## What is genuinely real and verified (ran in this environment)

- **WebRTC SDK**: provider/consumer peers, per-viewer track cloning, DataChannel
  payment protocol, signaling client/server, heartbeat.
- **Gating engine**: `PaymentGate` accepts a valid segment payment → enables the
  track → rejects a replayed nonce → accumulates earnings. Covered by an
  integration test that actually runs.
- **SessionManager**: deterministic `SHA-256(sessionId:segmentIndex)` nonces +
  replay store. SHA-256 validated against known vectors.
- **Wallet generator**: real Ed25519 keypair + Casper account hash. BLAKE2b-256
  validated against official test vectors. The generated account is fundable.
- All `.ts` type-strip compile; import/export graph consistent.

## What is now VERIFIED offline (this pass, npm reachable)

`@casper-ecosystem/casper-eip-712@1.2.1` is a real published package and its API
matches what the rail uses. `npm install` + `npm run build` succeed. The signing
test (`npm run test:signing`) does a genuine cryptographic check, not a structure
smoke test:

1. **EIP-712 digest correctness** — the digest is rebuilt from the produced
   payload using the *facilitator's exact method* (`TransferWithAuthorization`,
   camelCase fields, `0x00`-tagged addresses, `buildDomain(name, version,
   network, "0x"+asset)`) and the signature verifies against it. Drift in any
   field would fail this test.
2. **ed25519 signature encoding** — 65 bytes (`01` algo prefix + 64-byte sig);
   verified with `crypto.verify` after stripping the prefix.
3. **Account-hash ↔ public-key** — the test derives the Casper account hash
   (`blake2b256("ed25519"+0x00+pubkey)`) and asserts it equals `authorization.from`,
   the same check the facilitator makes.
4. **`/verify` + `/settle` wire shape** — body `{paymentPayload, paymentRequirements}`
   (no top-level `x402Version`), header `authorization: <token>` (not Bearer),
   response shapes — all confirmed against docs.cspr.cloud. The HTTP code matches.

## FULL on-chain micropayment CONFIRMED ✅✅ (2026-06-21)

Ran the complete x402 flow against the real `https://x402-facilitator.cspr.cloud`
on testnet with a live CSPR.cloud API key:

```
GET  /supported → 200 (testnet feePayer 81d557c9…)
POST /verify    → {"valid":true}
POST /settle    → txHash 8ba3f325…   ← on-chain transfer_with_authorization
```

Deployed the official `Cep18X402.wasm` token to testnet
(`scripts/deploy/deploy-token.mjs`, ~595 CSPR gas; package hash
`3931f6de…0687b`, name "Casper X402 Token", v1, 9 decimals), which minted the
initial supply to the payer. `/settle` then moved tokens payer→payee:

- settle deploy `8ba3f325…3515f0` executed in block **8254405**, **errorMessage: NONE**
- the token contract verified our EIP-712 signature **on-chain** and transferred
- gas paid by the facilitator's feePayer (~2.7 CSPR), payer paid nothing
- explorer: https://testnet.cspr.live/transaction/8ba3f325734a333c7272209278711743158a07325dd52ecae054317f6d3515f0

This closes the loop: our client signs → facilitator `/verify` → `/settle` →
on-chain `transfer_with_authorization` → tokens move. The whole payment engine is
real and network-proven. The live config is wired into `apps/{provider,consumer}/.env.local`,
so `npm run dev` runs the two-tab demo against this deployed token.

> The `version="1"` and "Casper X402 Token" domain values are confirmed correct —
> the on-chain contract accepted the signature, which it only does if its domain
> (name/version/chain_name/package_hash) matches what we signed byte-for-byte.

## What only YOU can do (hard external prerequisites)

I cannot complete these from here — they need accounts, money, and network:

1. **Get a CSPR.cloud access token** (the facilitator requires it) — https://cspr.cloud
2. **Deploy a CEP-18 x402 token** that supports `transfer_with_authorization`.
   The `Cep18X402.wasm` is in the `make-software/casper-x402` repo
   (`infra/local/deployer`). You need its **contract package hash** (the
   `asset`), plus its `name`, `version`, `decimals`, `symbol`.
3. **Fund the payer** (consumer) account with that CEP-18 token, and fund it
   with CSPR for any account creation. Faucet:
   https://testnet.cspr.live/tools/faucet
4. **Set env** in `apps/*/.env.local`: `CSPR_CLOUD_API_KEY`, `CEP18_TOKEN_*`,
   payer/payee account hashes + keys. Then run `npm run test:facilitator`.

## Known limitations / honest caveats

- **Browser signing.** The consumer demo signs with a hot ed25519 key via
  WebCrypto. Production signing is now written for **CSPR.click**
  (`signX402PaymentWithCsprClick` in `apps/consumer/lib/csprclick-signer.ts`),
  using the wallet's `signTypedData` (signs the RAW digest — no message
  wrapping), matching make-software's official `csprclick-x402` example. It needs
  a live browser wallet to validate end-to-end. Never ship a raw key to the browser.
- **No on-chain demo without setup.** With the mocks gone, the two-tab demo
  streams video and runs the full payment *protocol*, but `/verify` and
  `/settle` will fail until the API key + token above are configured. That's the
  honest tradeoff of removing the fakes.
- **Mode 3 (crypto gate)** is now wired end-to-end (provider encrypts frames +
  releases per-segment keys on payment; consumer decrypts). The trust-free
  property is verified offline (`npm run test:crypto`); the WebRTC Encoded-
  Transform plumbing runs in a supporting browser (Chrome).
- **Settlement timing.** `/settle` submits an on-chain deploy and waits for
  confirmation; per-segment settlement every 5s may be slow/expensive on
  mainnet. For production, verify per segment and settle in batches.

## Suggested next steps (in order)

1. Deploy `Cep18X402.wasm` to testnet; record package hash + metadata.
2. Get a CSPR.cloud API key.
3. Fill env; run `npm run test:facilitator` and iterate on the EIP-712 domain /
   signature encoding until `isValid: true`.
4. Run the two-tab demo end-to-end on testnet.
5. Wire CSPR.click for browser signing.
6. Batch settlement; then optionally implement Mode 3 frame encryption.
