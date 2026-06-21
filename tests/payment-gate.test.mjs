import { test } from "node:test";
import assert from "node:assert/strict";
import { PaymentGate, SessionManager } from "@nickthelegend/webrtc-payment-sdk-core";

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

test("accepts a valid payment, settles, accrues earnings", async () => {
  const sm = new SessionManager();
  const gate = new PaymentGate(stubRail(), sm, true);
  const sid = sm.generateSessionId();
  const d = await gate.processPayment("c1", 0, payloadFor(sm, sid, 0));
  assert.equal(d.ok, true);
  assert.equal(d.txHash, "tx-abc");
  assert.equal(gate.totalEarnings(), "10000");
  assert.equal(gate.getViewer("c1").segmentsPaid, 1);
  assert.equal(gate.getViewer("c1").enabled, true);
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

test("verify-only mode (track gate) does not settle", async () => {
  const sm = new SessionManager();
  // settleThrows would explode IF settle were called — proves it isn't
  const gate = new PaymentGate(stubRail({ settleThrows: true }), sm, false);
  const sid = sm.generateSessionId();
  const d = await gate.processPayment("c1", 0, payloadFor(sm, sid, 0));
  assert.equal(d.ok, true);
  assert.equal(d.txHash, undefined);
});

test("a failed settle still lets the stream continue (deferred)", async () => {
  const sm = new SessionManager();
  const gate = new PaymentGate(stubRail({ settleThrows: true }), sm, true);
  const sid = sm.generateSessionId();
  const d = await gate.processPayment("c1", 0, payloadFor(sm, sid, 0));
  assert.equal(d.ok, true);
  assert.match(d.reason, /settle deferred/);
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
