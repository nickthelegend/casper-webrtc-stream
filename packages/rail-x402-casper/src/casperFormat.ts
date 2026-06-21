/**
 * Account-hash / hex representation helpers.
 *
 * Three representations are in play and MUST NOT be confused:
 *   - SDK form:            "account-hash-<64hex>"
 *   - Facilitator JSON:    "00<64hex>"   (00 = account key tag)
 *   - EIP-712 typed data:  "0x<64hex>"   (raw 32-byte value)
 */

// Casper string prefixes seen on account hashes and contract package hashes.
const HASH_PREFIXES = ["account-hash-", "contract-package-", "hash-"];

/** Strip any known prefix/tag and return the bare 64-hex hash (account or pkg). */
export function bareHash(input: string): string {
  let s = input.trim().toLowerCase();
  for (const p of HASH_PREFIXES) {
    if (s.startsWith(p)) {
      s = s.slice(p.length);
      break;
    }
  }
  if (s.startsWith("0x")) s = s.slice(2);
  // "00"-tagged account-key form is 66 chars; bare is 64
  if (s.length === 66 && s.startsWith("00")) s = s.slice(2);
  if (s.length !== 64) {
    throw new Error(`invalid hash (expected 64 hex chars): ${input}`);
  }
  return s;
}

/** Facilitator JSON form: "00<64hex>". */
export function tagged(input: string): string {
  return "00" + bareHash(input);
}

/** EIP-712 form: "0x<64hex>". */
export function zeroX(input: string): string {
  return "0x" + bareHash(input);
}

/** Normalise a 32-byte nonce to bare 64-hex (no prefix). */
export function bareNonce(nonce: string): string {
  let s = nonce.startsWith("0x") ? nonce.slice(2) : nonce;
  if (s.length > 64) s = s.slice(0, 64);
  return s.padStart(64, "0");
}

export function hexToBytes(hex: string): Uint8Array {
  const s = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
  return out;
}

export function bytesToHex(b: Uint8Array): string {
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
