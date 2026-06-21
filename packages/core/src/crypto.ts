/**
 * AES-GCM helpers for Mode 3 (crypto gate).
 *
 * RTP frames are encrypted with a per-segment AES-GCM key via WebRTC
 * Insertable Streams (Encoded Transforms). The provider only sends the
 * decryption key over the DataChannel after payment is confirmed, so a
 * non-paying peer receives ciphertext it cannot decode.
 */

export async function generateSegmentKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function exportKeyB64(key: CryptoKey): Promise<string> {
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  return btoa(String.fromCharCode(...raw));
}

export async function importKeyB64(b64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "raw",
    raw as BufferSource,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function genIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12));
}

export async function encryptFrame(
  key: CryptoKey,
  plaintext: ArrayBuffer,
): Promise<ArrayBuffer> {
  const iv = genIV();
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    plaintext,
  );
  const out = new Uint8Array(iv.byteLength + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), iv.byteLength);
  return out.buffer;
}

export async function decryptFrame(
  key: CryptoKey,
  data: ArrayBuffer,
): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(data);
  const iv = bytes.slice(0, 12);
  const ct = bytes.slice(12);
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ct as BufferSource,
  );
}

/** Encrypt transform for RTCRtpSender.transform (provider side). */
export function createEncryptTransform(getKey: () => CryptoKey | null): TransformStream {
  return new TransformStream({
    async transform(frame: any, controller: any) {
      const key = getKey();
      if (!key) {
        // no key yet — drop the frame (consumer hasn't paid)
        return;
      }
      frame.data = await encryptFrame(key, frame.data);
      controller.enqueue(frame);
    },
  });
}

/** Decrypt transform for RTCRtpReceiver.transform (consumer side). */
export function createDecryptTransform(getKey: () => CryptoKey | null): TransformStream {
  return new TransformStream({
    async transform(frame: any, controller: any) {
      const key = getKey();
      if (!key) return;
      try {
        frame.data = await decryptFrame(key, frame.data);
        controller.enqueue(frame);
      } catch {
        // wrong / missing key — drop frame
      }
    },
  });
}

/** True if this runtime exposes WebRTC Encoded Transforms (insertable streams). */
export function encodedTransformsSupported(): boolean {
  return (
    typeof RTCRtpSender !== "undefined" &&
    // Chrome legacy createEncodedStreams, or the standardized RTCRtpScriptTransform.
    ("createEncodedStreams" in RTCRtpSender.prototype ||
      typeof (globalThis as any).RTCRtpScriptTransform === "function")
  );
}

/**
 * Install the AES-GCM encrypt pipeline on a sender (provider side). Returns true
 * if wired. Browser-only (needs Encoded Transforms); a no-op elsewhere. The
 * RTCPeerConnection must be created with `{ encodedInsertableStreams: true }`.
 */
export function installSenderEncryption(
  sender: RTCRtpSender,
  getKey: () => CryptoKey | null,
): boolean {
  const s = sender as any;
  if (typeof s.createEncodedStreams !== "function") return false;
  const { readable, writable } = s.createEncodedStreams();
  readable.pipeThrough(createEncryptTransform(getKey)).pipeTo(writable);
  return true;
}

/** Install the AES-GCM decrypt pipeline on a receiver (consumer side). */
export function installReceiverDecryption(
  receiver: RTCRtpReceiver,
  getKey: () => CryptoKey | null,
): boolean {
  const r = receiver as any;
  if (typeof r.createEncodedStreams !== "function") return false;
  const { readable, writable } = r.createEncodedStreams();
  readable.pipeThrough(createDecryptTransform(getKey)).pipeTo(writable);
  return true;
}
