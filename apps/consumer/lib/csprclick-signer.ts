/**
 * Production browser signing for x402 via CSPR.click.
 *
 * The demo path signs with a hot ed25519 key in the browser (insecure). In
 * production the connected wallet signs instead — and crucially it must sign the
 * RAW EIP-712 digest, not a wrapped "Casper Message". CSPR.click exposes exactly
 * that as `signTypedData`, which hashes the typed data the same way the
 * facilitator does and returns a 65-byte Casper signature.
 *
 * This mirrors the official reference almost line-for-line:
 *   make-software/casper-x402 → go/examples/csprclick-x402/src/SignTypedData.tsx
 * Differences for THIS project: we sign the provider-supplied requirements
 * (deterministic, replay-checked nonce) instead of a 402 header, and we return a
 * PaymentPayload in the SDK's shape.
 *
 * ⚠️ Cannot be unit-tested headlessly — it needs `window.csprclick` (load
 * https://cdn.cspr.click/ui/v2.1.0/csprclick-client-2.1.0.js) and a connected
 * wallet. Validate end-to-end against the live facilitator (`npm run
 * test:facilitator` proves the digest; this proves the wallet signs that digest).
 */
import type { PaymentPayload, PaymentRequirements } from "@nickthelegend69/webrtc-payment-sdk-core";

/** Result returned by csprclick.signTypedData. */
interface SignTypedDataResult {
  signatureHex?: string;
  publicKey?: string;
  cancelled?: boolean;
  error?: string;
}

interface CsprClick {
  signTypedData(
    params: unknown,
    signingPublicKey: string,
  ): Promise<SignTypedDataResult | undefined>;
}

function getCsprClick(): CsprClick {
  const ref = (globalThis as { csprclick?: CsprClick }).csprclick;
  if (!ref || typeof ref.signTypedData !== "function") {
    throw new Error(
      "CSPR.click is not loaded. Add the client script " +
        "(https://cdn.cspr.click/ui/v2.1.0/csprclick-client-2.1.0.js) and sign in " +
        "before requesting a signature.",
    );
  }
  return ref;
}

/** Strip prefixes/tags and return the bare 64-hex account hash. */
function bareHash(input: string): string {
  let s = input.trim().toLowerCase();
  for (const p of ["account-hash-", "contract-package-", "hash-"]) {
    if (s.startsWith(p)) s = s.slice(p.length);
  }
  if (s.startsWith("0x")) s = s.slice(2);
  if (s.length === 66 && s.startsWith("00")) s = s.slice(2);
  if (s.length !== 64) throw new Error(`invalid account hash: ${input}`);
  return s;
}

/** Facilitator "00"-tagged account-hash form. */
function tagged(input: string): string {
  return "00" + bareHash(input);
}

export interface CsprClickSignOpts {
  /** Provider-supplied requirements (carries payTo, amount, asset, nonce, extra). */
  requirements: PaymentRequirements;
  /** Connected wallet public key hex (algo-prefixed, e.g. "01…"). */
  publicKeyHex: string;
  /** Payer account hash (any prefix form). If omitted, derive from publicKeyHex
   *  upstream — CSPR.click's account object exposes it on sign-in. */
  accountHash: string;
  /** Seconds the authorization stays valid (facilitator min 6). */
  maxTimeoutSeconds?: number;
  /** Informational resource URL embedded in the payload. */
  resourceUrl?: string;
}

/**
 * Build a signed x402 PaymentPayload using the connected CSPR.click wallet.
 * The wallet hashes the typed data and signs the raw digest, so the result
 * verifies against the facilitator without any message-wrapping mismatch.
 */
export async function signX402PaymentWithCsprClick(
  opts: CsprClickSignOpts,
): Promise<PaymentPayload> {
  const click = getCsprClick();
  const req = opts.requirements;

  const fromTagged = tagged(opts.accountHash);
  const toTagged = tagged(req.payTo);
  const now = Math.floor(Date.now() / 1000);
  // Backdate validAfter (clock-skew tolerance); facilitator rejects validAfter > its now.
  const validAfter = now - 600;
  const validBefore = now + (opts.maxTimeoutSeconds ?? 300);

  // Typed-data shape MUST match the facilitator's verifier (TransferWithAuthorization,
  // camelCase fields, "00"-tagged addresses). The wallet does the hashing.
  const params = {
    typedData: {
      domain: {
        name: req.extra?.name ?? "Cep18x402",
        version: req.extra?.version ?? "1",
        chain_name: req.network,
        contract_package_hash: bareHash(req.asset),
      },
      types: {
        TransferWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      },
      primaryType: "TransferWithAuthorization",
      message: {
        from: fromTagged,
        to: toTagged,
        value: req.amount,
        validAfter,
        validBefore,
        nonce: req.nonce.replace(/^0x/, ""), // bare 32-byte hex
      },
    },
    options: { returnHashArtifacts: true },
  };

  const res = await click.signTypedData(params, opts.publicKeyHex.toLowerCase());
  if (!res || res.cancelled || res.error || !res.signatureHex) {
    throw new Error(res?.error ?? "CSPR.click signing cancelled");
  }

  return {
    x402Version: 2,
    resource: { url: opts.resourceUrl ?? `x402://${req.sessionId}` },
    payload: {
      signature: res.signatureHex,
      publicKey: res.publicKey ?? opts.publicKeyHex,
      authorization: {
        from: fromTagged,
        to: toTagged,
        value: req.amount,
        validAfter: String(validAfter),
        validBefore: String(validBefore),
        nonce: req.nonce.replace(/^0x/, ""),
      },
    },
    paymentRequirements: req,
  };
}
