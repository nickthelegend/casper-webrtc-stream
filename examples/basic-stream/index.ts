/**
 * basic-stream — minimal integration (browser context).
 *
 * Provider and consumer shown together; in a real app each runs in its own tab.
 * Payments are REAL: the consumer signs an EIP-712 TransferAuthorization and the
 * provider settles via the CSPR.cloud facilitator. Requires a deployed CEP-18
 * x402 token + a CSPR.cloud API key (see STATUS.md).
 */
import {
  PaywalledRTCProvider,
  PaywalledRTCConsumer,
  type GatingConfig,
  type SignFn,
  type TokenMeta,
} from "@nickthelegend/webrtc-payment-sdk-core";
import { CasperX402Rail } from "@nickthelegend/webrtc-payment-rail-x402";

const SIGNALING = "ws://localhost:3001";
const TOKEN: TokenMeta = { name: "Cep18x402", version: "1", decimals: "2", symbol: "CSPR" };

// ── PROVIDER ────────────────────────────────────────────
export async function runProvider() {
  const rail = new CasperX402Rail({
    facilitatorUrl: "https://x402-facilitator.cspr.cloud",
    facilitatorApiKey: process.env.CSPR_CLOUD_API_KEY, // server-side only
    network: "casper:casper-test",
    tokenContractHash: process.env.CEP18_TOKEN_CONTRACT!,
    token: TOKEN,
    providerAccountHash: process.env.PROVIDER_ACCOUNT_HASH!,
  });

  const gating: GatingConfig = {
    mode: "track",
    segmentDurationSeconds: 5,
    pricePerSegment: "10000",
  };

  const provider = new PaywalledRTCProvider({
    paymentRail: rail,
    gating,
    signalingServerUrl: SIGNALING,
  });
  provider.on("consumer:paid", (id, amt) => console.log(`paid: ${id} ${amt}`));

  const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  await provider.startStream(media);
  console.log("share:", `http://localhost:3002/?room=${provider.room}`);
}

// ── CONSUMER ────────────────────────────────────────────
export async function runConsumer(
  room: string,
  walletAddress: string,
  publicKeyHex: string,
  signFn: SignFn,
) {
  const rail = new CasperX402Rail({
    facilitatorUrl: "https://x402-facilitator.cspr.cloud",
    network: "casper:casper-test",
    tokenContractHash: process.env.CEP18_TOKEN_CONTRACT!,
    token: TOKEN,
    consumerAccountHash: walletAddress,
    consumerPublicKeyHex: publicKeyHex,
  });

  const consumer = new PaywalledRTCConsumer({
    paymentRail: rail,
    signalingServerUrl: SIGNALING,
    walletAddress,
    signFn,
  });

  consumer.enableAutoPayment({
    maxTotalSpend: "1000000000",
    onPayment: (amt, i) => console.log(`paid segment ${i}: ${amt}`),
    onMaxReached: () => console.log("budget cap reached"),
  });

  const { stream } = await consumer.joinStream(`${SIGNALING}?room=${room}`);
  const video = document.querySelector("video")!;
  video.srcObject = stream;
}
