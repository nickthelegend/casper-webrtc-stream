import { test } from "node:test";
import assert from "node:assert/strict";
import { dc, encodeDC, decodeDC, DC_LABEL } from "@nickthelegend/webrtc-payment-sdk-core";

const reqs = {
  network: "casper:casper-test",
  scheme: "exact",
  asset: "ab".repeat(32),
  amount: "10000",
  payTo: "account-hash-" + "22".repeat(32),
  description: "seg",
  sessionId: "s",
  nonce: "00".repeat(32),
};
const payload = {
  x402Version: 2,
  payload: {
    signature: "01" + "00".repeat(64),
    publicKey: "01" + "00".repeat(32),
    authorization: { from: "00" + "11".repeat(32), to: "00" + "22".repeat(32), value: "10000", validAfter: "0", validBefore: "9", nonce: "ab".repeat(32) },
  },
};

test("every DC message type round-trips through encode/decode", () => {
  const messages = [
    dc.paymentRequest(3, reqs),
    dc.paymentProof(3, payload),
    dc.confirmed(3, "txhash"),
    dc.confirmed(3),
    dc.rejected(3, "no funds"),
    dc.key(3, "YmFzZTY0a2V5"),
    dc.suspended("payment_missed"),
    dc.resumed(),
  ];
  for (const m of messages) {
    // the protocol IS a JSON round-trip, so compare against the JSON-normalized
    // message (JSON drops `undefined` values, e.g. an omitted txHash)
    assert.deepEqual(decodeDC(encodeDC(m)), JSON.parse(JSON.stringify(m)));
  }
});

test("decodeDC returns null on non-protocol input", () => {
  assert.equal(decodeDC("not json"), null);
  assert.equal(decodeDC("{}"), null); // object without a type
  assert.equal(decodeDC("123"), null); // primitive
  assert.equal(decodeDC('"hi"'), null);
});

test("DC_LABEL is a stable string", () => {
  assert.equal(typeof DC_LABEL, "string");
  assert.ok(DC_LABEL.length > 0);
});
