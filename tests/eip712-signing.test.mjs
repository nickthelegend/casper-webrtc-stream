import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { blake2b } from "@noble/hashes/blake2b";
import { hashTypedData, buildDomain, CASPER_DOMAIN_TYPES } from "@casper-ecosystem/casper-eip-712";
import {
  CasperX402Rail,
  makeEd25519SignFn,
  buildTransferDigest,
  signEd25519,
} from "@nickthelegend69/webrtc-payment-rail-x402";

const hex = (b) => Buffer.from(b).toString("hex");

test("buildTransferDigest is deterministic and field-sensitive", () => {
  const input = {
    network: "casper:casper-test",
    tokenContractHash: "ab".repeat(32),
    token: { name: "Cep18x402", version: "1" },
    from: "account-hash-" + "11".repeat(32),
    to: "account-hash-" + "22".repeat(32),
    value: "10000",
    validAfter: 1000,
    validBefore: 2000,
    nonce: "cd".repeat(32),
  };
  const d = buildTransferDigest(input);
  assert.equal(d.length, 32);
  assert.deepEqual(buildTransferDigest(input), d, "deterministic");
  assert.notDeepEqual(buildTransferDigest({ ...input, value: "10001" }), d, "value matters");
  assert.notDeepEqual(buildTransferDigest({ ...input, nonce: "ce".repeat(32) }), d, "nonce matters");
});

test("signEd25519 returns a 65-byte algo-prefixed signature", async () => {
  const sig = await signEd25519(new Uint8Array(32), "00".repeat(32));
  assert.equal(sig.length, 130); // 65 bytes hex
  assert.ok(sig.startsWith("01"), "ed25519 algo prefix");
});

// The strong one: build a payload, then INDEPENDENTLY recompute the digest the
// facilitator's exact way and verify the signature against it.
test("rail payload verifies against the facilitator-style digest", async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const pub = publicKey.export({ type: "spki", format: "der" }).subarray(-32);
  const seed = privateKey.export({ type: "pkcs8", format: "der" }).subarray(-32);
  const accountHashHex = hex(blake2b(new Uint8Array([...new TextEncoder().encode("ed25519"), 0, ...pub]), { dkLen: 32 }));

  const token = { name: "Cep18x402", version: "1", decimals: "2", symbol: "CSPR" };
  const asset = "ab".repeat(32);
  const network = "casper:casper-test";

  const rail = new CasperX402Rail({
    facilitatorUrl: "https://x402-facilitator.cspr.cloud",
    network,
    tokenContractHash: asset,
    token,
    providerAccountHash: "account-hash-" + "22".repeat(32),
    consumerAccountHash: "account-hash-" + accountHashHex,
    consumerPublicKeyHex: "01" + hex(pub),
  });

  const req = rail.buildRequirements({ amount: "10000", sessionId: "s", segmentIndex: 0 });
  const payload = await rail.buildPayload(req, makeEd25519SignFn(hex(seed)));
  const a = payload.payload.authorization;

  // facilitator's check: pubkey hashes to authorization.from
  assert.equal(a.from.slice(2), accountHashHex);

  // recompute the digest exactly like the facilitator
  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" }, { name: "to", type: "address" },
      { name: "value", type: "uint256" }, { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
    ],
  };
  const domain = buildDomain(token.name, token.version, network, "0x" + asset);
  const message = {
    from: "0x" + a.from, to: "0x" + a.to, value: BigInt(a.value),
    validAfter: BigInt(a.validAfter), validBefore: BigInt(a.validBefore), nonce: "0x" + a.nonce,
  };
  let digest = hashTypedData(domain, types, "TransferWithAuthorization", message, { domainTypes: CASPER_DOMAIN_TYPES });
  if (typeof digest === "string") digest = Buffer.from(digest.replace(/^0x/, ""), "hex");

  const sig = Buffer.from(payload.payload.signature.slice(2), "hex");
  assert.equal(sig.length, 64);
  assert.ok(crypto.verify(null, Buffer.from(digest), publicKey, sig), "signature verifies against facilitator digest");
});
