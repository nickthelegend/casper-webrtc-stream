# @nickthelegend69/webrtc-payment-sdk-core

> Rail-agnostic core for **pay-per-second WebRTC streams**. Stream live video peer-to-peer and charge the viewer per segment, with each payment settled on-chain by a pluggable payment rail.

[![npm](https://img.shields.io/npm/v/@nickthelegend69/webrtc-payment-sdk-core.svg)](https://www.npmjs.com/package/@nickthelegend69/webrtc-payment-sdk-core)

This is the transport- and payment-agnostic engine. It knows about WebRTC,
gating, segments, and an abstract `PaymentRail` interface — but nothing about
Casper, x402, or any specific chain. Pair it with a rail like
[`@nickthelegend69/webrtc-payment-rail-x402`](https://www.npmjs.com/package/@nickthelegend69/webrtc-payment-rail-x402)
to settle payments on Casper Network.

```bash
npm install @nickthelegend69/webrtc-payment-sdk-core
```

---

## What it does

A **provider** captures a `MediaStream` and broadcasts it over WebRTC. A
**consumer** connects and pays — every few seconds — to keep watching. The SDK:

- Manages one `RTCPeerConnection` per viewer + the signaling handshake.
- Opens a `casper-pay` **DataChannel** and runs a small payment protocol over it.
- Requests a payment each segment, **verifies** it (gate), then **settles** it
  on-chain via the rail — one real transaction per paid segment.
- Suspends a viewer's stream the moment they stop paying.

It supports three enforcement modes (see [Gating modes](#gating-modes)).

---

## Quick start

### Provider (the streamer)

```ts
import { PaywalledRTCProvider } from "@nickthelegend69/webrtc-payment-sdk-core";

const provider = new PaywalledRTCProvider({
  paymentRail: rail,                      // from a rail package
  gating: {
    mode: "track",                        // pay-per-segment
    segmentDurationSeconds: 15,
    pricePerSegment: "150000000",         // base units charged each segment
  },
  signalingServerUrl: "ws://localhost:3001",
});

provider.on("consumer:joined",  (id)               => console.log("viewer", id));
provider.on("consumer:paid",    (id, amt, seg)     => console.log("paid", seg, amt));
provider.on("consumer:settled", (id, seg, txHash)  => console.log("on-chain", txHash));
provider.on("earnings:update",  (motes)            => render(motes));

const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
await provider.startStream(media);

// Share this with viewers:
const link = `https://your.app/watch?room=${provider.room}`;
```

### Consumer (the viewer)

```ts
import { PaywalledRTCConsumer } from "@nickthelegend69/webrtc-payment-sdk-core";

const consumer = new PaywalledRTCConsumer({
  paymentRail: rail,
  signalingServerUrl: "ws://localhost:3001",
  walletAddress: "account-hash-…",        // payer
  signFn,                                 // async (digestHex) => signatureHex
});

consumer.enableAutoPayment({
  maxTotalSpend: "1000000000",            // hard cap — never exceeded
  onPayment:     (amt, i) => console.log("paid segment", i),
  onMaxReached:  ()       => console.log("cap hit — stream pauses"),
});

consumer.on("stream:started",   (s)            => (videoEl.srcObject = s));
consumer.on("payment:confirmed", (seg, txHash) => console.log("settled", txHash));

const { stream } = await consumer.joinStream(`ws://localhost:3001?room=${room}`);
```

---

## Gating modes

| Mode        | How it's enforced                                            | Cost on chain | Best for                          |
|-------------|-------------------------------------------------------------|---------------|-----------------------------------|
| `signaling` | Pay **once** before the SDP offer is sent.                  | 1 tx          | Ticketed / one-off access.        |
| `track`     | Pay **every N seconds**; the media track is toggled off if a payment is missed. | N txs | Pay-per-second streaming.         |
| `crypto`    | RTP frames are **AES-GCM encrypted**; the per-segment key is delivered only after payment. | N txs | Trust-free enforcement — bytes are useless without paying. |

Set the mode in `gating.mode`. `track` and `crypto` run entirely over the
WebRTC DataChannel; `signaling` is enforced before the connection forms.

---

## The signer (`signFn`)

The consumer never holds rail logic — it just signs a digest:

```ts
type SignFn = (typedDataDigestHex: string) => Promise<string>;
```

Plug in anything:

- **Browser / production** — a wallet (e.g. CSPR.click) signs the EIP-712 typed data.
- **Agents / servers** — a raw key signer (e.g. `makeEd25519SignFn` from the x402 rail).

The rail package builds the digest and assembles the on-the-wire payload; the
core SDK only routes `signFn` to the rail at payment time.

---

## API

### `PaywalledRTCProvider`

| Member | Signature | Notes |
|--------|-----------|-------|
| `new PaywalledRTCProvider(config)` | `ProviderConfig` | `paymentRail`, `gating`, `signalingServerUrl`, optional `iceServers`, `room`. |
| `startStream(media)` | `(MediaStream) => Promise<void>` | Begins broadcasting + paywalling. |
| `room` | `string` | Room id viewers join with `?room=`. |
| `listViewers()` | `() => ViewerState[]` | Current viewers + paid/enabled state. |
| `totalEarnings()` | `() => string` | Settled base units this session. |
| `stop()` | `() => void` | Tears down every peer + signaling. |

**Events:** `consumer:joined`, `consumer:paid`, `consumer:settled`,
`consumer:settle_failed`, `consumer:defaulted`, `consumer:left`,
`earnings:update`, `error`.

### `PaywalledRTCConsumer`

| Member | Signature | Notes |
|--------|-----------|-------|
| `new PaywalledRTCConsumer(config)` | `ConsumerConfig` | `paymentRail`, `signalingServerUrl`, `walletAddress`, `signFn`, optional `iceServers`, `cryptoMode`. |
| `joinStream(url)` | `(string) => Promise<{ stream, sessionId }>` | URL includes `?room=`. |
| `enableAutoPayment(cfg)` | `(AutoPaymentConfig) => void` | `maxTotalSpend`, `onPayment`, `onMaxReached`. |
| `totalSpentMotes()` | `() => string` | Running spend. |
| `disconnect()` | `() => void` | Closes the connection. |

**Events:** `stream:started`, `stream:paused`, `stream:resumed`,
`payment:sent`, `payment:confirmed`, `error`.

### Also exported

`PaymentGate`, `SessionManager`, `SignalingClient`, `TypedEmitter`, the
DataChannel protocol (`dc`, `encodeDC`, `decodeDC`, `DC_LABEL`), the AES-GCM
crypto helpers (`generateSegmentKey`, `installSenderEncryption`,
`installReceiverDecryption`, …), and every shared type
(`PaymentRail`, `PaymentRequirements`, `PaymentPayload`, `GatingConfig`,
`ViewerState`, `SignFn`, `DEFAULT_ICE_SERVERS`, …).

---

## Writing your own rail

Implement four methods and you can settle on any chain:

```ts
interface PaymentRail {
  buildRequirements(opts): PaymentRequirements;                    // provider: what to charge
  buildPayload(req, signFn): Promise<PaymentPayload>;              // consumer: sign it
  verify(payload): Promise<{ valid: boolean; error?: string }>;    // provider: gate
  settle(payload): Promise<{ txHash: string }>;                    // provider: on-chain
}
```

---

## Notes

- Pure ESM, TypeScript types included. Targets modern browsers (provider/consumer)
  and Node 18+ (rail/agent side).
- `crypto` mode needs WebRTC **Encoded Transforms** (Chromium-based browsers).
- For the full end-to-end guide, all events, replay protection, and a runnable
  reference app, see the repo
  [`docs/USAGE.md`](https://github.com/nickthelegend/casper-webrtc-stream/blob/main/docs/USAGE.md).

MIT
