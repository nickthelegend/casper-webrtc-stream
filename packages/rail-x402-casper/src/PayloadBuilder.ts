/**
 * Builds the real x402 v2 PaymentPayload + facilitator-shaped requirements.
 */
import type {
  AcceptedPayment,
  PaymentPayload,
  PaymentRequirements,
  SignFn,
  TokenMeta,
} from "@nickthelegend69/webrtc-payment-sdk-core";
import type { CasperNetwork } from "./types.js";
import type { WireRequirements } from "./FacilitatorClient.js";
import { buildTransferDigest, signEd25519 } from "./Eip712Signer.js";
import { bareHash, bareNonce, bytesToHex, tagged } from "./casperFormat.js";

export function buildExtra(token: TokenMeta): Record<string, string> {
  const extra: Record<string, string> = {
    name: token.name,
    version: token.version,
  };
  if (token.decimals) extra.decimals = token.decimals;
  if (token.symbol) extra.symbol = token.symbol;
  return extra;
}

export function buildWireRequirements(
  req: PaymentRequirements,
  token: TokenMeta,
  maxTimeoutSeconds: number,
): WireRequirements {
  return {
    scheme: "exact",
    network: req.network,
    payTo: tagged(req.payTo),
    amount: req.amount,
    asset: bareHash(req.asset), // facilitator wants the bare 64-hex package hash
    maxTimeoutSeconds,
    extra: buildExtra(token),
  };
}

export interface BuildPayloadOpts {
  requirements: PaymentRequirements;
  network: CasperNetwork;
  tokenContractHash: string;
  token: TokenMeta;
  from: string;
  publicKeyHex: string;
  maxTimeoutSeconds: number;
  resourceUrl: string;
  signDigest?: SignFn;
  privateKeyHex?: string;
}

export async function buildPaymentPayload(
  opts: BuildPayloadOpts,
): Promise<PaymentPayload> {
  const now = Math.floor(Date.now() / 1000);
  // Backdate validAfter by 10 min so minor clock skew can't make the
  // facilitator reject us with `not_yet_valid` (it checks validAfter > its now).
  // Matches the reference client (exact/client/scheme.ts).
  const validAfter = now - 600;
  const validBefore = now + opts.maxTimeoutSeconds;
  const value = opts.requirements.amount;
  const nonce = opts.requirements.nonce;

  const digest = buildTransferDigest({
    network: opts.network,
    tokenContractHash: opts.tokenContractHash,
    token: opts.token,
    from: opts.from,
    to: opts.requirements.payTo,
    value,
    validAfter,
    validBefore,
    nonce,
  });
  const digestHex = bytesToHex(digest);

  let signature: string;
  if (opts.signDigest) {
    signature = await opts.signDigest(digestHex);
  } else if (opts.privateKeyHex) {
    signature = await signEd25519(digest, opts.privateKeyHex);
  } else {
    throw new Error(
      "no signer: provide signDigest (CSPR.click) or consumerPrivateKeyHex",
    );
  }

  const accepted: AcceptedPayment = {
    scheme: "exact",
    network: opts.network,
    asset: bareHash(opts.tokenContractHash),
    amount: value,
    payTo: tagged(opts.requirements.payTo),
    maxTimeoutSeconds: opts.maxTimeoutSeconds,
    extra: opts.token,
  };

  return {
    x402Version: 2,
    resource: { url: opts.resourceUrl },
    accepted,
    payload: {
      signature,
      publicKey: opts.publicKeyHex,
      authorization: {
        from: tagged(opts.from),
        to: tagged(opts.requirements.payTo),
        value,
        validAfter: String(validAfter),
        validBefore: String(validBefore),
        nonce: bareNonce(nonce),
      },
    },
    paymentRequirements: opts.requirements,
  };
}
