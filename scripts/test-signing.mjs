/**
 * Real signature test — proves the rail's EIP-712 TransferWithAuthorization
 * payload is cryptographically valid against the digest the CSPR.cloud
 * facilitator independently recomputes.
 *
 *   npm run test:signing
 *
 * It does NOT hit the network. Instead it reproduces the facilitator's verify
 * path locally (make-software/casper-x402 → exact/facilitator/scheme.ts):
 *   1. derive the payer's Casper account hash from a fresh ed25519 key,
 *   2. build a payment payload with the rail,
 *   3. recompute the EIP-712 digest the SAME way the facilitator does,
 *   4. verify the 65-byte signature against that digest.
 * If the rail built a different digest (wrong type name, snake_case fields,
 * untagged addresses, …) step 4 fails — so this is a real regression guard,
 * not a structure-only smoke test.
 */
import assert from "node:assert";
import crypto from "node:crypto";
import { blake2b } from "@noble/hashes/blake2b";
import {
  hashTypedData,
  buildDomain,
  CASPER_DOMAIN_TYPES,
} from "@casper-ecosystem/casper-eip-712";
import { CasperX402Rail, makeEd25519SignFn } from "@nickthelegend/webrtc-payment-rail-x402";

const hex = (b) => Buffer.from(b).toString("hex");

// 1. fresh ed25519 key + its real Casper account hash:
//    blake2b256("ed25519" + 0x00 + publicKey)
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const pub = publicKey.export({ type: "spki", format: "der" }).subarray(-32);
const seed = privateKey.export({ type: "pkcs8", format: "der" }).subarray(-32);
const preimage = new Uint8Array([...new TextEncoder().encode("ed25519"), 0, ...pub]);
const accountHashHex = hex(blake2b(preimage, { dkLen: 32 }));

const token = { name: "Cep18x402", version: "1", decimals: "2", symbol: "CSPR" };
const asset = "ab".repeat(32); // 64-hex CEP-18 package hash
const network = "casper:casper-test";

const rail = new CasperX402Rail({
  facilitatorUrl: "https://x402-facilitator.cspr.cloud",
  network,
  tokenContractHash: asset,
  token,
  providerAccountHash: "account-hash-" + "22".repeat(32),
  consumerAccountHash: "account-hash-" + accountHashHex, // matches the key
  consumerPublicKeyHex: "01" + hex(pub),
});

// 2. build the payload
const req = rail.buildRequirements({ amount: "10000", sessionId: "s", segmentIndex: 0 });
assert.equal(req.nonce.length, 64, "nonce is 32 bytes");

const payload = await rail.buildPayload(req, makeEd25519SignFn(hex(seed)));
const a = payload.payload.authorization;

// structure
assert.equal(payload.x402Version, 2, "x402Version must be 2");
assert.equal(payload.payload.signature.length, 130, "signature is 65 bytes (130 hex)");
assert.ok(payload.payload.signature.startsWith("01"), "ed25519 algo prefix");
assert.ok(payload.payload.publicKey.startsWith("01"), "publicKey algo prefix");
assert.ok(a.from.startsWith("00") && a.to.startsWith("00"), "from/to are 00-tagged");
assert.equal(a.nonce.length, 64, "auth nonce 32 bytes");
assert.ok(Number(a.validBefore) > Number(a.validAfter), "time window");

// 3. the facilitator's own check: public key must hash to authorization.from
assert.equal(a.from.slice(2), accountHashHex, "from must be the public key's account hash");

// 4. recompute the digest EXACTLY as the facilitator does, from the authorization
const transferWithAuthorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};
const domain = buildDomain(token.name, token.version, network, "0x" + asset);
const message = {
  from: "0x" + a.from,
  to: "0x" + a.to,
  value: BigInt(a.value),
  validAfter: BigInt(a.validAfter),
  validBefore: BigInt(a.validBefore),
  nonce: "0x" + a.nonce,
};
let digest = hashTypedData(
  domain,
  transferWithAuthorizationTypes,
  "TransferWithAuthorization",
  message,
  { domainTypes: CASPER_DOMAIN_TYPES },
);
if (typeof digest === "string") digest = Buffer.from(digest.replace(/^0x/, ""), "hex");
assert.equal(digest.length, 32, "digest is 32 bytes");

// verify the signature (drop the 1-byte algo prefix) against that digest
const sig = Buffer.from(payload.payload.signature.slice(2), "hex");
assert.equal(sig.length, 64, "raw ed25519 signature is 64 bytes");
const verified = crypto.verify(null, Buffer.from(digest), publicKey, sig);
assert.ok(verified, "ed25519 signature MUST verify against the facilitator-style digest");

console.log("  ✓ account hash derived from key matches authorization.from");
console.log("  ✓ digest recomputed the facilitator's way (TransferWithAuthorization)");
console.log("  ✓ ed25519 signature verifies against that digest");
console.log("    digest:   ", hex(digest).slice(0, 24) + "…");
console.log("    signature:", payload.payload.signature.slice(0, 24) + "…");
console.log(
  "\n✅ SIGNING TEST PASSED — payload is cryptographically valid for the\n" +
    "   facilitator's verifier (on-chain settle still needs a live API key + token).\n",
);
