/**
 * PaywalledRTCProvider — the broadcaster.
 *
 * Wraps RTCPeerConnection(s) (one per consumer), captures the provider's
 * MediaStream, and gates delivery behind on-chain payment via the injected
 * PaymentRail.
 *
 *   Mode 1 (signaling): consumer pays once before SDP exchange. Verified in
 *                       admitConsumer() before the offer is sent.
 *   Mode 2 (track):     consumer pays every N seconds over the DataChannel;
 *                       track.enabled is toggled per-consumer.
 */
import {
  DEFAULT_ICE_SERVERS,
  type PaymentPayload,
  type PaymentRequirements,
  type ProviderConfig,
} from "./types.js";
import { TypedEmitter } from "./emitter.js";
import { SessionManager } from "./SessionManager.js";
import { PaymentGate } from "./PaymentGate.js";
import { SignalingClient } from "./SignalingClient.js";
import { DC_LABEL, dc, decodeDC, encodeDC } from "./DataChannelProtocol.js";
import {
  exportKeyB64,
  generateSegmentKey,
  installSenderEncryption,
} from "./crypto.js";

interface ProviderEvents extends Record<string, (...args: any[]) => void> {
  "consumer:joined": (consumerId: string) => void;
  "consumer:paid": (consumerId: string, amount: string, segmentIndex: number) => void;
  "consumer:defaulted": (consumerId: string) => void;
  "consumer:left": (consumerId: string) => void;
  "earnings:update": (totalMotes: string) => void;
  error: (err: Error) => void;
}

interface PeerCtx {
  pc: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  /** cloned senders so track.enabled is per-consumer */
  senders: RTCRtpSender[];
  segmentTimer?: ReturnType<typeof setInterval>;
  segmentIndex: number;
  awaitingProof: boolean;
  /** Mode 3: the current per-segment AES-GCM key (frames are encrypted with it;
   *  its base64 is only released to the consumer after payment confirms). */
  cryptoKey: CryptoKey | null;
  cryptoKeyB64: string;
}

export class PaywalledRTCProvider extends TypedEmitter<ProviderEvents> {
  private cfg: ProviderConfig;
  private sessions = new SessionManager();
  private gate: PaymentGate;
  private signaling?: SignalingClient;
  private mediaStream?: MediaStream;
  private peers = new Map<string, PeerCtx>();
  /** sessionId per consumer */
  private sessionOf = new Map<string, string>();
  readonly room: string;

  constructor(config: ProviderConfig) {
    super();
    this.cfg = config;
    this.room = config.room ?? crypto.randomUUID();
    // One-off (signaling) mode settles on verify — a single on-chain tx unlocks
    // the stream. Per-segment (track/crypto) modes gate on /verify only (instant,
    // smooth playback); each /settle is a real ~30–60s on-chain deploy, so they
    // must NOT block every 5s segment — settle those in batches out of band.
    this.gate = new PaymentGate(
      config.paymentRail,
      this.sessions,
      config.gating.mode === "signaling",
    );
  }

  /** Begin broadcasting. Connects to signaling and waits for consumers. */
  async startStream(mediaStream: MediaStream): Promise<void> {
    this.mediaStream = mediaStream;
    this.signaling = new SignalingClient(
      this.cfg.signalingServerUrl,
      this.room,
      "provider",
    );
    await this.signaling.connect();

    this.signaling.onMessage((msg) => {
      const from = msg.from;
      if (!from) return;
      switch (msg.type) {
        case "join":
          // In Mode 2/3 a consumer can join directly; in Mode 1 the HTTP
          // /join route calls admitConsumer() instead.
          if (this.cfg.gating.mode !== "signaling") {
            void this.createPeerFor(from).catch((e) => this.emit("error", e as Error));
          }
          break;
        case "answer":
          void this.peers.get(from)?.pc.setRemoteDescription(
            msg.payload as RTCSessionDescriptionInit,
          );
          break;
        case "ice-candidate":
          void this.peers.get(from)?.pc.addIceCandidate(
            msg.payload as RTCIceCandidateInit,
          );
          break;
        case "leave":
          this.dropConsumer(from);
          break;
      }
    });
  }

  /** PaymentRequirements for a consumer's whole-stream (Mode 1) gate. */
  getPaymentRequirements(sessionId: string): PaymentRequirements {
    const amount =
      this.cfg.gating.pricePerSession ?? this.cfg.gating.pricePerSegment ?? "0";
    return this.cfg.paymentRail.buildRequirements({ amount, sessionId });
  }

