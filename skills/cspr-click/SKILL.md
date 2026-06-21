---
name: cspr-click
description: Use when integrating CSPR.click into a web dApp — wallet aggregation, social logins, connecting an account, reading the active public key, and signing messages/deploys for the Casper Network (incl. signing x402 EIP-712 authorizations).
source: https://docs.cspr.click/  (full index: https://docs.cspr.click/llms.txt)
saved: 2026-06-21
---

# CSPR.click

CSPR.click is a unified SDK for Casper dApp onboarding: one integration for every
Casper wallet, plus social logins, fiat on-ramps, and a CSPR.cloud proxy.

Append `.md` to any docs page (and `?ask=<question>` to query it) — e.g.
`https://docs.cspr.click/documentation/getting-started.md`.

## Integration shape (React)

1. Install the SDK packages (`@make-software/csprclick-ui`, `@make-software/csprclick-core-client`, `@make-software/csprclick-react`) — confirm exact package names/versions against the docs before pinning.
2. Wrap the app in the CSPR.click provider with your app's `appName`, `appId`, and the `contentMode`, configuring the `providers` (wallets) you support.
3. Use the React hook (`useClickRef()`) to access the client instance and account state.
4. Connect: trigger the sign-in modal; read the active account's **public key** from the client/account event.
5. Sign: the client exposes signing methods for deploys and messages. Use these instead of holding a private key.

> Confirm the exact provider component, hook name, and signing method
> signatures on `https://docs.cspr.click/documentation/getting-started.md`
> before shipping — the SDK surface changes across versions.

## Signing for x402 in THIS project

The x402 `exact` scheme needs an **EIP-712 TransferAuthorization digest** signed
by the payer's Casper key (see `skills/casper-x402` + `packages/rail-x402-casper`).

Two signing paths:

- **Demo / agent:** raw ed25519 over the digest (`makeEd25519SignFn` in the rail).
  A hot key — fine for testnet demos, never for real funds.
- **Production (CSPR.click):** the connected wallet signs. Wire
  `apps/consumer/lib/csprclick-signer.ts` (`createCsprClickSigner`) to the
  CSPR.click signing method so it returns the 65-byte signature
  (algo-prefix + 64-byte sig) for the 32-byte EIP-712 digest.

⚠ IMPORTANT CAVEAT: wallet "sign message" flows often wrap the payload
(e.g. a `Casper Message:` prefix) before hashing, which will NOT match a raw
EIP-712 digest. Before relying on CSPR.click signing for x402, verify the exact
behaviour against the live facilitator (`npm run test:facilitator`) and the
reference React example at
`make-software/casper-x402 → examples/csprclick-x402`. If the wallet wraps the
message, the facilitator/contract side must expect the same wrapping.

## Reference

- Overview: https://docs.cspr.click/documentation/overview.md
- Getting started: https://docs.cspr.click/documentation/getting-started.md
- Dev community: https://t.me/CSPRDevelopers
