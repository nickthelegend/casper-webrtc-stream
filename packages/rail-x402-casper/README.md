# @nickthelegend69/webrtc-payment-rail-x402

Casper Network **x402 payment rail** for
[`@nickthelegend69/webrtc-payment-sdk-core`](https://www.npmjs.com/package/@nickthelegend69/webrtc-payment-sdk-core).
Wraps the CSPR.cloud x402 facilitator (`/verify`, `/settle`) with CEP-18 +
EIP-712 payloads.

```ts
import { CasperX402Rail } from "@nickthelegend69/webrtc-payment-rail-x402";

const rail = new CasperX402Rail({
  facilitatorUrl: "https://x402-facilitator.cspr.cloud",
  network: "casper:casper-test",
  tokenContractHash: "hash-...",
  providerAccountHash: "account-hash-...",
});
```

MIT.
