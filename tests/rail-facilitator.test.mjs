import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { CasperX402Rail } from "@nickthelegend/webrtc-payment-rail-x402";

const hex = (b) => Buffer.from(b).toString("hex");
const API_KEY = "test-api-key-uuid";

function makeRail() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const pub = publicKey.export({ type: "spki", format: "der" }).subarray(-32);
  const seed = privateKey.export({ type: "pkcs8", format: "der" }).subarray(-32);
  return new CasperX402Rail({
    facilitatorUrl: "https://x402-facilitator.cspr.cloud",
    facilitatorApiKey: API_KEY,
    network: "casper:casper-test",
    tokenContractHash: "ab".repeat(32),
    token: { name: "Cep18x402", version: "1", decimals: "2", symbol: "CSPR" },
    providerAccountHash: "account-hash-" + "22".repeat(32),
    consumerAccountHash: "account-hash-" + "11".repeat(32),
    consumerPublicKeyHex: "01" + hex(pub),
    consumerPrivateKeyHex: hex(seed),
  });
}

// install a fake fetch that records the request and returns `response`
function mockFetch(response, sink) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    sink.url = url;
    sink.opts = opts;
    sink.body = JSON.parse(opts.body);
    return { status: 200, text: async () => JSON.stringify(response) };
  };
  return () => { globalThis.fetch = original; };
}

test("verify: posts the right body + raw authorization header, parses isValid", async () => {
  const rail = makeRail();
  const req = rail.buildRequirements({ amount: "10000", sessionId: "s", segmentIndex: 0 });
  const payload = await rail.buildPayload(req);

  const sink = {};
  const restore = mockFetch({ isValid: true, payer: "00" + "11".repeat(32) }, sink);
  try {
    const res = await rail.verify(payload);
    assert.equal(res.valid, true);
    assert.ok(String(sink.url).endsWith("/verify"));
    assert.equal(sink.opts.method, "POST");
    // CSPR.cloud uses the raw token in `authorization`, NOT Bearer
    assert.equal(sink.opts.headers.authorization, API_KEY);
    assert.ok(!String(sink.opts.headers.authorization).startsWith("Bearer"));
    assert.ok(sink.body.paymentPayload, "body has paymentPayload");
    assert.ok(sink.body.paymentRequirements, "body has paymentRequirements");
    assert.equal(sink.body.paymentRequirements.asset, "ab".repeat(32));
  } finally {
    restore();
  }
});

test("verify: surfaces invalidReason on rejection", async () => {
  const rail = makeRail();
  const payload = await rail.buildPayload(rail.buildRequirements({ amount: "1", sessionId: "s" }));
  const restore = mockFetch({ isValid: false, invalidReason: "invalid_signature", invalidMessage: "nope" }, {});
  try {
    const res = await rail.verify(payload);
    assert.equal(res.valid, false);
    assert.match(res.error, /nope|invalid_signature/);
  } finally {
    restore();
  }
});

test("settle: returns the transaction hash on success", async () => {
  const rail = makeRail();
  const payload = await rail.buildPayload(rail.buildRequirements({ amount: "1", sessionId: "s" }));
  const sink = {};
  const restore = mockFetch({ success: true, transaction: "deadbeef".repeat(8), network: "casper:casper-test" }, sink);
  try {
    const res = await rail.settle(payload);
    assert.equal(res.txHash, "deadbeef".repeat(8));
    assert.ok(String(sink.url).endsWith("/settle"));
  } finally {
    restore();
  }
});

test("settle: throws on failure", async () => {
  const rail = makeRail();
  const payload = await rail.buildPayload(rail.buildRequirements({ amount: "1", sessionId: "s" }));
  const restore = mockFetch({ success: false, errorReason: "verification_failed", errorMessage: "bad" }, {});
  try {
    await assert.rejects(() => rail.settle(payload), /bad|verification_failed/);
  } finally {
    restore();
  }
});
