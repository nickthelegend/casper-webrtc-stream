/**
 * Shared types for casper-webrtc-stream core SDK.
 *
 * The core is payment-rail agnostic: it knows about PaymentRequirements /
 * PaymentPayload shapes and the PaymentRail interface, but never about
 * Casper, x402, or CSPR.cloud specifics — those live in the rail package.
 */

// ─── x402 payment shapes ─────────────────────────────────

/**
 * What a provider asks a consumer to pay. Returned in a 402 response
 * (Mode 1) or over the DataChannel per segment (Mode 2).
 */
/** CEP-18 token metadata used to build the EIP-712 domain. */
export interface TokenMeta {
  name: string;
  version: string;
  decimals?: string;
  symbol?: string;
}

export interface PaymentRequirements {
  /** CAIP-2 network id, e.g. "casper:casper-test" */
  network: string;
  /** Payment scheme. "exact" for fixed-amount CEP-18 transfers. */
  scheme: string;
  /** Asset identifier — CEP-18 contract package hash (64 hex, no prefix) */
  asset: string;
  /** Amount in token base units, decimal string */
  amount: string;
  /** Recipient account hash (SDK form: "account-hash-<64hex>") */
  payTo: string;
  /** Human-readable description */
  description: string;
  /** Session this requirement belongs to */
  sessionId: string;
  /** Segment index for per-segment payments (omitted for whole-stream) */
  segmentIndex?: number;
  /** 32-byte hex nonce (64 chars) for replay protection */
  nonce: string;
  /** Seconds the authorization must remain valid (facilitator min 6) */
  requiredDeadlineSeconds?: number;
  /** Token metadata for the EIP-712 domain (name/version/decimals/symbol) */
  extra?: TokenMeta;
}

/** Accepted payment option echoed inside the x402 v2 payload. */
export interface AcceptedPayment {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  /** payee account hash, facilitator "00<64hex>" form */
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: TokenMeta;
}

/**
 * The signed payment a consumer hands back. Mirrors the x402 payload shape
 * the CSPR.cloud facilitator expects.
 */
/**
 * x402 v2 PaymentPayload — matches the CSPR.cloud facilitator wire shape.
 * `resource`/`accepted` are part of the facilitator body; `paymentRequirements`
 * is kept for internal SDK convenience (gate/replay binding) and is not sent
 * inside `paymentPayload` itself.
 */
export interface PaymentPayload {
  x402Version: number; // must be 2
  resource?: { url: string; description?: string; mimeType?: string };
  accepted?: AcceptedPayment;
  payload: {
    /** 65-byte signature hex (algo-prefix + 64-byte sig) */
    signature: string;
    /** Casper public key hex with algo prefix (01 ed25519 / 02 secp256k1) */
    publicKey: string;
    authorization: {
      /** payer account hash, "00<64hex>" */
      from: string;
      /** payee account hash, "00<64hex>" */
      to: string;
      /** decimal string */
      value: string;
      /** unix seconds, decimal string */
      validAfter: string;
      /** unix seconds, decimal string */
      validBefore: string;
      /** 32-byte hex nonce (64 chars) */
      nonce: string;
    };
  };
  /** Internal-only: the requirements this payload satisfies. */
  paymentRequirements?: PaymentRequirements;
}

// ─── Payment rail (pluggable) ────────────────────────────

export interface BuildRequirementsOpts {
  amount: string;
  sessionId: string;
  segmentIndex?: number;
}

export interface VerifyResult {
  valid: boolean;
  error?: string;
}

export interface SettleResult {
  txHash: string;
}

/**
 * Pluggable payment rail. The core SDK only ever talks to a rail through
 * this interface; CasperX402Rail is the first implementation.
 *
 * `signFn` is an async signer the consumer supplies (CSPR.click in the
 * browser, or a raw test key for the hackathon demo).
 */
export interface PaymentRail {
  /** Provider side: describe what must be paid. */
  buildRequirements(opts: BuildRequirementsOpts): PaymentRequirements;

