import { test } from "node:test";
import assert from "node:assert/strict";
import { PaymentGate, SessionManager } from "@nickthelegend69/webrtc-payment-sdk-core";

// A stub PaymentRail (test double, not a product mock) so the gate logic can be
// exercised without a chain. Only verify()/settle() are used by processPayment.
function stubRail({ valid = true, txHash = "tx-abc", settleThrows = false } = {}) {
  return {
    buildRequirements: (o) => ({ ...o }),
    buildPayload: async () => ({}),
    verify: async () => ({ valid, error: valid ? undefined : "bad sig" }),
    settle: async () => {
      if (settleThrows) throw new Error("settle boom");
      return { txHash };
    },
  };
}

function payloadFor(sm, sessionId, segmentIndex, amount = "10000") {
  const nonce = sm.generateSegmentNonce(sessionId, segmentIndex);
  return {
    x402Version: 2,
    payload: {
      signature: "01" + "00".repeat(64),
      publicKey: "01" + "00".repeat(32),
      authorization: { from: "00" + "11".repeat(32), to: "00" + "22".repeat(32), value: amount, validAfter: "0", validBefore: "9999999999", nonce },
    },
    paymentRequirements: {
      network: "casper:casper-test", scheme: "exact", asset: "ab".repeat(32),
      amount, payTo: "account-hash-" + "22".repeat(32), description: "seg",
      sessionId, segmentIndex, nonce,
    },
  };
}

test("accepts a valid payment, enables on verify, settles on-chain async", async () => {
  const sm = new SessionManager();
  const gate = new PaymentGate(stubRail(), sm, true);
  let settledTx;
  gate.onSettled = (_c, _i, tx) => { settledTx = tx; };
  const sid = sm.generateSessionId();
  const d = await gate.processPayment("c1", 0, payloadFor(sm, sid, 0));
  // gated + accounted on verify (instant — no waiting on chain finality)
  assert.equal(d.ok, true);
  assert.equal(gate.totalEarnings(), "10000");
  assert.equal(gate.getViewer("c1").segmentsPaid, 1);
  assert.equal(gate.getViewer("c1").enabled, true);
  // one on-chain settle per segment, reported async
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(settledTx, "tx-abc");
});

test("rejects a replayed nonce", async () => {
  const sm = new SessionManager();
  const gate = new PaymentGate(stubRail(), sm, true);
  const sid = sm.generateSessionId();
  const p = payloadFor(sm, sid, 0);
  assert.equal((await gate.processPayment("c1", 0, p)).ok, true);
  assert.equal((await gate.processPayment("c1", 0, p)).ok, false); // replay
});

test("rejects a nonce that doesn't match the segment", async () => {
  const sm = new SessionManager();
  const gate = new PaymentGate(stubRail(), sm, true);
  const sid = sm.generateSessionId();
  const p = payloadFor(sm, sid, 0);
  p.paymentRequirements.nonce = "deadbeef"; // tampered
  assert.equal((await gate.processPayment("c1", 0, p)).ok, false);
});

test("rejects when the rail says the signature is invalid", async () => {
  const sm = new SessionManager();
  const gate = new PaymentGate(stubRail({ valid: false }), sm, true);
  const sid = sm.generateSessionId();
  const d = await gate.processPayment("c1", 0, payloadFor(sm, sid, 0));
  assert.equal(d.ok, false);
  assert.match(d.reason, /bad sig|verification/);
});

test("settleOnVerify=false skips the on-chain settle entirely", async () => {
  const sm = new SessionManager();
  const rail = stubRail();
  let settleCalled = false;
  const orig = rail.settle;
  rail.settle = async (p) => { settleCalled = true; return orig(p); };
  const gate = new PaymentGate(rail, sm, false);
  const sid = sm.generateSessionId();
  const d = await gate.processPayment("c1", 0, payloadFor(sm, sid, 0));
  assert.equal(d.ok, true);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(settleCalled, false);
});

test("a failed on-chain settle does NOT interrupt the already-paid segment", async () => {
  const sm = new SessionManager();
  const gate = new PaymentGate(stubRail({ settleThrows: true }), sm, true);
  let settleErr;
  gate.onSettleError = (_c, _i, e) => { settleErr = e; };
  const sid = sm.generateSessionId();
  const d = await gate.processPayment("c1", 0, payloadFor(sm, sid, 0));
  assert.equal(d.ok, true); // segment enabled despite the settle failing
  assert.equal(gate.getViewer("c1").enabled, true);
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(settleErr instanceof Error);
});

test("viewer lifecycle + multi-viewer earnings", async () => {
  const sm = new SessionManager();
  const gate = new PaymentGate(stubRail(), sm, true);
  const s1 = sm.generateSessionId();
  const s2 = sm.generateSessionId();
  await gate.processPayment("c1", 0, payloadFor(sm, s1, 0, "10000"));
  await gate.processPayment("c2", 0, payloadFor(sm, s2, 0, "5000"));
  assert.equal(gate.totalEarnings(), "15000");
  assert.equal(gate.listViewers().length, 2);
  gate.removeViewer("c1");
  assert.equal(gate.getViewer("c1"), undefined);
  assert.equal(gate.totalEarnings(), "5000");
});
