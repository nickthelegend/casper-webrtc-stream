/**
 * AES-GCM helpers for Mode 3 (crypto gate).
 *
 * RTP frames are encrypted with a per-segment AES-GCM key via WebRTC
 * Insertable Streams (Encoded Transforms). The provider only sends the
 * decryption key over the DataChannel after payment is confirmed, so a
 * non-paying peer receives ciphertext it cannot decode.
 */
export declare function generateSegmentKey(): Promise<CryptoKey>;
export declare function exportKeyB64(key: CryptoKey): Promise<string>;
export declare function importKeyB64(b64: string): Promise<CryptoKey>;
export declare function encryptFrame(key: CryptoKey, plaintext: ArrayBuffer): Promise<ArrayBuffer>;
export declare function decryptFrame(key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer>;
/** Encrypt transform for RTCRtpSender.transform (provider side). */
export declare function createEncryptTransform(getKey: () => CryptoKey | null): TransformStream;
/** Decrypt transform for RTCRtpReceiver.transform (consumer side). */
export declare function createDecryptTransform(getKey: () => CryptoKey | null): TransformStream;
//# sourceMappingURL=crypto.d.ts.map