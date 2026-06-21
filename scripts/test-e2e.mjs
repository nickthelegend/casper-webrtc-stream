/**
 * Offline structural tests — no network, no external deps. Exercises the core
 * gating engine, nonce/replay logic, and DataChannel protocol with a stub rail.
 *
 *   npm test
 *
 * For REAL signature tests run `npm run test:signing` (needs deps installed).
 * For a live facilitator check run `npm run test:facilitator` (needs API key).
 */
import assert from "node:assert";
import {
  SessionManager,
  PaymentGate,
  encodeDC,
  decodeDC,
  dc,
} from "@nickthelegend/webrtc-payment-sdk-core";

let passed = 0;
const ok = (m) => {
  console.log("  ✓ " + m);
  passed++;
};

// stub rail (TEST double — not a product mock)
const stubRail = {
  buildRequirements: (o) => ({
    network: "casper:casper-test",
    scheme: "exact",
    asset: "ab".repeat(32),
    amount: o.amount,
    payTo: "account-hash-" + "11".repeat(32),
    description: "test",
    sessionId: o.sessionId,
    segmentIndex: o.segmentIndex,
    nonce: "cd".repeat(32),
  }),
  buildPayload: async () => {
    throw new Error("not used");
  },
  verify: async () => ({ valid: true }),
  settle: async () => ({ txHash: "ef".repeat(32) }),
};

console.log("Test 1: SessionManager nonce determinism + replay...");
const sm = new SessionManager();
const n1 = sm.generateSegmentNonce("s", 0);
assert.equal(n1, sm.generateSegmentNonce("s", 0), "deterministic");
assert.notEqual(n1, sm.generateSegmentNonce("s", 1), "per-segment");
assert.equal(n1.length, 64, "32-byte hex");
assert.equal(sm.isReplay(n1), false, "first use ok");
assert.equal(sm.isReplay(n1), true, "replay detected");
ok("nonce + replay");

console.log("Test 2: DataChannel protocol round-trips...");
const msg = dc.paymentRequest(3, stubRail.buildRequirements({ amount: "10", sessionId: "s", segmentIndex: 3 }));
const back = decodeDC(encodeDC(msg));
assert.equal(back.type, "segment_payment_request", "type preserved");
assert.equal(back.segmentIndex, 3, "index preserved");
ok("DC encode/decode");

console.log("Test 3: PaymentGate accept → replay reject → earnings...");
const gate = new PaymentGate(stubRail, new SessionManager(), true);
const sessionId = "sess-1";
const mkPayload = (idx, nonce) => ({
  x402Version: 2,
  payload: {
    signature: "01" + "ab".repeat(64),
    publicKey: "01" + "cd".repeat(32),
    authorization: {
      from: "00" + "11".repeat(32),
      to: "00" + "22".repeat(32),
      value: "10000",
      validAfter: "0",
      validBefore: "9999999999",
      nonce,
    },
  },
  paymentRequirements: {
    network: "casper:casper-test",
    scheme: "exact",
    asset: "ab".repeat(32),
    amount: "10000",
    payTo: "account-hash-" + "22".repeat(32),
    description: "seg",
    sessionId,
    segmentIndex: idx,
    nonce,
  },
});
const gsm = gate;
const nonce0 = new SessionManager().generateSegmentNonce(sessionId, 0);
const d0 = await gsm.processPayment("c1", 0, mkPayload(0, nonce0));
assert.equal(d0.ok, true, "segment 0 accepted");
assert.equal(gsm.getViewer("c1").enabled, true, "track enabled");
assert.equal(gsm.totalEarnings(), "10000", "earnings 10000");
const dR = await gsm.processPayment("c1", 0, mkPayload(0, nonce0));
assert.equal(dR.ok, false, "replay rejected");
ok("gate accept/replay/earnings");

console.log(`\n✅ ALL ${passed} OFFLINE TESTS PASSED\n`);
