/**
 * ai-agent-stream — an autonomous agent as a paying viewer.
 *
 * Demonstrates the agentic angle: an AI agent (here, a headless Node process)
 * subscribes to a paid stream and settles micropayments per segment via x402,
 * with a hard budget cap. Swap the "analysis" step for real inference.
 *
 * Headless WebRTC: Node has no native RTCPeerConnection, so we polyfill the
 * WebRTC globals with `werift` before importing the SDK. We also polyfill
 * WebSocket with `ws`.
 *
 *   npm -w @casper-webrtc/example-ai-agent-stream start -- <room> <wsUrl>
 */
import {
  RTCPeerConnection,
  MediaStream as WeriftMediaStream,
} from "werift";
import WebSocket from "ws";

// ── polyfill browser globals the SDK expects ────────────
const g = globalThis as unknown as Record<string, unknown>;
g.RTCPeerConnection = RTCPeerConnection as unknown;
g.MediaStream = WeriftMediaStream as unknown;
g.WebSocket = WebSocket as unknown;
if (!g.crypto) g.crypto = (await import("node:crypto")).webcrypto;

// import AFTER polyfills so the SDK binds to them
const { PaywalledRTCConsumer } = await import(
  "@nickthelegend69/webrtc-payment-sdk-core"
);
const { CasperX402Rail, makeEd25519SignFn } = await import(
  "@nickthelegend69/webrtc-payment-rail-x402"
);

const room = process.argv[2] ?? process.env.ROOM;
const wsUrl = process.argv[3] ?? process.env.SIGNALING_URL ?? "ws://localhost:3001";
const wallet = process.env.AGENT_ACCOUNT_HASH ?? "account-hash-aiagent000";

if (!room) {
  console.error("usage: start -- <room> [wsUrl]");
  process.exit(1);
}

// Real ed25519 signer from the agent's key (set AGENT_PRIVATE_KEY/PUBLIC_KEY).
const seed = process.env.AGENT_PRIVATE_KEY;
const pubkey = process.env.AGENT_PUBLIC_KEY;
if (!seed || !pubkey) {
  console.error("set AGENT_PRIVATE_KEY (ed25519 seed hex) and AGENT_PUBLIC_KEY (01…)");
  process.exit(1);
}
const signFn = makeEd25519SignFn(seed);

const rail = new CasperX402Rail({
  facilitatorUrl:
    process.env.X402_FACILITATOR_URL ?? "https://x402-facilitator.cspr.cloud",
  facilitatorApiKey: process.env.CSPR_CLOUD_API_KEY,
  network: "casper:casper-test",
  tokenContractHash: process.env.CEP18_TOKEN_CONTRACT ?? "",
  token: {
    name: process.env.CEP18_TOKEN_NAME ?? "Cep18x402",
    version: process.env.CEP18_TOKEN_VERSION ?? "1",
    decimals: process.env.CEP18_TOKEN_DECIMALS ?? "2",
    symbol: process.env.CEP18_TOKEN_SYMBOL ?? "CSPR",
  },
  consumerAccountHash: wallet,
  consumerPublicKeyHex: pubkey,
});

const consumer = new PaywalledRTCConsumer({
  paymentRail: rail,
  signalingServerUrl: wsUrl,
  walletAddress: wallet,
  signFn,
});

let segments = 0;
consumer.enableAutoPayment({
  maxTotalSpend: process.env.MAX_SPEND ?? "1000000000", // 1 CSPR
  onPayment: (amount, segmentIndex) => {
    segments++;
    console.log(`💳 paid segment ${segmentIndex}: ${amount} motes`);
  },
  onMaxReached: () => {
    console.log("🛑 budget cap reached — disconnecting");
    consumer.disconnect();
    process.exit(0);
  },
});

consumer.on("payment:confirmed", (i, txHash) =>
  console.log(`✓ segment ${i} settled — tx ${txHash ?? "(deferred)"}`),
);
consumer.on("stream:started", () => {
  console.log("📺 stream started — agent is now consuming media");
  // Here a real agent would run inference on each frame.
});
consumer.on("error", (e) => console.error("error:", e.message));

console.log(`🤖 agent joining room ${room} via ${wsUrl}`);
await consumer.joinStream(`${wsUrl}?room=${room}`);

// keep alive
setInterval(() => {
  console.log(`… ${segments} segments paid so far`);
}, 15_000);
