/**
 * Tiny WebSocket signaling client. Relays SDP offers/answers and ICE
 * candidates through the standalone signaling server. Transport-only — it
 * knows nothing about payments.
 */
import type { SignalingMessage, SignalingMessageType } from "./types.js";

type Handler = (msg: SignalingMessage) => void;

export class SignalingClient {
  private ws?: WebSocket;
  private handlers = new Set<Handler>();
  private queue: SignalingMessage[] = [];
  readonly peerId: string;

  constructor(
    private url: string,
    private room: string,
    private role: "provider" | "consumer",
    peerId?: string,
  ) {
    this.peerId = peerId ?? crypto.randomUUID();
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let opened = false;
      const ws = new WebSocket(this.url);
      this.ws = ws;

      ws.onopen = () => {
        opened = true;
        this.raw({ type: "join", room: this.room, from: this.peerId, payload: { role: this.role } });
        for (const m of this.queue) this.raw(m);
        this.queue = [];
        resolve();
      };
      ws.onerror = (e) => {
        const detail = (e as { message?: string }).message;
        const err = new Error(
          `signaling WebSocket error at ${this.url}` +
            (detail ? `: ${detail}` : " (is the signaling server running?)"),
        );
        console.error("[SignalingClient]", err.message, e);
        if (!opened) reject(err);
      };
      ws.onclose = (ev) => {
        if (!opened) {
          reject(
            new Error(
              `signaling WebSocket closed before connecting (code ${ev.code}) — check the server at ${this.url}`,
            ),
          );
        }
      };
      ws.onmessage = (ev) => {
        let msg: SignalingMessage | null = null;
        try {
          msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
        } catch {
          return;
        }
        if (!msg) return;
        // heartbeat: reply to server pings, never surface them
        if (msg.type === "ping") {
          this.raw({ type: "pong", room: this.room, from: this.peerId });
          return;
        }
        // ignore our own echoes
        if (msg.from && msg.from === this.peerId) return;
        for (const h of this.handlers) h(msg);
      };
    });
  }

  onMessage(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  send(type: SignalingMessageType, payload: unknown, to?: string): void {
    this.raw({ type, room: this.room, from: this.peerId, to, payload });
  }

  private raw(msg: SignalingMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.queue.push(msg);
    }
  }

  close(): void {
    this.send("leave", {});
    this.ws?.close();
    this.handlers.clear();
  }
}
