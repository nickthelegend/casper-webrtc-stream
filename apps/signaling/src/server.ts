/**
 * casper-webrtc-stream — signaling server.
 *
 *   1. WebSocket relay of SDP offers/answers + ICE candidates, scoped by room.
 *   2. HTTP: /health, /stream-info (Mode-1 402), /join (Mode-1 ack), /rooms/:id.
 *   3. App-level ping/pong heartbeat every 30s.
 *
 * Payment-agnostic by design: real Mode-1 verify/settle is enforced in the
 * provider app's API routes, which hold the rail + keys.
 */
import http from "node:http";
import express from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";

const PORT = Number(process.env.PORT ?? 3001);
const DEMO = process.env.DEMO_MODE === "true";

interface SignalingMessage {
  type: string;
  room?: string;
  roomId?: string;
  from?: string;
  to?: string;
  payload?: unknown;
}

interface Peer {
  id: string;
  role: string;
  ws: WebSocket;
  alive: boolean;
}

/** room id -> peers */
const rooms = new Map<string, Map<string, Peer>>();

function roomPeers(room: string): Map<string, Peer> {
  let m = rooms.get(room);
  if (!m) {
    m = new Map();
    rooms.set(room, m);
  }
  return m;
}

function send(ws: WebSocket, msg: SignalingMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function paymentRequirements(roomId: string, amount: string) {
  return {
    scheme: "exact",
    network: process.env.CASPER_NETWORK ?? "casper:casper-test",
    maxAmountRequired: amount,
    amount,
    resource: `ws://localhost:${PORT}?room=${roomId}`,
    description: "Live stream segment access",
    payTo: process.env.PROVIDER_ACCOUNT_HASH ?? "account-hash-demo-provider",
    sessionId: roomId,
    requiredDeadlineSeconds: 30,
    nonce: cryptoRandom(),
    extra: { tokenAddress: process.env.CEP18_TOKEN_CONTRACT ?? "hash-demo" },
  };
}

function cryptoRandom(): string {
  // available in Node 20+ as global
  return (globalThis.crypto?.randomUUID?.() ?? String(Math.random())).replace(/-/g, "");
}

// ── HTTP ───────────────────────────────────────────────
const app = express();
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3002", /localhost:\d+$/],
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    demo: DEMO,
    rooms: rooms.size,
    peers: [...rooms.values()].reduce((n, m) => n + m.size, 0),
    uptime: process.uptime(),
  });
});

app.get("/rooms/:room", (req, res) => {
  const m = rooms.get(req.params.room);
  res.json({
    room: req.params.room,
    peers: m ? [...m.values()].map((p) => ({ id: p.id, role: p.role })) : [],
  });
});

/** Mode-1: returns HTTP 402 + PaymentRequirements. Accepts roomId or room. */
app.get("/stream-info", (req, res) => {
  const roomId = String(req.query.roomId ?? req.query.room ?? "demo");
  const amount = String(req.query.amount ?? "10000");
  res.status(402).json({
    error: "payment_required",
    x402Version: 1,
    accepts: [paymentRequirements(roomId, amount)],
  });
});

/** Mode-1: acknowledge a (pre-verified) join. In production the provider app's
 *  /api/join verifies + settles; here we ack so the demo flow is self-contained. */
app.post("/join", (req, res) => {
  const { roomId, room, paymentPayload } = req.body ?? {};
  const id = roomId ?? room;
  if (!id || !paymentPayload) {
    return res.status(400).json({ accepted: false, reason: "missing roomId or paymentPayload" });
  }
  return res.status(200).json({ accepted: true, roomId: id });
});

const server = http.createServer(app);

// ── WebSocket relay ─────────────────────────────────────
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  let peerId = "";
  let room = "";

  ws.on("message", (data) => {
    let msg: SignalingMessage;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (msg.type === "pong") {
      const peers = rooms.get(room);
      const self = peers?.get(peerId);
      if (self) self.alive = true;
      return;
    }
    const r = msg.room ?? msg.roomId;
    if (!r) return;

    if (msg.type === "join") {
      room = r;
      peerId = msg.from ?? cryptoRandom();
      const role = (msg.payload as { role?: string })?.role ?? "peer";
      const peers = roomPeers(room);
      peers.set(peerId, { id: peerId, role, ws, alive: true });

      send(ws, {
        type: "joined",
        room,
        payload: {
          self: peerId,
          peers: [...peers.values()]
            .filter((p) => p.id !== peerId)
            .map((p) => ({ id: p.id, role: p.role })),
        },
      });
      for (const p of peers.values()) {
        if (p.id !== peerId) send(p.ws, { type: "join", room, from: peerId, payload: { role } });
      }
      return;
    }

    // relay everything else
    const peers = rooms.get(r);
    if (!peers) return;
    if (msg.to) {
      const target = peers.get(msg.to);
      if (target) send(target.ws, msg);
    } else {
      for (const p of peers.values()) {
        if (p.id !== msg.from) send(p.ws, msg);
      }
    }
  });

  ws.on("close", () => {
    if (!room || !peerId) return;
    const peers = rooms.get(room);
    if (!peers) return;
    peers.delete(peerId);
    for (const p of peers.values()) send(p.ws, { type: "leave", room, from: peerId });
    if (peers.size === 0) rooms.delete(room);
  });
});

// ── heartbeat: ping every 30s, drop peers that miss a pong ──
setInterval(() => {
  for (const [room, peers] of rooms) {
    for (const p of peers.values()) {
      if (!p.alive) {
        try {
          p.ws.terminate();
        } catch {
          /* ignore */
        }
        peers.delete(p.id);
        continue;
      }
      p.alive = false;
      send(p.ws, { type: "ping", room });
    }
    if (peers.size === 0) rooms.delete(room);
  }
}, 30_000);

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[signaling] ws + http on :${PORT} (demo=${DEMO})`);
});
