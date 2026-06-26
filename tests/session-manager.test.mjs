import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { SessionManager } from "@nickthelegend69/webrtc-payment-sdk-core";

test("generateSegmentNonce matches real SHA-256 and is deterministic", () => {
  const sm = new SessionManager();
  const sid = "session-xyz";
  const n0 = sm.generateSegmentNonce(sid, 0);
  // validates the pure-JS SHA-256 against Node's crypto
  const expected = crypto.createHash("sha256").update(`${sid}:0`).digest("hex");
  assert.equal(n0, expected);
  assert.equal(n0.length, 64);
  assert.equal(sm.generateSegmentNonce(sid, 0), n0, "deterministic");
  assert.notEqual(sm.generateSegmentNonce(sid, 1), n0, "varies by segment");
});

test("validateNonce: accepts expected once, rejects replay + mismatch", () => {
  const sm = new SessionManager();
  const sid = sm.generateSessionId();
  const nonce = sm.generateSegmentNonce(sid, 5);
  assert.equal(sm.validateNonce("deadbeef", sid, 5), false, "wrong nonce");
  assert.equal(sm.validateNonce(nonce, sid, 5), true, "first use");
  assert.equal(sm.validateNonce(nonce, sid, 5), false, "replay");
});

test("isReplay records first use, flags repeats", () => {
  const sm = new SessionManager();
  assert.equal(sm.isReplay("nonce-a"), false);
  assert.equal(sm.isReplay("nonce-a"), true);
  assert.equal(sm.isReplay("nonce-b"), false);
});

test("generateSessionId returns unique UUIDs", () => {
  const sm = new SessionManager();
  const a = sm.generateSessionId();
  const b = sm.generateSessionId();
  assert.notEqual(a, b);
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});