  /**
   * Mode 1: verify a consumer's whole-stream payment, then build + return an
   * SDP offer. Wire this to your HTTP /join route.
   */
  async admitConsumer(
    consumerId: string,
    paymentPayload: PaymentPayload,
  ): Promise<{ accepted: boolean; sdpOffer?: RTCSessionDescriptionInit; reason?: string }> {
    const verified = await this.cfg.paymentRail.verify(paymentPayload);
    if (!verified.valid) {
      return { accepted: false, reason: verified.error ?? "payment invalid" };
    }
    // settle the one-off session payment
    try {
      await this.cfg.paymentRail.settle(paymentPayload);
    } catch (err) {
      this.emit("error", err as Error);
    }
    const v = this.gate.ensureViewer(consumerId, paymentPayload.payload.authorization.from);
    v.enabled = true;
    v.totalPaid = paymentPayload.payload.authorization.value;
    v.segmentsPaid = 1;
    this.emit("earnings:update", this.gate.totalEarnings());

    const ctx = await this.createPeerFor(consumerId);
    const offer = await ctx.pc.createOffer();
    await ctx.pc.setLocalDescription(offer);
    return { accepted: true, sdpOffer: offer };
  }

  /** Mode 2: directly toggle a consumer's track. */
  setTrackEnabled(consumerId: string, enabled: boolean): void {
    const ctx = this.peers.get(consumerId);
    if (!ctx) return;
    for (const s of ctx.senders) {
      if (s.track) s.track.enabled = enabled;
    }
    const v = this.gate.getViewer(consumerId);
    if (v) v.enabled = enabled;
  }

  /** Mode 3: generate a fresh per-segment AES-GCM key for this peer. */
  private async rotateCryptoKey(ctx: PeerCtx): Promise<void> {
    ctx.cryptoKey = await generateSegmentKey();
    ctx.cryptoKeyB64 = await exportKeyB64(ctx.cryptoKey);
  }

  listViewers() {
    return this.gate.listViewers();
  }

  totalEarnings(): string {
    return this.gate.totalEarnings();
  }

  // ── internals ──────────────────────────────────────────

