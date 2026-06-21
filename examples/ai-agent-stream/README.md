# ai-agent-stream

An AI agent as a **paying viewer**. A headless Node process subscribes to a
paywalled stream and settles x402 micropayments per segment, with a hard
budget cap — no human, no platform.

```bash
# 1. start signaling + provider (from repo root)
npm run dev:signaling
npm run dev:provider          # start a stream, copy the room id

# 2. run the agent against that room
npm -w @casper-webrtc/example-ai-agent-stream start -- <room> ws://localhost:3001
```

The agent prints every micropayment and its settlement tx hash. Replace the
`stream:started` handler with real per-frame inference to make the agent
*do* something with the media it's paying for.

> Node has no native WebRTC, so this example polyfills `RTCPeerConnection`
> (via [`werift`](https://github.com/shinyoshiaki/werift-webrtc)) and
> `WebSocket` (via `ws`) before importing the SDK.
