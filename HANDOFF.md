# HANDOFF — what only you can do (and the exact steps)

Everything that can be built + verified offline is done and green (see STATUS.md).
The items below need accounts, money, a browser, or a wallet — things I can't do
from here. Each is one short procedure.

---

## 0. Security first (do this now)

You pasted a 24-word seed phrase for a ~5000 CSPR **mainnet** wallet into chat.
Treat it as compromised:

1. Create a NEW Casper wallet offline.
2. Move the 5000 CSPR to it.
3. Never reuse the exposed phrase; never paste a seed phrase anywhere again.

For all dev below, use **testnet** (free) — never the mainnet wallet.

---

## 1. Make x402 payments real on testnet  ⏱ ~30–45 min

This is the headline item. Full detail in [ONCHAIN.md](./ONCHAIN.md); the short list:

1. `npm run generate-wallet` → fund the printed account hash at
   <https://testnet.cspr.live/tools/faucet>.
2. Get a CSPR.cloud API key: <https://cspr.cloud> (server-side only).
3. Deploy a CEP-18 x402 token. **Use the official prebuilt wasm**
   `infra/local/deployer/Cep18X402.wasm` from
   [make-software/casper-x402](https://github.com/make-software/casper-x402)
   (the hosted facilitator's token is closed-source + ed25519-native — the wasm
   is the guaranteed-compatible artifact). Record its `contract-package-…` hash
   and the `name`/`version`/`decimals`/`symbol` you init it with.
4. Fund your payer account with that token.
5. Fill env (see ONCHAIN.md §5) and run the gate:
   ```bash
   npm run test:facilitator          # must print  verify: {"valid":true}
   SETTLE=1 npm run test:facilitator  # real on-chain settle
   ```
6. `npm run dev` → run the two-tab demo.

**If `/verify` returns `invalid_signature`:** the EIP-712 inputs disagree with
the token's domain — re-check `CEP18_TOKEN_NAME`/`_VERSION` against what you
initialised the token with, and that `CONSUMER_PUBLIC_KEY`'s account hash equals
`CONSUMER_ACCOUNT_HASH`. The digest construction itself is already proven by
`npm run test:signing`, so the fix is always in the env/token values.

---

## 2. CSPR.click production signing  ⏱ ~20 min, needs a browser wallet

The code is written: [apps/consumer/lib/csprclick-signer.ts](apps/consumer/lib/csprclick-signer.ts)
(`signX402PaymentWithCsprClick`), matching the official `signTypedData` reference.
It can't be unit-tested headlessly. To use it:

1. Load the client script in the consumer app's `<head>`:
   `https://cdn.cspr.click/ui/v2.1.0/csprclick-client-2.1.0.js`
2. Wire sign-in (listen for `csprclick:signed_in`; read `account.public_key`).
3. On a payment request, call `signX402PaymentWithCsprClick({ requirements,
   publicKeyHex, accountHash })` instead of the demo's hot-key `signFn`.
4. **Verify it end-to-end against the live facilitator.** `signTypedData` signs
   the raw EIP-712 digest (no "Casper Message" wrapping), so it should verify —
   but confirm with a real wallet + `/verify` before trusting it with funds.

---

## 3. Mode 3 (crypto gate) in the apps  ⏱ ~10 min, needs Chrome

The SDK is wired and the crypto is proven (`npm run test:crypto`). The WebRTC
Encoded-Transform plumbing runs only in a supporting browser (Chrome). To turn it
on in the demo:

1. Provider app: set `gating.mode: "crypto"` in the `PaywalledRTCProvider` config.
2. Consumer app: pass `cryptoMode: true` in the `PaywalledRTCConsumer` config.
3. Open both tabs in Chrome. Frames are AES-GCM encrypted; the per-segment key is
   released over the DataChannel only after each payment confirms — so a
   non-paying viewer sees only ciphertext (not just a paused track).

---

## 4. The Odra contract

[contracts/cep18-x402](contracts/cep18-x402) is now a real, OdraVM-tested CEP-18
with an on-chain EIP-712 `transfer_with_authorization` (verify it: `cd
contracts/cep18-x402 && cargo odra test`). It demonstrates the authorize →
verify → transfer pattern with the official `casper-eip-712` crate.

For the **CSPR.cloud hosted facilitator**, still deploy the official
`Cep18X402.wasm` (step 1.3): that token is ed25519-native and closed-source, so
a from-scratch contract can't be byte-verified against the live facilitator
without their source. This Odra contract is the project's own token / a template
for a self-hosted facilitator.

---

## Quick reference — what's already proven offline (no action needed)

```bash
npm run build            # whole SDK compiles
npm test                 # gating / nonce / DataChannel
npm run test:signing     # EIP-712 digest matches the facilitator + sig verifies
npm run test:crypto      # Mode 3 security property
cd contracts/cep18-x402 && cargo odra test   # on-chain transfer_with_authorization
```
