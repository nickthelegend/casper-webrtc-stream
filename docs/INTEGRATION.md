# Integrating casper-webrtc-stream

This guide shows how to add Casper-paywalled WebRTC streaming to your own app.

## Install

```bash
npm install @nickthelegend69/webrtc-payment-sdk-core @nickthelegend69/webrtc-payment-rail-x402
```

You also need a running signaling server (see `apps/signaling`) reachable by
both peers.

## 1. Build a payment rail

The rail is the only Casper-specific piece. Everything else is rail-agnostic.

```ts
import { CasperX402Rail } from "@nickthelegend69/webrtc-payment-rail-x402";

const rail = new CasperX402Rail({
  facilitatorUrl: "https://x402-facilitator.cspr.cloud",
  facilitatorApiKey: process.env.CSPR_CLOUD_API_KEY, // provider/server side only
  network: "casper:casper-test",
  tokenContractHash: process.env.CEP18_TOKEN_CONTRACT!,
  providerAccountHash: process.env.PROVIDER_ACCOUNT_HASH!, // provider side
  // consumerAccountHash: walletAddress,                    // consumer side
});
```

## 2. Provider — paywall a stream

```ts
import { PaywalledRTCProvider } from "@nickthelegend69/webrtc-payment-sdk-core";

const provider = new PaywalledRTCProvider({
  paymentRail: rail,
  gating: { mode: "track", segmentDurationSeconds: 5, pricePerSegment: "50000" },
  signalingServerUrl: "ws://localhost:3001",
});

provider.on("consumer:paid", (id, amount, segment) =>
  console.log(`viewer ${id} paid ${amount} for segment ${segment}`),
);
provider.on("earnings:update", (motes) => updateUI(motes));

const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
await provider.startStream(media);

// share this with viewers:
const link = `https://your-app/watch?room=${provider.room}`;
```

## 3. Consumer — pay to watch

```ts
import { PaywalledRTCConsumer } from "@nickthelegend69/webrtc-payment-sdk-core";

const consumer = new PaywalledRTCConsumer({
  paymentRail: rail,
  signalingServerUrl: "ws://localhost:3001",
  walletAddress,            // consumer account hash
  signFn,                   // async (digestHex) => signatureHex  (CSPR.click)
});

consumer.enableAutoPayment({
  maxTotalSpend: "1000000000",     // 1 CSPR hard cap
  onPayment: (amount, i) => console.log(`paid segment ${i}`),
  onMaxReached: () => console.log("cap hit — stream will pause"),
});

const { stream } = await consumer.joinStream(`ws://localhost:3001?room=${room}`);
videoEl.srcObject = stream;
```

## Gating modes

| Mode        | Enforcement                                   | When to use                         |
|-------------|-----------------------------------------------|-------------------------------------|
| `signaling` | Pay once before SDP. Verified server-side.    | One-off access, ticketed streams.   |
| `track`     | Pay every N seconds; `track.enabled` toggled. | Pay-per-second, low overhead.       |
| `crypto`    | RTP frames AES-GCM encrypted; key sent on pay.| Trust-free per-segment enforcement. |

`signaling` is wired through the provider app's `/api/stream-info` (402) and
`/api/join` (verify + settle) routes. `track` and `crypto` run entirely over
the WebRTC DataChannel using the `DCMessage` protocol.

## The signer (`signFn`)

`signFn(digestHex) => Promise<signatureHex>` lets you plug in any signer:

- **Browser / production:** CSPR.click — sign the EIP-712 typed data and
  return the signature.
- **Demo / agents:** a real ed25519 signer over the EIP-712 digest via
  `makeEd25519SignFn(seedHex)` (WebCrypto). Hot key — demo only.
- **Agents / servers:** a raw Casper key (never ship keys to the browser).

The typed-data structure the facilitator expects is built in
`PayloadBuilder.ts` (`buildTypedData`). If CSPR.cloud changes the schema,
that's the one file to update.

## Replay protection

Per-segment nonces are `SHA-256(sessionId:segmentIndex)` — derivable by both
peers and rejected after first use by the provider's `SessionManager`. A
replayed or mismatched nonce fails the gate before the rail is ever called.
