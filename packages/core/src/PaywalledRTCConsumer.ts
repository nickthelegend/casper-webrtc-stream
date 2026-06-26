/**
 * PaywalledRTCConsumer — the viewer.
 *
 * Connects to a provider's stream, pays via the injected PaymentRail, and
 * exposes the remote MediaStream once delivery starts. In Mode 2 it auto-pays
 * each segment over the DataChannel up to a hard spend cap.
 */
import {
  DEFAULT_ICE_SERVERS,
  type AutoPaymentConfig,
  type ConsumerConfig,
  type PaymentRequirements,
} from "./types.js";
import { TypedEmitter } from "./emitter.js";
import { SignalingClient } from "./SignalingClient.js";
import { dc, decodeDC, encodeDC } from "./DataChannelProtocol.js";
import { importKeyB64, installReceiverDecryption } from "./crypto.js";

interface ConsumerEvents extends Record<string, (...args: any[]) => void> {
  "stream:started": (stream: MediaStream) => void;
  "stream:paused": () => void;
  "stream:resumed": () => void;
  "payment:sent": (amount: string, segmentIndex: number) => void;
  "payment:confirmed": (segmentIndex: number, txHash?: string) => void;
  error: (err: Error) => void;
}

export class PaywalledRTCConsumer extends TypedEmitter<ConsumerEvents> {
  private cfg: ConsumerConfig;
  private pc?: RTCPeerConnection;
  private signaling?: SignalingClient;
  private dataChannel?: RTCDataChannel;
  private remote = new MediaStream();
  private providerId?: string;
  private sessionId = "";

  private auto?: AutoPaymentConfig;
  private totalSpent = 0n;
  private capped = false;
  /** Mode 3: current per-segment decryption key (null until a paid segment). */
  private cryptoKey: CryptoKey | null = null;

  constructor(config: ConsumerConfig) {
    super();
    this.cfg = config;
  }

  /**
   * Connect to a provider stream. `providerUrl` is the signaling URL with a
   * room query param, e.g. "ws://localhost:3001?room=abc123".
   */
  async joinStream(
    providerUrl: string,
  ): Promise<{ stream: MediaStream; sessionId: string }> {
    const room = new URL(providerUrl.replace(/^ws/, "http")).searchParams.get("room");
    if (!room) throw new Error("providerUrl missing ?room=");
    const wsUrl = providerUrl.split("?")[0];

    const pcConfig: RTCConfiguration = {
      iceServers: this.cfg.iceServers ?? DEFAULT_ICE_SERVERS,
    };
    // Mode 3 needs Encoded Transforms enabled to decrypt incoming frames.
    if (this.cfg.cryptoMode) {
      (pcConfig as Record<string, unknown>).encodedInsertableStreams = true;
    }
    this.pc = new RTCPeerConnection(pcConfig);
    this.signaling = new SignalingClient(wsUrl, room, "consumer");

    this.pc.ontrack = (e) => {
      // Mode 3: decrypt each frame with the latest paid-for key (frames stay
      // opaque until the first key arrives over the DataChannel).
      if (this.cfg.cryptoMode) {
        installReceiverDecryption(e.receiver, () => this.cryptoKey);
      }
      this.remote.addTrack(e.track);
      if (this.remote.getTracks().length === 1) {
        this.emit("stream:started", this.remote);
      }
    };
    this.pc.onicecandidate = (e) => {
      if (e.candidate && this.providerId) {
        console.log("[consumer] → ICE candidate:", e.candidate.type, e.candidate.protocol);
        this.signaling?.send("ice-candidate", e.candidate.toJSON(), this.providerId);
      }
    };
    this.pc.onconnectionstatechange = () =>
      console.log("[consumer] connection state:", this.pc?.connectionState);
    this.pc.oniceconnectionstatechange = () =>
      console.log("[consumer] ICE state:", this.pc?.iceConnectionState);
    this.pc.ondatachannel = (e) => {
      console.log("[consumer] ◀ ondatachannel — payment channel received");
      this.attachDataChannel(e.channel);
    };

    await this.signaling.connect();

    return new Promise((resolve, reject) => {
      const dispose = this.signaling!.onMessage(async (msg) => {
        try {
          if (msg.type === "offer") {
            this.providerId = msg.from;
            await this.pc!.setRemoteDescription(
              msg.payload as RTCSessionDescriptionInit,
            );
            const answer = await this.pc!.createAnswer();
            await this.pc!.setLocalDescription(answer);
            this.signaling!.send("answer", answer, this.providerId);
            this.sessionId = crypto.randomUUID();
            resolve({ stream: this.remote, sessionId: this.sessionId });
          } else if (msg.type === "ice-candidate") {
            console.log("[consumer] ← ICE candidate from provider");
            await this.pc!.addIceCandidate(msg.payload as RTCIceCandidateInit);
          }
        } catch (err) {
          dispose();
          reject(err);
        }
      });

      // safety timeout
      setTimeout(() => reject(new Error("joinStream timed out waiting for offer")), 20_000);
    });
  }

