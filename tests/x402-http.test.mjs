import { test } from "node:test";
import assert from "node:assert/strict";
import {
  wrapFetch,
  X402Gate,
  X402Error,
  encodePayment,
  decodePayment,
  X402_PAYMENT_HEADER,
} from "@nickthelegend69/webrtc-payment-sdk-core";

const PAYTO = "account-hash-" + "bb".repeat(32);
const ASSET = "aa".repeat(32);

// A fake PaymentRail — exercises the HTTP layer without touching the network.
function fakeRail() {
  return {
    buildRequirements: ({ amount, sessionId }) => ({
      network: "casper:casper-test",
      scheme: "exact",
      asset: ASSET,
      amount,
      payTo: PAYTO,
      description: "test",
      sessionId,
      nonce: "cc".repeat(32),
    }),
    buildPayload: async (req, signFn) => ({
      x402Version: 2,
      payload: {
        signature: await signFn("deadbeef"),
        publicKey: "01" + "11".repeat(32),
        authorization: {
          from: "00" + "99".repeat(32),
          to: "00" + "bb".repeat(32),
          value: req.amount,
          validAfter: "0",
          validBefore: "9",
          nonce: "cc".repeat(32),
        },
      },
      paymentRequirements: req,
    }),
    verify: async (p) => ({ valid: p.paymentRequirements.amount !== "0" }),
    settle: async () => ({ txHash: "feedface" }),
  };
}

const signFn = async () => "01" + "22".repeat(32);

test("encodePayment/decodePayment round-trips", () => {
  const payload = { x402Version: 2, payload: { signature: "01ab", publicKey: "0111", authorization: { from: "0099", to: "00bb", value: "100", validAfter: "0", validBefore: "9", nonce: "cc" } }, paymentRequirements: { amount: "100", payTo: PAYTO } };
  assert.deepEqual(decodePayment(encodePayment(payload)), payload);
});

test("wrapFetch pays a 402 and retries with X-PAYMENT", async () => {
  const rail = fakeRail();
  const reqs = rail.buildRequirements({ amount: "100", sessionId: "s" });
  const calls = [];
  const baseFetch = async (input, init) => {
    calls.push({ input, init });
    if (calls.length === 1) {
      return { status: 402, json: async () => ({ x402Version: 2, accepts: [reqs] }), text: async () => "" };
    }
    return { status: 200, json: async () => ({ ok: true }), text: async () => "" };
  };
  const pay = wrapFetch(baseFetch, { rail, signFn });
  const res = await pay("http://x/premium");
  assert.equal(res.status, 200);
  assert.equal(calls.length, 2, "should retry once");
  const hdr = calls[1].init.headers[X402_PAYMENT_HEADER];
  assert.ok(hdr, "retry carries the payment header");
  assert.equal(decodePayment(hdr).paymentRequirements.amount, "100");
});

test("wrapFetch enforces maxValue", async () => {
  const rail = fakeRail();
  const reqs = rail.buildRequirements({ amount: "100", sessionId: "s" });
  const baseFetch = async () => ({ status: 402, json: async () => ({ accepts: [reqs] }), text: async () => "" });
  const pay = wrapFetch(baseFetch, { rail, signFn, maxValue: "50" });
  await assert.rejects(() => pay("http://x/premium"), (e) => e instanceof X402Error && e.code === "payment_exceeds_max");
});

test("wrapFetch passes through non-402 responses untouched", async () => {
  const rail = fakeRail();
  let n = 0;
  const baseFetch = async () => { n++; return { status: 200, json: async () => ({ ok: 1 }), text: async () => "" }; };
  const res = await wrapFetch(baseFetch, { rail, signFn })("http://x/free");
  assert.equal(res.status, 200);
  assert.equal(n, 1, "no retry for non-402");
});

test("X402Gate challenges, then settles a valid payment", async () => {
  const rail = fakeRail();
  const gate = new X402Gate({ rail, amount: "100", payTo: PAYTO, asset: ASSET, network: "casper:casper-test" });

  const challenge = gate.challenge();
  assert.equal(challenge.status, 402);
  assert.equal(challenge.requirements.amount, "100");

  const payload = await rail.buildPayload(challenge.requirements, signFn);
  const result = await gate.process(encodePayment(payload));
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(result.txHash, "feedface");
});

test("X402Gate rejects underpayment and payTo redirection", async () => {
  const rail = fakeRail();
  const gate = new X402Gate({ rail, amount: "100", payTo: PAYTO });

  // underpaid
  const under = await rail.buildPayload(rail.buildRequirements({ amount: "10", sessionId: "s" }), signFn);
  const r1 = await gate.process(encodePayment(under));
  assert.equal(r1.ok, false);
  assert.match(r1.error, /underpaid/);

  // payTo redirected to the attacker
  const redirected = await rail.buildPayload(
    { ...rail.buildRequirements({ amount: "100", sessionId: "s" }), payTo: "account-hash-" + "ff".repeat(32) },
    signFn,
  );
  const r2 = await gate.process(encodePayment(redirected));
  assert.equal(r2.ok, false);
  assert.match(r2.error, /payTo mismatch/);
});

test("X402Gate with settle:false verifies without settling", async () => {
  const rail = fakeRail();
  const gate = new X402Gate({ rail, amount: "100", payTo: PAYTO, settle: false });
  const payload = await rail.buildPayload(rail.buildRequirements({ amount: "100", sessionId: "s" }), signFn);
  const result = await gate.process(encodePayment(payload));
  assert.equal(result.ok, true);
  assert.equal(result.txHash, undefined);
  assert.equal(result.payer, "00" + "99".repeat(32));
});