  private async createPeerFor(consumerId: string): Promise<PeerCtx> {
    if (this.peers.has(consumerId)) return this.peers.get(consumerId)!;
    if (!this.mediaStream) throw new Error("startStream() not called yet");

    const isCrypto = this.cfg.gating.mode === "crypto";
    const pcConfig: RTCConfiguration = {
      iceServers: this.cfg.iceServers ?? DEFAULT_ICE_SERVERS,
    };
    // Mode 3 needs Encoded Transforms enabled on the connection (Chrome).
    if (isCrypto) (pcConfig as Record<string, unknown>).encodedInsertableStreams = true;
    const pc = new RTCPeerConnection(pcConfig);
    const sessionId = this.sessions.generateSessionId();
    this.sessionOf.set(consumerId, sessionId);

    // clone tracks so enabled-state is per-consumer
    const senders: RTCRtpSender[] = [];
    for (const track of this.mediaStream.getTracks()) {
      const clone = track.clone();
      // Track mode starts disabled until first payment lands. Signaling and
      // crypto flow immediately — crypto frames are encrypted, so they're
      // useless to a consumer that hasn't been given the key.
      clone.enabled = this.cfg.gating.mode !== "track";
      senders.push(pc.addTrack(clone, this.mediaStream));
    }

    const ctx: PeerCtx = {
      pc,
      senders,
      segmentIndex: 0,
      awaitingProof: false,
      cryptoKey: null,
      cryptoKeyB64: "",
    };
    this.peers.set(consumerId, ctx);

    // Mode 3: encrypt every outgoing frame from the start, so the consumer only
    // ever receives ciphertext until a key is released to it on payment.
    if (isCrypto) {
      await this.rotateCryptoKey(ctx);
      for (const sender of senders) {
        installSenderEncryption(sender, () => ctx.cryptoKey);
      }
    }
    this.gate.ensureViewer(consumerId);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.signaling?.send("ice-candidate", e.candidate.toJSON(), consumerId);
      }
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        this.dropConsumer(consumerId);
      }
    };

    // Payment DataChannel (Mode 2/3)
    if (this.cfg.gating.mode !== "signaling") {
      const channel = pc.createDataChannel(DC_LABEL, { ordered: true });
      ctx.dataChannel = channel;
      channel.onopen = () => this.startSegmentLoop(consumerId);
      channel.onmessage = (ev) =>
        void this.onDCMessage(consumerId, String(ev.data)).catch((e) =>
          this.emit("error", e as Error),
        );
    }

    this.emit("consumer:joined", consumerId);

    // For Mode 2/3 we initiate the offer right away (no pre-pay gate).
    if (this.cfg.gating.mode !== "signaling") {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.signaling?.send("offer", offer, consumerId);
    }
    return ctx;
  }

  private startSegmentLoop(consumerId: string): void {
    const ctx = this.peers.get(consumerId);
    if (!ctx) return;
    const dur = (this.cfg.gating.segmentDurationSeconds ?? 5) * 1000;

    const requestSegment = async () => {
      const sessionId = this.sessionOf.get(consumerId)!;
      const idx = ctx.segmentIndex;
      // Mode 3: rotate to a fresh key for this segment. Outgoing frames are now
      // encrypted with it; the consumer can only decode them once it pays and
      // receives this key (released in onDCMessage on a valid proof).
      if (this.cfg.gating.mode === "crypto") await this.rotateCryptoKey(ctx);
      const nonce = this.sessions.generateSegmentNonce(sessionId, idx);
      const reqs = this.cfg.paymentRail.buildRequirements({
        amount: this.cfg.gating.pricePerSegment ?? "0",
        sessionId,
        segmentIndex: idx,
      });
      reqs.nonce = nonce; // deterministic, replay-checked nonce
      ctx.awaitingProof = true;
      ctx.dataChannel?.send(encodeDC(dc.paymentRequest(idx, reqs)));

      // grace window: if no valid proof by next tick, suspend
      setTimeout(() => {
        if (ctx.awaitingProof) {
          // Track mode: cut the track. Crypto mode: nothing to cut — the key for
          // this segment was simply never released, so the frames stay opaque.
          if (this.cfg.gating.mode === "track") {
            this.setTrackEnabled(consumerId, false);
          }
          ctx.dataChannel?.send(encodeDC(dc.suspended("payment_missed")));
          this.emit("consumer:defaulted", consumerId);
        }
      }, dur - 500);
    };

    void requestSegment();
    ctx.segmentTimer = setInterval(() => {
      ctx.segmentIndex += 1;
      void requestSegment();
    }, dur);
  }

  private async onDCMessage(consumerId: string, raw: string): Promise<void> {
    const ctx = this.peers.get(consumerId);
    if (!ctx) return;
    const msg = decodeDC(raw);
    if (!msg) return;

    if (msg.type === "segment_payment_proof") {
      const decision = await this.gate.processPayment(
        consumerId,
        msg.segmentIndex,
        msg.payload,
      );
      ctx.awaitingProof = false;
      if (decision.ok) {
        if (this.cfg.gating.mode === "crypto") {
          // Release this segment's decryption key — the actual unlock in Mode 3.
          ctx.dataChannel?.send(encodeDC(dc.key(msg.segmentIndex, ctx.cryptoKeyB64)));
        } else {
          this.setTrackEnabled(consumerId, true);
        }
        ctx.dataChannel?.send(encodeDC(dc.confirmed(msg.segmentIndex, decision.txHash)));
        const v = this.gate.getViewer(consumerId);
        this.emit(
          "consumer:paid",
          consumerId,
          this.cfg.gating.pricePerSegment ?? "0",
          msg.segmentIndex,
        );
        this.emit("earnings:update", this.gate.totalEarnings());
        if (v && v.lastSegmentIndex === 0) {
          ctx.dataChannel?.send(encodeDC(dc.resumed()));
        }
      } else {
        // Crypto mode withholds the key (no track toggle); track mode cuts it.
        if (this.cfg.gating.mode === "track") {
          this.setTrackEnabled(consumerId, false);
        }
        ctx.dataChannel?.send(
          encodeDC(dc.rejected(msg.segmentIndex, decision.reason ?? "rejected")),
        );
        this.emit("consumer:defaulted", consumerId);
      }
    }
  }

  private dropConsumer(consumerId: string): void {
    const ctx = this.peers.get(consumerId);
    if (!ctx) return;
    if (ctx.segmentTimer) clearInterval(ctx.segmentTimer);
    try {
      ctx.dataChannel?.close();
      ctx.pc.close();
    } catch {
      /* ignore */
    }
    this.peers.delete(consumerId);
    this.gate.removeViewer(consumerId);
    this.emit("consumer:left", consumerId);
    this.emit("earnings:update", this.gate.totalEarnings());
  }

  /** Stop everything. */
  stop(): void {
    for (const id of [...this.peers.keys()]) this.dropConsumer(id);
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.signaling?.close();
  }
}