  /** Consumer side: sign + assemble a payload that satisfies `requirements`. */
  buildPayload(
    requirements: PaymentRequirements,
    signFn: SignFn,
  ): Promise<PaymentPayload>;

  /** Provider side: verify a payload without settling (gate before SDP/segment). */
  verify(payload: PaymentPayload): Promise<VerifyResult>;

  /** Provider side: settle on-chain (after stream/segment is delivered). */
  settle(payload: PaymentPayload): Promise<SettleResult>;
}

/**
 * Consumer-supplied signer. Receives the EIP-712 typed-data digest (hex)
 * and returns a signature (hex). Plugs in CSPR.click or a raw key.
 */
export type SignFn = (typedDataDigestHex: string) => Promise<string>;

// ─── Gating ──────────────────────────────────────────────

export type GatingMode = "signaling" | "track" | "crypto";

export interface GatingConfig {
  mode: GatingMode;
  /** For track/crypto mode: how often a payment is required. */
  segmentDurationSeconds?: number;
  /** For track/crypto mode: price per segment, in motes/base units. */
  pricePerSegment?: string;
  /** For signaling mode: one-off price for the whole session. */
  pricePerSession?: string;
}

// ─── DataChannel payment protocol (Mode 2 / 3) ───────────

export type DCMessage =
  | {
      type: "segment_payment_request";
      segmentIndex: number;
      requirements: PaymentRequirements;
    }
  | {
      type: "segment_payment_proof";
      segmentIndex: number;
      payload: PaymentPayload;
    }
  | { type: "segment_confirmed"; segmentIndex: number; txHash?: string }
  | { type: "segment_rejected"; segmentIndex: number; reason: string }
  | {
      type: "segment_key";
      segmentIndex: number;
      /** base64 raw AES-GCM key — crypto mode (Mode 3) only */
      key: string;
    }
  | {
      type: "stream_suspended";
      reason: "payment_missed" | "max_segments_reached";
    }
  | { type: "stream_resumed" };

// ─── Signaling transport ─────────────────────────────────

export type SignalingMessageType =
  | "offer"
  | "answer"
  | "ice-candidate"
  | "join"
  | "joined"
  | "leave"
  | "ping"
  | "pong"
  | "error";

export interface SignalingMessage {
  type: SignalingMessageType;
  /** Room / stream id */
  room: string;
  /** Sender peer id */
  from?: string;
  /** Target peer id (omit to broadcast to room) */
  to?: string;
  payload?: unknown;
}

// ─── Peer config ─────────────────────────────────────────

export interface ProviderConfig {
  paymentRail: PaymentRail;
  gating: GatingConfig;
  signalingServerUrl: string;
  iceServers?: RTCIceServer[];
  /** Defaults to a random UUID. */
  room?: string;
}

export interface ConsumerConfig {
  paymentRail: PaymentRail;
  signalingServerUrl: string;
  /** The consumer's account hash / public key (sender of payments). */
  walletAddress: string;
  /** Async signer (CSPR.click in browser, raw key for demo). */
  signFn: SignFn;
  iceServers?: RTCIceServer[];
  /** Mode 3: the stream is AES-GCM encrypted; install the decrypt pipeline and
   *  apply per-segment keys delivered over the DataChannel after payment. */
  cryptoMode?: boolean;
}

export interface AutoPaymentConfig {
  /** Hard cap on total spend, in motes/base units. */
  maxTotalSpend: string;
  onPayment?: (amount: string, segmentIndex: number) => void;
  onMaxReached?: () => void;
}

// ─── Viewer accounting (provider side) ───────────────────

export interface ViewerState {
  consumerId: string;
  address?: string;
  segmentsPaid: number;
  totalPaid: string;
  enabled: boolean;
  lastSegmentIndex: number;
}

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  // Free TURN relay so the connection still forms when direct host/reflexive
  // candidates can't connect — e.g. Chrome's mDNS (.local) host candidates not
  // resolving between two local browser contexts, VPNs, or restrictive networks.
  // Without a relay, localhost-to-localhost WebRTC silently fails ICE.
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];
