# basic-stream

The smallest possible integration of `casper-webrtc-stream`: a provider that
paywalls its camera, and a consumer that auto-pays per segment to watch.

```ts
import { runProvider, runConsumer } from "./index";

// Tab A (broadcaster)
await runProvider();

// Tab B (viewer) — room id comes from the link the provider printed
await runConsumer(roomId, walletAddress, signFn);
```

Both sides talk to the signaling server on `ws://localhost:3001`. Start it
with `npm run dev:signaling` from the repo root. See `docs/INTEGRATION.md`
for the full walkthrough.
