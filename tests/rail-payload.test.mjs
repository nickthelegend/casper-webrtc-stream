import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  CasperX402Rail,
  buildWireRequirements,
} from "@nickthelegend69/webrtc-payment-rail-x402";

const hex = (b) => Buffer.from(b).toString("hex");
const token = { name: "Cep18x402", version: "1", decimals: "2", symbol: "CSPR" };

function railWith(tokenContractHash) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const pub = publicKey.export({ type: "spki", format: "der" }).subarray(-32);
  const seed = privateKey.export({ type: "pkcs8", format: "der" }).subarray(-32);
  return new CasperX402Rail({
    facilitatorUrl: "https://x402-facilitator.cspr.cloud",
    network: "casper:casper-test",
    tokenContractHash,
    token,
    providerAccountHash: "account-hash-" + "22".repeat(32),
    consumerAccountHash: "account-hash-" + "11".repeat(32),
    consumerPublicKeyHex: "01" + hex(pub),
    consumerPrivateKeyHex: hex(seed),
  });
}

test("buildRequirements produces a 32-byte nonce + exact scheme", () => {
  const rail = railWith("ab".repeat(32));
  const req = rail.buildRequirements({ amount: "10000", sessionId: "s", segmentIndex: 2 });
  assert.equal(req.scheme, "exact");
  assert.equal(req.network, "casper:casper-test");
  assert.equal(req.amount, "10000");
  assert.equal(req.nonce.length, 64);
  assert.equal(req.segmentIndex, 2);
});

test("buildWireRequirements normalizes a prefixed asset to bare 64-hex + tags payTo", () => {
  const rail = railWith("hash-" + "ab".repeat(32)); // prefixed token hash
  const req = rail.buildRequirements({ amount: "10000", sessionId: "s" });
  const wire = buildWireRequirements(req, token, 300);
  assert.equal(wire.asset, "ab".repeat(32), "asset stripped to bare hex");
  assert.equal(wire.payTo, "00" + "22".repeat(32), "payTo is 00-tagged");
  assert.equal(wire.scheme, "exact");
  assert.equal(wire.extra.name, "Cep18x402");
  assert.equal(wire.extra.version, "1");
});

test("buildPayload shape: v2, 65-byte sig, tagged addresses, clock-skew window", async () => {
  const rail = railWith("ab".repeat(32));
  const req = rail.buildRequirements({ amount: "10000", sessionId: "s", segmentIndex: 0 });
  const now = Math.floor(Date.now() / 1000);
  const p = await rail.buildPayload(req);
  assert.equal(p.x402Version, 2);
  assert.equal(p.payload.signature.length, 130);
  assert.ok(p.payload.signature.startsWith("01"));
  assert.ok(p.payload.publicKey.startsWith("01"));
  const a = p.payload.authorization;
  assert.ok(a.from.startsWith("00") && a.to.startsWith("00"), "00-tagged");
  assert.equal(a.nonce.length, 64);
  // validAfter is backdated ~10min for clock-skew tolerance; validBefore in the future
  assert.ok(Number(a.validAfter) <= now && Number(a.validAfter) >= now - 700);
  assert.ok(Number(a.validBefore) > now);
});
