import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bareHash,
  tagged,
  zeroX,
  bareNonce,
  hexToBytes,
  bytesToHex,
} from "@nickthelegend69/webrtc-payment-rail-x402";

const H = "ab".repeat(32); // 64 hex chars

test("bareHash strips every Casper prefix/tag form", () => {
  for (const v of [
    H,
    "0x" + H,
    "00" + H,
    "account-hash-" + H,
    "contract-package-" + H,
    "hash-" + H,
    ("ACCOUNT-HASH-" + H).toUpperCase(),
  ]) {
    assert.equal(bareHash(v), H, `failed for ${v}`);
  }
});

test("bareHash rejects wrong length", () => {
  assert.throws(() => bareHash("abc"));
  assert.throws(() => bareHash("ab".repeat(31))); // 62 chars
});

test("tagged → 00 + 64hex; zeroX → 0x + 64hex", () => {
  assert.equal(tagged(H), "00" + H);
  assert.equal(tagged("account-hash-" + H), "00" + H);
  assert.equal(zeroX(H), "0x" + H);
});

test("bareNonce normalizes to bare 64-hex", () => {
  assert.equal(bareNonce("0x" + H), H);
  assert.equal(bareNonce(H), H);
  assert.equal(bareNonce("ff"), "0".repeat(62) + "ff"); // left-pads
  assert.equal(bareNonce(H + "ffff").length, 64); // truncates overflow
});

test("hexToBytes / bytesToHex round-trip", () => {
  const bytes = hexToBytes(H);
  assert.equal(bytes.length, 32);
  assert.equal(bytesToHex(bytes), H);
  assert.equal(bytesToHex(hexToBytes("0x" + H)), H);
});
