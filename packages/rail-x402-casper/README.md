# @nickthelegend69/webrtc-payment-rail-x402

> Casper Network **x402 payment rail** — settles per-segment micropayments through the real [CSPR.cloud x402 facilitator](https://x402-facilitator.cspr.cloud) using CEP-18 tokens and EIP-712 `TransferWithAuthorization` signatures.

[![npm](https://img.shields.io/npm/v/@nickthelegend69/webrtc-payment-rail-x402.svg)](https://www.npmjs.com/package/@nickthelegend69/webrtc-payment-rail-x402)

This is the Casper-specific half of the SDK. It implements the `PaymentRail`
interface from
[`@nickthelegend69/webrtc-payment-sdk-core`](https://www.npmjs.com/package/@nickthelegend69/webrtc-payment-sdk-core),
turning "charge this viewer 0.15 CSPR" into a signed x402 payload, a facilitator
`/verify`, and an on-chain `/settle`.

```bash
npm install @nickthelegend69/webrtc-payment-rail-x402 @nickthelegend69/webrtc-payment-sdk-core
```

---

## What it does

```
consumer.signFn ──▶ buildPayload ──▶ EIP-712 digest + ed25519/secp256k1 sig
                                          │
provider ──▶ rail.verify(payload) ──▶ POST /verify   → { isValid }
provider ──▶ rail.settle(payload) ──▶ POST /settle   → { transaction: txHash }   ← real on-chain tx
```

- **EIP-712** — builds the exact `TransferWithAuthorization` typed-data the
  CSPR.cloud facilitator expects (camelCase fields, 33-byte tagged account
  hashes, bare contract-package hash), via `@casper-ecosystem/casper-eip-712`.
- **Signing** — pure-JS ed25519 (`@noble/curves`) for browser/agent signing, or
  bring your own `signFn` (a wallet like CSPR.click).
- **Facilitator** — wraps `/supported`, `/verify`, `/settle` with the correct
  `authorization: <raw token>` header and request body shape.
- **Replay-safe** — 32-byte nonces; the core SDK rejects reuse before the rail
  is ever called.

---

## Usage

### Provider side (verifies + settles — needs the API key)

```ts
import { CasperX402Rail } from "@nickthelegend69/webrtc-payment-rail-x402";

const rail = new CasperX402Rail({
  facilitatorUrl: "https://x402-facilitator.cspr.cloud",
  facilitatorApiKey: process.env.CSPR_CLOUD_API_KEY, // SERVER side only
  network: "casper:casper-test",
  tokenContractHash: process.env.CEP18_TOKEN_CONTRACT!, // 64-hex package hash
  token: { name: "Cep18x402", version: "1", decimals: "9", symbol: "X402" },
  providerAccountHash: process.env.PROVIDER_ACCOUNT_HASH!, // payee
});
```

> ⚠️ The facilitator API key is a **server-side secret**. In a browser app,
> proxy `/verify` and `/settle` through your backend — never ship the key to the
> client.

### Consumer side (only builds + signs — no API key)

```ts
import {
  CasperX402Rail,
  makeEd25519SignFn,       // demo/agent signer (raw key)
  createBrowserSigner,     // production wallet signer (e.g. CSPR.click)
} from "@nickthelegend69/webrtc-payment-rail-x402";

const rail = new CasperX402Rail({
  facilitatorUrl: "https://x402-facilitator.cspr.cloud",
  network: "casper:casper-test",
  tokenContractHash: process.env.CEP18_TOKEN_CONTRACT!,
  token: { name: "Cep18x402", version: "1", decimals: "9", symbol: "X402" },
  consumerAccountHash: walletAddress,
  consumerPublicKeyHex: publicKeyHex,
});

// Demo: a real ed25519 hot key (insecure — testnet only)
const signFn = makeEd25519SignFn(process.env.CONSUMER_PRIVATE_KEY!);
// Production: const signFn = createBrowserSigner();  // delegates to the wallet
```

Then hand `rail` + `signFn` to `PaywalledRTCConsumer`. See the
[core README](https://www.npmjs.com/package/@nickthelegend69/webrtc-payment-sdk-core).

---

## Config (`CasperX402RailConfig`)

| Field | Required | Notes |
|-------|----------|-------|
| `facilitatorUrl` | ✅ | CSPR.cloud facilitator base URL. |
| `network` | ✅ | `"casper:casper-test"` or `"casper:casper"`. |
| `tokenContractHash` | ✅ | CEP-18 package hash (any prefix; normalized to bare 64-hex). |
| `token` | ✅ | `{ name, version, decimals?, symbol? }` for the EIP-712 domain. |
| `facilitatorApiKey` | provider | Required to call `/verify` + `/settle`. |
| `providerAccountHash` | provider | Payee account hash. |
| `consumerAccountHash` | consumer | Payer account hash. |
| `consumerPublicKeyHex` | consumer | Payer public key (algo-prefixed hex). |
| `maxTimeoutSeconds` | — | Authorization validity window (facilitator min 6). |
| `resourceUrl` | — | Optional `resource` echoed in the payload. |

---

## Exports

- `CasperX402Rail` — the `PaymentRail` implementation.
- `FacilitatorClient` — thin `/supported` · `/verify` · `/settle` client.
- `makeEd25519SignFn`, `createBrowserSigner`, `signEd25519`, `buildTransferDigest`
  — signing helpers.
- `buildPaymentPayload`, `buildWireRequirements`, `buildExtra` — payload builders.
- `bareHash`, `tagged`, `zeroX`, `bareNonce`, `hexToBytes`, `bytesToHex`
  — Casper hash/format helpers.
- Types: `CasperX402RailConfig`, `CasperNetwork`, `WireRequirements`,
  `FacilitatorVerifyResponse`, `FacilitatorSettleResponse`, `BuildPayloadOpts`,
  `TransferDigestInput`.

---

## EIP-712 shape (the gotcha)

The facilitator is strict. The rail produces exactly:

- `primaryType: "TransferWithAuthorization"`, **camelCase** fields
  (`validAfter` / `validBefore`).
- `from` / `to` as 33-byte tagged account hashes (`"0x" + "00" + 64hex`).
- `contract_package_hash` as a **bare** 64-hex (no prefix, no tag).
- `validAfter = now − 600s` to absorb clock skew.

If CSPR.cloud changes the schema, `Eip712Signer.ts` / `PayloadBuilder.ts` are the
only files to touch.

For the full integration walkthrough see
[`docs/USAGE.md`](https://github.com/nickthelegend/casper-webrtc-stream/blob/main/docs/USAGE.md).

MIT
