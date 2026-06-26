/**
 * x402 over HTTP — the canonical "402 → pay → retry" flow, framework-agnostic.
 *
 * This is what makes the SDK droppable into ANY app: a server gates a route
 * behind a payment; a client auto-pays and retries. It depends only on the
 * abstract `PaymentRail` + `SignFn`, so it works with any rail (Casper x402
 * today) and any HTTP stack (fetch, Express, Next, Hono, plain http).
 *
 *   client:  wrapFetch(fetch, { rail, signFn })  → 402s are paid + retried
 *   server:  paymentMiddleware({ rail, amount, payTo })  → Express/connect gate
 *            new X402Gate(...).process(header)            → framework-agnostic
 *
 * Wire format: the signed `PaymentPayload` is base64-JSON in the `X-PAYMENT`
 * request header; the 402 response body is `{ x402Version, accepts: [requirements] }`.
 */
import type {
  PaymentPayload,
  PaymentRail,
  PaymentRequirements,
  SignFn,
} from "./types.js";

/** Request header carrying the signed payment (base64-encoded JSON payload). */
export const X402_PAYMENT_HEADER = "x-payment";
/** Response header echoing the on-chain settlement tx hash. */
export const X402_TX_HEADER = "x-payment-tx";

/** Typed error so callers can branch on `.code`. */
export class X402Error extends Error {
  constructor(
    readonly code:
      | "payment_required"
      | "payment_exceeds_max"
      | "invalid_payment"
      | "verify_failed"
      | "settle_failed"
      | "bad_requirements",
    message: string,
  ) {
    super(message);
    this.name = "X402Error";
  }
}

// ─── codec (browser + node) ──────────────────────────────

export function encodePayment(payload: PaymentPayload): string {
  const json = JSON.stringify(payload);
  if (typeof btoa !== "undefined") {
    return btoa(unescape(encodeURIComponent(json)));
  }
  // eslint-disable-next-line no-undef
  return Buffer.from(json, "utf8").toString("base64");
}

export function decodePayment(header: string): PaymentPayload {
  let json: string;
  if (typeof atob !== "undefined") {
    json = decodeURIComponent(escape(atob(header)));
  } else {
    // eslint-disable-next-line no-undef
    json = Buffer.from(header, "base64").toString("utf8");
  }
  return JSON.parse(json) as PaymentPayload;
}

/** Normalize an account hash / contract hash for equality checks. */
function normHash(s: string): string {
  return s
    .toLowerCase()
    .replace(/^account-hash-/, "")
    .replace(/^hash-/, "")
    .replace(/^contract-package-/, "")
    .replace(/^0x/, "")
    .replace(/^00/, "");
}

// ─── client: auto-paying fetch ───────────────────────────

interface MinimalResponse {
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}
type FetchLike = (input: any, init?: any) => Promise<MinimalResponse>;

export interface WrapFetchOpts {
  rail: PaymentRail;
  signFn: SignFn;
  /** Refuse to auto-pay above this amount (base units). Safety cap. */
  maxValue?: string;
  /** Called right before the paid retry. */
  onPayment?: (req: PaymentRequirements, payload: PaymentPayload) => void;
}

/** Parse a 402 response body into PaymentRequirements. */
async function readRequirements(res: MinimalResponse): Promise<PaymentRequirements> {
  let body: any;
  try {
    body = await res.json();
  } catch {
    throw new X402Error("bad_requirements", "402 response had no JSON body");
  }
  const req = Array.isArray(body?.accepts) ? body.accepts[0] : body;
  if (!req || typeof req.amount !== "string" || !req.payTo) {
    throw new X402Error("bad_requirements", "402 body missing payment requirements");
  }
  return req as PaymentRequirements;
}

function mergeHeader(init: any, name: string, value: string): any {
  const out = { ...(init ?? {}) };
  const h = out.headers;
  if (h && typeof h.set === "function") {
    // Headers instance
    const copy = new Headers(h as Headers);
    copy.set(name, value);
    out.headers = copy;
  } else {
    out.headers = { ...(h ?? {}), [name]: value };
  }
  return out;
}

/**
 * Wrap a `fetch` so any `402 Payment Required` is paid (via the rail + signer)
 * and the request is retried once with the `X-PAYMENT` header.
 *
 *   const pay = wrapFetch(fetch, { rail, signFn, maxValue: "1000000000" });
 *   const res = await pay("https://api.example.com/premium");  // just works
 */
export function wrapFetch(baseFetch: FetchLike, opts: WrapFetchOpts): FetchLike {
  return async (input: any, init?: any): Promise<MinimalResponse> => {
    const res = await baseFetch(input, init);
    if (res.status !== 402) return res;

    const requirements = await readRequirements(res);
    if (opts.maxValue && BigInt(requirements.amount) > BigInt(opts.maxValue)) {
      throw new X402Error(
        "payment_exceeds_max",
        `payment ${requirements.amount} exceeds maxValue ${opts.maxValue}`,
      );
    }
    const payload = await opts.rail.buildPayload(requirements, opts.signFn);
    opts.onPayment?.(requirements, payload);
    const paidInit = mergeHeader(init, X402_PAYMENT_HEADER, encodePayment(payload));
    return baseFetch(input, paidInit);
  };
}

// ─── server: payment gate ────────────────────────────────

