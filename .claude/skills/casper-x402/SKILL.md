---
name: casper-x402
description: Use when building the x402 payment flow on Casper — the CSPR.cloud facilitator /verify and /settle endpoints, the v2 PaymentPayload + PaymentRequirements shapes, the EIP-712 TransferAuthorization typed data, and the exact scheme over CEP-18 tokens.
source: https://docs.cspr.cloud/x402-facilitator-api/reference  +  https://github.com/make-software/casper-x402
saved: 2026-06-21
---

# Casper x402 (CSPR.cloud facilitator)

x402 = HTTP-native micropayments. Server replies `402` + `PaymentRequirements`;
client replays with a signed `PaymentPayload`; the facilitator `/verify`s and
`/settle`s on-chain via the CEP-18 `transfer_with_authorization` entry point.

- Facilitator: `https://x402-facilitator.cspr.cloud` (mainnet + testnet)
- Networks (CAIP-2): `casper:casper`, `casper:casper-test`
- Auth header: `authorization: <CSPR.cloud token>`  (NOT `Bearer`)
- Endpoints: `GET /supported`, `POST /verify`, `POST /settle`

## /verify and /settle body

```jsonc
{
  "paymentPayload": {
    "x402Version": 2,
    "resource": { "url": "..." },
    "accepted": {
      "scheme": "exact",
      "network": "casper:casper-test",
      "asset": "<64-hex CEP-18 package hash>",
      "amount": "10000",                 // decimal string, base units
      "payTo": "00<64hex>",              // account hash, 00-tagged
      "maxTimeoutSeconds": 300
    },
    "payload": {
      "signature": "<65-byte hex>",      // algo-prefix(01 ed25519/02 secp256k1) + 64-byte sig
      "publicKey": "01<64hex>",          // Casper public key, algo-prefixed
      "authorization": {
        "from": "00<64hex>", "to": "00<64hex>",
        "value": "10000",
        "validAfter": "1710000000", "validBefore": "1710000900",  // unix secs as strings
        "nonce": "<64hex>"               // 32-byte random
      }
    }
  },
  "paymentRequirements": {
    "scheme": "exact", "network": "casper:casper-test",
    "payTo": "00<64hex>", "amount": "10000", "asset": "<64hex>",
    "maxTimeoutSeconds": 900,
    "extra": { "name": "Cep18x402", "version": "1", "decimals": "2", "symbol": "CSPR" }
  }
}
```

`extra.name` + `extra.version` build the EIP-712 domain. `maxTimeoutSeconds` min 6.

## Responses

- `/verify` → `{ "isValid": true, "payer": "00..." }` or `{ "isValid": false, "invalidReason": "...", "invalidMessage": "..." }`
- `/settle` → always HTTP 200; `{ "success": true, "transaction": "<64hex deploy>", "network": "...", "payer": "..." }` or `{ "success": false, "errorReason": "...", "errorMessage": "..." }`

Error codes: `unsupported_scheme`, `network_mismatch`, `malformed_payload`,
`pay_to_mismatch`, `amount_mismatch`, `invalid_pay_to`, `invalid_amount`,
`invalid_asset`, `not_yet_valid`, `payload_expired`, `insufficient_time`,
`missing_token_name`/`missing_token_version`, `failed_to_hash`,
`invalid_signature`; settle adds `verification_failed`, `build_deploy_failed`,
`sign_deploy_failed`, `put_deploy_failed`, `wait_deploy_failed`.

## EIP-712 typed data

Use `@casper-ecosystem/casper-eip-712` (TS) / `casper-eip-712` crate (Rust,
`casper-native` feature). `TransferAuthorization { from, to, value, valid_after,
valid_before, nonce }`. Casper-native domain: `name`, `version`,
`chain_name` (CAIP-2), `contract_package_hash` (bytes32). Sign the 32-byte
`hashTypedData` digest with the Casper key.

## In THIS project

Implemented in `packages/rail-x402-casper` (`CasperX402Rail`, `FacilitatorClient`,
`PayloadBuilder`, `Eip712Signer`). Validate with `npm run test:facilitator`.
The token contract lives in `contracts/cep18-x402` (or use the prebuilt
`Cep18X402.wasm` from make-software/casper-x402). See `ONCHAIN.md`.
