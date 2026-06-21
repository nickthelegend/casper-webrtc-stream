import { test } from "node:test";
import assert from "node:assert/strict";
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
const text = (b) => dec.decode(new Uint8Array(b));

test("AES-GCM frame encrypts to opaque bytes and decrypts back", async () => {
  const key = await generateSegmentKey();
  const ct = await encryptFrame(key, frame("segment-0 frame"));
  assert.notEqual(text(ct), "segment-0 frame");
  assert.ok(ct.byteLength > "segment-0 frame".length); // iv + tag overhead
  assert.equal(text(await decryptFrame(key, ct)), "segment-0 frame");
});

test("key survives base64 export/import (DataChannel transport)", async () => {
  const key = await generateSegmentKey();
  const ct = await encryptFrame(key, frame("hello"));
  const reimported = await importKeyB64(await exportKeyB64(key));
  assert.equal(text(await decryptFrame(reimported, ct)), "hello");
});

test("a consumer without the segment key cannot decrypt", async () => {
  const key = await generateSegmentKey();
  const wrong = await generateSegmentKey();
  const ct = await encryptFrame(key, frame("paid content"));
  await assert.rejects(() => decryptFrame(wrong, ct));
});

test("per-segment key rotation locks out a stale key (Mode 3 gate)", async () => {
  const key0 = await generateSegmentKey();
  const key1 = await generateSegmentKey();
  const ctSeg1 = await encryptFrame(key1, frame("segment-1 frame"));
  // a consumer that stopped paying still holds key0 — must NOT decode segment 1
  await assert.rejects(() => decryptFrame(key0, ctSeg1));
  // paying for segment 1 yields key1 → decode resumes
  assert.equal(text(await decryptFrame(key1, ctSeg1)), "segment-1 frame");
});
