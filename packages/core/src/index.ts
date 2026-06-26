/**
 * @nickthelegend69/webrtc-payment-sdk-core
 * Rail-agnostic core for paywalled WebRTC streams on any payment rail.
 */
export * from "./types.js";
export { TypedEmitter } from "./emitter.js";
export { SessionManager } from "./SessionManager.js";
export { PaymentGate } from "./PaymentGate.js";
export type { GateDecision } from "./PaymentGate.js";
export { SignalingClient } from "./SignalingClient.js";
export { PaywalledRTCProvider } from "./PaywalledRTCProvider.js";
export { PaywalledRTCConsumer } from "./PaywalledRTCConsumer.js";
export {
  DC_LABEL,
  dc,
  encodeDC,
  decodeDC,
} from "./DataChannelProtocol.js";
export {
  generateSegmentKey,
  exportKeyB64,
  importKeyB64,
  encryptFrame,
  decryptFrame,
  createEncryptTransform,
  createDecryptTransform,
  encodedTransformsSupported,
  installSenderEncryption,
  installReceiverDecryption,
} from "./crypto.js";
export {
  X402_PAYMENT_HEADER,
  X402_TX_HEADER,
  X402Error,
  X402Gate,
  encodePayment,
  decodePayment,
  wrapFetch,
  paymentMiddleware,
} from "./x402http.js";
export type {
  WrapFetchOpts,
  X402GateConfig,
  X402GateResult,
} from "./x402http.js";
