/**
 * Deploy the official Cep18X402 token to Casper testnet, using the payer key.
 * CEP-18 init mints the initial supply to the deployer, so the payer ends up
 * holding tokens — ready for /settle. Prints the contract package hash.
 *
 *   node scripts/deploy/deploy-token.mjs
 *
 * Env: PAYER_SEED (ed25519 seed hex). Defaults to the generated payer.
 */
import sdk from "casper-js-sdk";
import { readFileSync } from "node:fs";

const RPC = process.env.RPC_URL || "https://node.testnet.casper.network/rpc";
const CHAIN = process.env.CHAIN_NAME || "casper-test";
const NETWORK = "casper:casper-test"; // EIP-712 domain chain_name (chain_id arg)
// NEVER hardcode a key. Provide the payer's ed25519 seed via env:
//   PAYER_SEED=<hex> node scripts/deploy/deploy-token.mjs
const SEED = process.env.PAYER_SEED;
if (!SEED) {
  console.error("Set PAYER_SEED=<ed25519 seed hex> (the deployer/payer key).");
  process.exit(1);
}
const PAYMENT = BigInt(process.env.PAYMENT_MOTES || "600000000000"); // 600 CSPR

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const pk = sdk.PrivateKey.fromHex(SEED, sdk.KeyAlgorithm.ED25519);
const pub = pk.publicKey;
console.log("deployer public key:", pub.toHex());
console.log("deployer account hash:", pub.accountHash().toHex());

const wasm = new Uint8Array(readFileSync(new URL("./Cep18X402.wasm", import.meta.url)));
console.log("wasm bytes:", wasm.length);

const args = sdk.Args.fromMap({
  name: sdk.CLValue.newCLString("Casper X402 Token"),
  symbol: sdk.CLValue.newCLString("X402"),
  decimals: sdk.CLValue.newCLUint8(9),
  initial_supply: sdk.CLValue.newCLUInt256("1000000000000000"),
  chain_id: sdk.CLValue.newCLString(NETWORK),
  odra_cfg_is_upgradable: sdk.CLValue.newCLValueBool(true),
  odra_cfg_is_upgrade: sdk.CLValue.newCLValueBool(false),
  odra_cfg_allow_key_override: sdk.CLValue.newCLValueBool(true),
  odra_cfg_package_hash_key_name: sdk.CLValue.newCLString("X402_package_hash"),
});

const tx = new sdk.SessionBuilder()
  .from(pub)
  .wasm(wasm)
  .installOrUpgrade()
  .runtimeArgs(args)
  .chainName(CHAIN)
  .payment(Number(PAYMENT))
  .build();
tx.sign(pk);

const rpc = new sdk.RpcClient(new sdk.HttpHandler(RPC));

console.log(`\n→ submitting install (payment ${PAYMENT} motes = ${Number(PAYMENT) / 1e9} CSPR)…`);
const put = await rpc.putTransaction(tx);
const hash = put.transactionHash.toHex();
console.log("deploy tx hash:", hash);
console.log("  https://testnet.cspr.live/transaction/" + hash);

console.log("\n→ waiting for execution…");
let ok = false;
for (let i = 0; i < 50; i++) {
  await sleep(4000);
  let info;
  try {
    info = await rpc.getTransactionByTransactionHash(hash);
  } catch {
    process.stdout.write(".");
    continue;
  }
  const ex = info?.executionInfo;
  if (ex && ex.executionResult) {
    const err = ex.executionResult.errorMessage;
    if (err) {
      console.error("\n❌ execution failed:", err);
      process.exit(1);
    }
    ok = true;
    console.log("\n✓ executed in block", ex.blockHeight);
    break;
  }
  process.stdout.write(".");
}
if (!ok) {
  console.error("\n❌ timed out waiting for execution");
  process.exit(1);
}

console.log("\n→ reading X402_package_hash from account named keys…");
const ei = sdk.EntityIdentifier.fromPublicKey(pub);
const entity = await rpc.getLatestEntity(ei);
// Casper 2.0 returns named keys in the raw JSON, not the typed `entity` object.
const raw = typeof entity.rawJSON === "string" ? JSON.parse(entity.rawJSON) : entity.rawJSON;
const namedKeys =
  raw?.entity?.named_keys || raw?.named_keys || raw?.AddressableEntity?.named_keys || [];
let pkgRaw = null;
for (const nk of namedKeys) {
  if ((nk.name ?? nk.Name) === "X402_package_hash") {
    pkgRaw = String(nk.key ?? nk.Key);
    break;
  }
}
if (!pkgRaw) {
  console.error("named keys found:", JSON.stringify(namedKeys).slice(0, 600));
  console.error("❌ X402_package_hash not found");
  process.exit(1);
}
const bare = pkgRaw.toLowerCase().replace(/^(package-|hash-|contract-package-)/, "");
console.log("\n✅ TOKEN DEPLOYED");
console.log("package named key:", pkgRaw);
console.log("CEP18_TOKEN_CONTRACT=" + bare);
console.log("\nName=Casper X402 Token  Version=1  Decimals=9  Symbol=X402");
