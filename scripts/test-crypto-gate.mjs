/**
 * Mode 3 (crypto gate) offline proof.
 *
 *   npm run test:crypto
 *
 * The WebRTC Encoded-Transform plumbing only runs in a browser, but the
 * security property of Mode 3 is pure crypto and is fully testable here with
 * the SAME functions the provider/consumer use. This proves:
 *   1. a frame encrypted for segment N is opaque without that segment's key,
 *   2. delivering the key (as base64 over the DataChannel) recovers the exact
 *      plaintext,
 *   3. rotating the key per segment means a stale key can't decode new frames
 *      — i.e. a consumer that stops paying stops being able to watch.
 */
import assert from "node:assert";
import {
  generateSegmentKey,
  exportKeyB64,
  importKeyB64,
  encryptFrame,
  decryptFrame,
} from "@nickthelegend/webrtc-payment-sdk-core";

const enc = new TextEncoder();
const dec = new TextDecoder();
const frame = (s) => enc.encode(s).buffer;
const text = (buf) => dec.decode(new Uint8Array(buf));

// ── segment 0: provider encrypts; consumer has no key yet ────────────────────
const key0 = await generateSegmentKey();
const plaintext0 = "🎥 segment-0 video frame";
const cipher0 = await encryptFrame(key0, frame(plaintext0));

assert.notEqual(text(cipher0), plaintext0, "ciphertext must not equal plaintext");

// consumer without the key cannot recover the frame (wrong key → throws)
const wrongKey = await generateSegmentKey();
await assert.rejects(
  () => decryptFrame(wrongKey, cipher0),
  "a consumer without segment-0's key must NOT decrypt it",
);

// ── payment lands: provider releases key0 (base64) over the DataChannel ───────
const key0b64 = await exportKeyB64(key0);
const consumerKey0 = await importKeyB64(key0b64);
const recovered0 = await decryptFrame(consumerKey0, cipher0);
assert.equal(text(recovered0), plaintext0, "paid consumer recovers the exact frame");

// ── segment 1: provider rotates the key; consumer hasn't paid for it yet ──────
const key1 = await generateSegmentKey();
const plaintext1 = "🎥 segment-1 video frame";
const cipher1 = await encryptFrame(key1, frame(plaintext1));

// the stale segment-0 key must NOT decode segment-1 (the gate holds over time)
await assert.rejects(
  () => decryptFrame(consumerKey0, cipher1),
  "stale key must not decode the next segment — non-payment = no video",
);

// pay for segment 1 → get key1 → decode resumes
const consumerKey1 = await importKeyB64(await exportKeyB64(key1));
assert.equal(
  text(await decryptFrame(consumerKey1, cipher1)),
  plaintext1,
  "paying for segment 1 restores video",
);

console.log("  ✓ encrypted frame is opaque without the segment key");
console.log("  ✓ releasing the key on payment recovers the exact frame");
console.log("  ✓ per-segment key rotation gates a non-paying consumer");
console.log(
  "\n✅ CRYPTO-GATE (Mode 3) TEST PASSED — security property verified offline.\n" +
    "   (The WebRTC Encoded-Transform wiring runs in a supporting browser; the\n" +
    "    crypto that makes it trust-free is what's proven here.)\n",
);
