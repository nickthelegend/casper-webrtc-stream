---
name: odra
description: Use when writing, testing, building, or deploying Casper smart contracts in Rust with the Odra framework — CEP-18 tokens, modules, storage, entry points, unit tests, and Livenet (testnet/mainnet) deployment.
source: https://odra.dev/llms.txt  (saved alongside as llms.txt)
saved: 2026-06-21
---

# Odra — Casper smart contracts in Rust

Odra is a high-level framework for Casper contracts. A contract is an
`#[odra::module]` struct of `Var`/`Mapping`/`List`/`SubModule` fields; an
`#[odra::module] impl` block generates entry points. `odra-modules` ships a
ready-made `Cep18` token you compose via `SubModule<Cep18>` + `delegate!`.

## Toolchain

```bash
cargo install cargo-odra            # CLI
cargo odra new --name ourcoin --template cep18   # scaffold a CEP-18 token
cargo odra test                     # OdraVM unit tests (fast)
cargo odra test -b casper           # against the Casper VM
cargo odra build -b casper          # produce wasm in ./wasm
```

## CEP-18 essentials (from the tutorial)

```rust
use odra::{casper_types::U256, prelude::*};
use odra_modules::cep18_token::Cep18;

#[odra::module]
pub struct OurToken { token: SubModule<Cep18> }

#[odra::module]
impl OurToken {
    pub fn init(&mut self, name: String, symbol: String, decimals: u8, initial_supply: U256) {
        self.token.init(symbol, name, decimals, initial_supply);
    }
    delegate! { to self.token {
        fn name(&self) -> String;
        fn symbol(&self) -> String;
        fn decimals(&self) -> u8;
        fn total_supply(&self) -> U256;
        fn balance_of(&self, address: &Address) -> U256;
        fn transfer(&mut self, recipient: &Address, amount: &U256);
        fn transfer_from(&mut self, owner: &Address, recipient: &Address, amount: &U256);
        fn approve(&mut self, spender: &Address, amount: &U256);
    }}
}
```

`raw_transfer` / `raw_mint` / `raw_burn` bypass caller checks (use inside
contract-authorized flows like `transfer_with_authorization`).

## Livenet (testnet) deploy

Add the livenet bin + feature to `Cargo.toml`, then create `.env`:

```env
ODRA_CASPER_LIVENET_SECRET_KEY_PATH=keys/secret_key.pem
ODRA_CASPER_LIVENET_NODE_ADDRESS=https://node.testnet.cspr.cloud
ODRA_CASPER_LIVENET_CHAIN_NAME=casper-test
ODRA_CASPER_LIVENET_EVENTS_URL=https://node.testnet.cspr.cloud/events
```

`node.testnet.cspr.cloud` needs a CSPR.cloud `Authorization` token. Deploy:

```bash
cargo run --bin <name>_livenet --features livenet
```

It prints the `contract-package-...` hash → that 64-hex is your CEP-18 **asset**
package hash for x402. Fund the deployer key first via
https://testnet.cspr.live/tools/faucet.

## In THIS project

`contracts/cep18-x402/` is an Odra project for the x402-compatible CEP-18 token.
See `ONCHAIN.md` for the full bring-up. Key/secret handling is the user's — keys
never go through the agent.
