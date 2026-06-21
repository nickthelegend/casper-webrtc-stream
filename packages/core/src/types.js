/**
 * Shared types for casper-webrtc-stream core SDK.
 *
 * The core is payment-rail agnostic: it knows about PaymentRequirements /
 * PaymentPayload shapes and the PaymentRail interface, but never about
 * Casper, x402, or CSPR.cloud specifics — those live in the rail package.
 */
export const DEFAULT_ICE_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
];
//# sourceMappingURL=types.js.map