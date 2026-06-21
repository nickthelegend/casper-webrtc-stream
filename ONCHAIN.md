# ONCHAIN.md — going from "compiles + signs" to "settles on Casper"

This is the bring-up guide for the part that needs the live network. The code is
ready: the EIP-712 payload is matched byte-for-byte to the facilitator and
verified offline (`npm run test:signing`). What remains is wiring real
credentials + a real token. Only you can do these (they need accounts, an API
key, and funds).

> ⚠️ **Use TESTNET and a throwaway key.** Do **not** use a mainnet wallet — or
> any seed phrase you've pasted into a chat/terminal — for development. Generate
> a fresh key (below) and fund it from the free testnet faucet. A hot key in
> `.env.local` should only ever hold testnet tokens.

## 0. The one-line gate

```bash
npm run test:facilitator   # must print:  ← verify: {"valid":true}
```

Everything below exists to make that command pass. Once it does, `SETTLE=1
npm run test:facilitator` submits a real on-chain `transfer_with_authorization`.

## 1. Generate a testnet payer key

```bash
npm run generate-wallet
```

Records a Public Key (`01…`), Private Key (ed25519 seed hex), and Account Hash
(`account-hash-…`). Fund the account hash with CSPR at
<https://testnet.cspr.live/tools/faucet> (needed for any account creation / gas
on the payer side, and for the deployer key).

## 2. Get a CSPR.cloud API key

Sign up at <https://cspr.cloud>. The key is a raw token (a UUID-looking string).
It is sent as the `authorization` header (no `Bearer`) and is **server-side
only** — it lives in `apps/provider/.env.local` / the `test:facilitator` env,
never in a `NEXT_PUBLIC_*` var or the browser bundle.

## 3. Deploy a CEP-18 x402 token

The facilitator settles by calling the token's `transfer_with_authorization`
entry point, so you need a CEP-18 that implements it.

**Fastest path — the prebuilt wasm (recommended):**
`make-software/casper-x402` ships a ready token at
`infra/local/deployer/Cep18X402.wasm`. Deploy it to testnet with your funded
deployer key (via `casper-client put-deploy … --session-path Cep18X402.wasm` with
the token's init args: name, symbol, decimals, initial supply). After deploy,
read the **contract package hash** — `casper-client` / cspr.live shows it as
`contract-package-<64hex>` (the rail accepts that prefixed form; it normalizes to
bare hex internally). That 64-hex value is your `CEP18_TOKEN_CONTRACT` (the x402
`asset`). Note the `name`, `version`, `decimals`, `symbol` you initialised it
with — `name`+`version` form the EIP-712 domain and **must** match the env.

**From-source path (Odra) — not yet implemented here:**
`contracts/cep18-x402/` is scaffolded (`Cargo.toml`, `Odra.toml`) but the Rust
**source is not written** (`src/`, `bin/build_contract.rs`,
`bin/deploy_livenet.rs` are missing). Writing it means composing `odra-modules`'
`Cep18` with a `transfer_with_authorization` entry point that verifies the
EIP-712 signature on-chain via the `casper-eip-712` crate (`casper-native` +
`verify` features). Until that's done, use the prebuilt wasm above. See the
`odra` skill (`skills/odra/`) for the module/CEP-18/livenet-deploy patterns.

## 4. Fund the payer with the token

Transfer some of the CEP-18 token to your **consumer/payer** account hash (the
one from step 1), so it has a balance to authorize transfers from. The facilitator
(the `feePayer`) pays the CSPR gas for settlement, not the payer.

## 5. Fill env and validate

`test:facilitator` reads these (see `scripts/test-facilitator.mjs`):

```env
CSPR_CLOUD_API_KEY=<your cspr.cloud token>
CASPER_NETWORK=casper:casper-test
CEP18_TOKEN_CONTRACT=<contract-package-… or bare 64hex>
CEP18_TOKEN_NAME=Cep18x402
CEP18_TOKEN_VERSION=1
CEP18_TOKEN_DECIMALS=2
CEP18_TOKEN_SYMBOL=CSPR
PROVIDER_ACCOUNT_HASH=account-hash-<payee>
CONSUMER_ACCOUNT_HASH=account-hash-<payer from step 1>
CONSUMER_PUBLIC_KEY=01<payer pubkey>
CONSUMER_PRIVATE_KEY=<payer ed25519 seed hex>   # testnet hot key, demo only
```

```bash
npm run test:facilitator            # → verify: {"valid":true}
SETTLE=1 npm run test:facilitator   # → settle txHash: <64hex deploy>
```

If `/verify` returns `invalid_signature`, the EIP-712 inputs disagree with the
token's domain — re-check `CEP18_TOKEN_NAME`/`_VERSION` against what the token was
initialised with, and that `CONSUMER_PUBLIC_KEY` is the key whose account hash is
`CONSUMER_ACCOUNT_HASH`. The digest construction itself is covered by
`npm run test:signing`.

## 6. Run the app end-to-end

Copy the same values into `apps/provider/.env.local` (server-side keys) and the
`NEXT_PUBLIC_*` consumer equivalents into `apps/consumer/.env.local` (payer
account/pubkey, and a testnet `NEXT_PUBLIC_CONSUMER_PRIVATE_KEY` for the demo
signer). Then `npm run dev` and run the two-tab demo from the README.

For production browser signing, replace the hot key with **CSPR.click** —
`createBrowserSigner()` in `packages/rail-x402-casper` is a clearly-marked stub
that throws until wired; see `skills/cspr-click/` and mind the message-wrapping
caveat noted there.