  /** Enable per-segment auto-payment (Mode 2). */
  enableAutoPayment(config: AutoPaymentConfig): void {
    this.auto = config;
  }

  private attachDataChannel(channel: RTCDataChannel): void {
    this.dataChannel = channel;
    console.log("[consumer] payment DataChannel attached (state:", channel.readyState, ")");
    channel.onopen = () => console.log("[consumer] ✓ payment DataChannel OPEN");
    channel.onmessage = (ev) =>
      void this.onDCMessage(String(ev.data)).catch((e) => {
        console.error("[consumer] DC message handler threw:", e);
        this.emit("error", e as Error);
      });
  }

  private async onDCMessage(raw: string): Promise<void> {
    const msg = decodeDC(raw);
    if (!msg) return;
    console.log("[consumer] ◀ DC:", msg.type);

    switch (msg.type) {
      case "segment_payment_request":
        await this.handlePaymentRequest(msg.segmentIndex, msg.requirements);
        break;
      case "segment_confirmed":
        this.emit("payment:confirmed", msg.segmentIndex, msg.txHash);
        break;
      case "segment_key":
        // Mode 3: a paid segment's AES-GCM key — apply it so the decrypt
        // transform can turn the incoming ciphertext back into video.
        this.cryptoKey = await importKeyB64(msg.key);
        this.emit("stream:resumed");
        break;
      case "segment_rejected":
        this.emit("error", new Error(`segment ${msg.segmentIndex} rejected: payment not accepted`));
        break;
      case "stream_suspended":
        this.emit("stream:paused");
        break;
      case "stream_resumed":
        this.emit("stream:resumed");
        break;
    }
  }

  private async handlePaymentRequest(
    segmentIndex: number,
    requirements: PaymentRequirements,
  ): Promise<void> {
    console.log(
      `[consumer] 💸 payment request — segment ${segmentIndex}, amount ${requirements.amount}`,
      { auto: !!this.auto, capped: this.capped, spent: this.totalSpent.toString() },
    );
    if (!this.auto) {
      console.warn("[consumer] auto-payment is OFF — ignoring request");
      return; // manual mode: app drives payment itself
    }
    if (this.capped) return;

    const next = this.totalSpent + BigInt(requirements.amount);
    if (next > BigInt(this.auto.maxTotalSpend)) {
      console.warn("[consumer] spend cap reached — pausing");
      this.capped = true;
      this.auto.onMaxReached?.();
      this.emit("stream:paused");
      return;
    }

    let payload;
    try {
      payload = await this.cfg.paymentRail.buildPayload(requirements, this.cfg.signFn);
    } catch (e) {
      console.error(`[consumer] ✗ failed to sign payment for segment ${segmentIndex}:`, e);
      this.emit("error", e as Error);
      return;
    }
    this.dataChannel?.send(encodeDC(dc.paymentProof(segmentIndex, payload)));
    this.totalSpent = next;
    this.auto.onPayment?.(requirements.amount, segmentIndex);
    this.emit("payment:sent", requirements.amount, segmentIndex);
    console.log(`[consumer] ✓ signed + sent payment proof for segment ${segmentIndex}`);
  }

  totalSpentMotes(): string {
    return this.totalSpent.toString();
  }

  disconnect(): void {
    try {
      this.dataChannel?.close();
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.signaling?.close();
  }
}
