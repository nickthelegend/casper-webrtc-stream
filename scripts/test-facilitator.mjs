/**
 * Live facilitator check — signs a payload and calls the real /verify endpoint.
 * This is the ONLY test that proves the EIP-712 domain + signature encoding
 * actually match what CSPR.cloud expects.
 *
 *   CSPR_CLOUD_API_KEY=... \
 *   CEP18_TOKEN_CONTRACT=<64hex pkg hash> \
 *   PROVIDER_ACCOUNT_HASH=account-hash-... \
 *   CONSUMER_ACCOUNT_HASH=account-hash-... \
 *   CONSUMER_PUBLIC_KEY=01... CONSUMER_PRIVATE_KEY=<ed25519 seed hex> \
 *   npm run test:facilitator
 */
import { CasperX402Rail } from "@nickthelegend/webrtc-payment-rail-x402";

const need = [
  "CSPR_CLOUD_API_KEY",
  "CEP18_TOKEN_CONTRACT",
  "PROVIDER_ACCOUNT_HASH",
  "CONSUMER_ACCOUNT_HASH",
  "CONSUMER_PUBLIC_KEY",
  "CONSUMER_PRIVATE_KEY",
];
const missing = need.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("Missing env: " + missing.join(", "));
  console.error("See STATUS.md for how to obtain a key + deploy a CEP-18 token.");
  process.exit(1);
}

const rail = new CasperX402Rail({
  facilitatorUrl: process.env.X402_FACILITATOR_URL ?? "https://x402-facilitator.cspr.cloud",
  facilitatorApiKey: process.env.CSPR_CLOUD_API_KEY,
  network: process.env.CASPER_NETWORK ?? "casper:casper-test",
  tokenContractHash: process.env.CEP18_TOKEN_CONTRACT,
  token: {
    name: process.env.CEP18_TOKEN_NAME ?? "Cep18x402",
    version: process.env.CEP18_TOKEN_VERSION ?? "1",
    decimals: process.env.CEP18_TOKEN_DECIMALS ?? "2",
    symbol: process.env.CEP18_TOKEN_SYMBOL ?? "CSPR",
  },
  providerAccountHash: process.env.PROVIDER_ACCOUNT_HASH,
  consumerAccountHash: process.env.CONSUMER_ACCOUNT_HASH,
  consumerPublicKeyHex: process.env.CONSUMER_PUBLIC_KEY,
  consumerPrivateKeyHex: process.env.CONSUMER_PRIVATE_KEY,
});

const amount = process.env.AMOUNT ?? "10000";
const req = rail.buildRequirements({ amount, sessionId: "facilitator-test", segmentIndex: 0 });
const payload = await rail.buildPayload(req);

console.log("→ POST /verify …");
const result = await rail.verify(payload);
console.log("← verify:", JSON.stringify(result));

if (result.valid) {
  console.log("\n✅ FACILITATOR ACCEPTED THE SIGNATURE — the EIP-712 path is correct.\n");
  console.log("Run with SETTLE=1 to also submit /settle (spends gas).");
  if (process.env.SETTLE === "1") {
    console.log("→ POST /settle …");
    try {
      const s = await rail.settle(payload);
      console.log("← settle txHash:", s.txHash);
    } catch (e) {
      console.error("settle failed:", e.message);
    }
  }
} else {
  console.error("\n❌ verify failed:", result.error);
  console.error("Iterate on the EIP-712 domain / signature encoding in PayloadBuilder.ts + Eip712Signer.ts.");
  process.exit(1);
}
