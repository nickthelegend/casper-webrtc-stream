# @nickthelegend69/webrtc-payment-sdk-core

Rail-agnostic core for **paywalled WebRTC streams**. Provides
`PaywalledRTCProvider` / `PaywalledRTCConsumer`, the `PaymentRail` interface,
per-segment gating, the DataChannel payment protocol, AES-GCM frame crypto,
and replay-safe session/nonce management.

Pair it with a rail such as
[`@nickthelegend69/webrtc-payment-rail-x402`](https://www.npmjs.com/package/@nickthelegend69/webrtc-payment-rail-x402)
for Casper. See the repo `docs/INTEGRATION.md`.

```ts
import { PaywalledRTCProvider } from "@nickthelegend69/webrtc-payment-sdk-core";
```

MIT.