export interface X402GateConfig {
  rail: PaymentRail;
  /** Required price in base units (string), or a per-request function. */
  amount: string | ((reqCtx: unknown) => string);
  /** Expected payee account hash — the payment MUST go here. */
  payTo: string;
  /** Optional: pin the accepted token/asset contract hash. */
  asset?: string;
  /** Optional: pin the network (e.g. "casper:casper-test"). */
  network?: string;
  /** Settle on-chain after a valid verify. Default true. */
  settle?: boolean;
  /** Derive a session id for the requirements. */
  sessionId?: (reqCtx: unknown) => string;
}

export interface X402GateResult {
  ok: boolean;
  /** 402 when payment is required/invalid; 200 when satisfied. */
  status: number;
  /** Present on 402 — hand back to the client. */
  requirements?: PaymentRequirements;
  /** Present when settled on-chain. */
  txHash?: string;
  /** The verified payer account hash. */
  payer?: string;
  error?: string;
}

let _sessionCounter = 0;

/**
 * Framework-agnostic payment gate. Build a 402 challenge when there's no
 * payment, and verify (+ settle) when the `X-PAYMENT` header is present.
 * Validates the payment against server policy (payTo / amount / asset) so a
 * client can't under-pay or redirect funds.
 */
export class X402Gate {
  constructor(private cfg: X402GateConfig) {
    if (!cfg.payTo) throw new Error("X402Gate: payTo is required");
  }

  private requiredAmount(reqCtx: unknown): string {
    return typeof this.cfg.amount === "function"
      ? this.cfg.amount(reqCtx)
      : this.cfg.amount;
  }

  /** Build the 402 challenge body for a request with no (valid) payment. */
  challenge(reqCtx?: unknown): X402GateResult {
    const sessionId =
      this.cfg.sessionId?.(reqCtx) ?? `x402-${Date.now()}-${_sessionCounter++}`;
    const requirements = this.cfg.rail.buildRequirements({
      amount: this.requiredAmount(reqCtx),
      sessionId,
    });
    return { ok: false, status: 402, requirements };
  }

  /** Process an incoming request. Pass the raw X-PAYMENT header value. */
  async process(headerValue?: string, reqCtx?: unknown): Promise<X402GateResult> {
    if (!headerValue) return this.challenge(reqCtx);

    let payload: PaymentPayload;
    try {
      payload = decodePayment(headerValue);
    } catch {
      return { ...this.challenge(reqCtx), error: "malformed X-PAYMENT header" };
    }

    // ── policy: don't trust the client's requirements blindly ──
    const req = payload.paymentRequirements;
    if (!req) {
      return { ...this.challenge(reqCtx), error: "payload missing requirements" };
    }
    const need = BigInt(this.requiredAmount(reqCtx));
    if (BigInt(req.amount) < need) {
      return { ...this.challenge(reqCtx), error: `underpaid: ${req.amount} < ${need}` };
    }
    if (normHash(req.payTo) !== normHash(this.cfg.payTo)) {
      return { ...this.challenge(reqCtx), error: "payTo mismatch" };
    }
    if (this.cfg.asset && normHash(req.asset) !== normHash(this.cfg.asset)) {
      return { ...this.challenge(reqCtx), error: "asset mismatch" };
    }
    if (this.cfg.network && req.network !== this.cfg.network) {
      return { ...this.challenge(reqCtx), error: "network mismatch" };
    }

    // ── verify (gate) ──
    const v = await this.cfg.rail.verify(payload);
    if (!v.valid) {
      return { ...this.challenge(reqCtx), error: v.error ?? "verify failed" };
    }
    const payer = payload.payload?.authorization?.from;

    // ── settle (on-chain) ──
    if (this.cfg.settle === false) {
      return { ok: true, status: 200, payer };
    }
    try {
      const { txHash } = await this.cfg.rail.settle(payload);
      return { ok: true, status: 200, txHash, payer };
    } catch (err) {
      return { ok: false, status: 402, error: `settle failed: ${(err as Error).message}` };
    }
  }
}

/** Shape of an Express/connect-style request/response (duck-typed, no dep). */
interface ReqLike {
  headers: Record<string, string | string[] | undefined>;
}
interface ResLike {
  status(code: number): unknown;
  setHeader(name: string, value: string): unknown;
  end(body?: string): unknown;
}

/**
 * Express / connect / Next-API middleware. Gates the handler behind a payment.
 * On success it sets `X-Payment-Tx` and calls `next()`; otherwise it answers
 * `402` with `{ x402Version, accepts: [requirements] }`.
 *
 *   app.get("/premium", paymentMiddleware({ rail, amount: "100000000", payTo }), handler);
 */
export function paymentMiddleware(cfg: X402GateConfig) {
  const gate = new X402Gate(cfg);
  return async (req: ReqLike, res: ResLike, next: () => void): Promise<void> => {
    const raw = req.headers[X402_PAYMENT_HEADER];
    const header = Array.isArray(raw) ? raw[0] : raw;
    const result = await gate.process(header, req);
    if (result.ok) {
      if (result.txHash) res.setHeader(X402_TX_HEADER, result.txHash);
      next();
      return;
    }
    res.status(402);
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        x402Version: 2,
        accepts: result.requirements ? [result.requirements] : [],
        error: result.error,
      }),
    );
  };
}
