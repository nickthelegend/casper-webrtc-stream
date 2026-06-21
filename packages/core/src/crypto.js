/**
 * AES-GCM helpers for Mode 3 (crypto gate).
 *
 * RTP frames are encrypted with a per-segment AES-GCM key via WebRTC
 * Insertable Streams (Encoded Transforms). The provider only sends the
 * decryption key over the DataChannel after payment is confirmed, so a
 * non-paying peer receives ciphertext it cannot decode.
 */
export async function generateSegmentKey() {
    return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}
export async function exportKeyB64(key) {
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
    return btoa(String.fromCharCode(...raw));
}
export async function importKeyB64(b64) {
    const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
function genIV() {
    return crypto.getRandomValues(new Uint8Array(12));
}
export async function encryptFrame(key, plaintext) {
    const iv = genIV();
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, plaintext);
    const out = new Uint8Array(iv.byteLength + ct.byteLength);
    out.set(iv, 0);
    out.set(new Uint8Array(ct), iv.byteLength);
    return out.buffer;
}
export async function decryptFrame(key, data) {
    const bytes = new Uint8Array(data);
    const iv = bytes.slice(0, 12);
    const ct = bytes.slice(12);
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ct);
}
/** Encrypt transform for RTCRtpSender.transform (provider side). */
export function createEncryptTransform(getKey) {
    return new TransformStream({
        async transform(frame, controller) {
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
export function createDecryptTransform(getKey) {
    return new TransformStream({
        async transform(frame, controller) {
            const key = getKey();
            if (!key)
                return;
            try {
                frame.data = await decryptFrame(key, frame.data);
                controller.enqueue(frame);
            }
            catch {
                // wrong / missing key — drop frame
            }
        },
    });
}
//# sourceMappingURL=crypto.js.map