# cep18-x402 — CEP-18 with on-chain EIP-712 `transfer_with_authorization`

An Odra CEP-18 token whose `transfer_with_authorization` entry point verifies an
off-chain EIP-712 signature on-chain (rebuilds the digest, checks the signature,
enforces the validity window, rejects nonce replays) before moving tokens. This
is the authorize → verify → settle pattern an x402 facilitator drives.

## Verified

```bash
cd contracts/cep18-x402
cargo odra test
```

→ **4/4 pass** on OdraVM:

- `transfer_with_authorization_moves_tokens` — sign off-chain, verify + transfer on-chain
- `replayed_nonce_reverts` — a nonce can be spent once
- `wrong_signer_reverts` — a bad signature is rejected
- `expired_authorization_reverts` — the `validAfter…validBefore` window is enforced

The test signs a real EIP-712 digest with a secp256k1 key; the contract rebuilds
the **same** digest independently and verifies it — so this exercises the actual
on-chain verification, not a stub.

## Toolchain

Requires **nightly Rust** (Odra 2.5's proc-macros use unstable features), pinned
in `rust-toolchain.toml`.

> ⚠️ **Wasm build caveat.** `cargo odra build` (wasm) currently fails on very
> recent nightlies: `odra-casper-wasm-env` 2.5 uses `#[no_mangle]` on internal
> language items, which newer nightly rustc rejects as a hard error. `cargo odra
> test` (OdraVM) is unaffected. To produce wasm, pin an older nightly compatible
> with Odra 2.5 (e.g. a mid-2025 `nightly-YYYY-MM-DD` in `rust-toolchain.toml`),
> or build with the Odra-recommended toolchain for that release.

## Scope vs. the hosted facilitator (honest)

Verification here uses the official `casper-eip-712` crate's **secp256k1**
(EVM-style) recovery path — the path that crate ships and tests. The **CSPR.cloud
hosted facilitator** settles a closed-source, **ed25519-native** token; its Rust
is not published, so a from-scratch contract can't be byte-verified against it
without deploying. For the hosted demo, deploy the official `Cep18X402.wasm`
(see [../../ONCHAIN.md](../../ONCHAIN.md)). This contract is the project's own
token and a working template for a self-hosted facilitator.
