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
import { DEFAULT_ICE_SERVERS, } from "./types.js";
import { TypedEmitter } from "./emitter.js";
import { SessionManager } from "./SessionManager.js";
import { PaymentGate } from "./PaymentGate.js";
import { SignalingClient } from "./SignalingClient.js";
import { DC_LABEL, dc, decodeDC, encodeDC } from "./DataChannelProtocol.js";
export class PaywalledRTCProvider extends TypedEmitter {
    cfg;
    sessions = new SessionManager();
    gate;
    signaling;
    mediaStream;
    peers = new Map();
    /** sessionId per consumer */
    sessionOf = new Map();
    room;
    constructor(config) {
        super();
        this.cfg = config;
        this.room = config.room ?? crypto.randomUUID();
        // Mode 1 settles immediately; Mode 2 verifies per segment and settles too.
        this.gate = new PaymentGate(config.paymentRail, this.sessions, true);
    }
    /** Begin broadcasting. Connects to signaling and waits for consumers. */
    async startStream(mediaStream) {
        this.mediaStream = mediaStream;
        this.signaling = new SignalingClient(this.cfg.signalingServerUrl, this.room, "provider");
        await this.signaling.connect();
        this.signaling.onMessage((msg) => {
            const from = msg.from;
            if (!from)
                return;
            switch (msg.type) {
                case "join":
                    // In Mode 2/3 a consumer can join directly; in Mode 1 the HTTP
                    // /join route calls admitConsumer() instead.
                    if (this.cfg.gating.mode !== "signaling") {
                        void this.createPeerFor(from).catch((e) => this.emit("error", e));
                    }
                    break;
                case "answer":
                    void this.peers.get(from)?.pc.setRemoteDescription(msg.payload);
                    break;
                case "ice-candidate":
                    void this.peers.get(from)?.pc.addIceCandidate(msg.payload);
                    break;
                case "leave":
                    this.dropConsumer(from);
                    break;
            }
        });
    }
    /** PaymentRequirements for a consumer's whole-stream (Mode 1) gate. */
    getPaymentRequirements(sessionId) {
        const amount = this.cfg.gating.pricePerSession ?? this.cfg.gating.pricePerSegment ?? "0";
        return this.cfg.paymentRail.buildRequirements({ amount, sessionId });
    }
    /**
     * Mode 1: verify a consumer's whole-stream payment, then build + return an
     * SDP offer. Wire this to your HTTP /join route.
     */
    async admitConsumer(consumerId, paymentPayload) {
        const verified = await this.cfg.paymentRail.verify(paymentPayload);
        if (!verified.valid) {
            return { accepted: false, reason: verified.error ?? "payment invalid" };
        }
        // settle the one-off session payment
        try {
            await this.cfg.paymentRail.settle(paymentPayload);
        }
        catch (err) {
            this.emit("error", err);
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
    setTrackEnabled(consumerId, enabled) {
        const ctx = this.peers.get(consumerId);
        if (!ctx)
            return;
        for (const s of ctx.senders) {
            if (s.track)
                s.track.enabled = enabled;
        }
        const v = this.gate.getViewer(consumerId);
        if (v)
            v.enabled = enabled;
    }
    listViewers() {
        return this.gate.listViewers();
    }
    totalEarnings() {
        return this.gate.totalEarnings();
    }
    // ── internals ──────────────────────────────────────────
    async createPeerFor(consumerId) {
        if (this.peers.has(consumerId))
            return this.peers.get(consumerId);
        if (!this.mediaStream)
            throw new Error("startStream() not called yet");
        const pc = new RTCPeerConnection({
            iceServers: this.cfg.iceServers ?? DEFAULT_ICE_SERVERS,
        });
        const sessionId = this.sessions.generateSessionId();
        this.sessionOf.set(consumerId, sessionId);
        // clone tracks so enabled-state is per-consumer
        const senders = [];
        for (const track of this.mediaStream.getTracks()) {
            const clone = track.clone();
            // In track mode, start disabled until first payment lands.
            clone.enabled = this.cfg.gating.mode === "signaling";
            senders.push(pc.addTrack(clone, this.mediaStream));
        }
        const ctx = {
            pc,
            senders,
            segmentIndex: 0,
            awaitingProof: false,
        };
        this.peers.set(consumerId, ctx);
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
            channel.onmessage = (ev) => void this.onDCMessage(consumerId, String(ev.data)).catch((e) => this.emit("error", e));
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
    startSegmentLoop(consumerId) {
        const ctx = this.peers.get(consumerId);
        if (!ctx)
            return;
        const dur = (this.cfg.gating.segmentDurationSeconds ?? 5) * 1000;
        const requestSegment = async () => {
            const sessionId = this.sessionOf.get(consumerId);
            const idx = ctx.segmentIndex;
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
                    this.setTrackEnabled(consumerId, false);
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
    async onDCMessage(consumerId, raw) {
        const ctx = this.peers.get(consumerId);
        if (!ctx)
            return;
        const msg = decodeDC(raw);
        if (!msg)
            return;
        if (msg.type === "segment_payment_proof") {
            const decision = await this.gate.processPayment(consumerId, msg.segmentIndex, msg.payload);
            ctx.awaitingProof = false;
            if (decision.ok) {
                this.setTrackEnabled(consumerId, true);
                ctx.dataChannel?.send(encodeDC(dc.confirmed(msg.segmentIndex, decision.txHash)));
                const v = this.gate.getViewer(consumerId);
                this.emit("consumer:paid", consumerId, this.cfg.gating.pricePerSegment ?? "0", msg.segmentIndex);
                this.emit("earnings:update", this.gate.totalEarnings());
                if (v && v.lastSegmentIndex === 0) {
                    ctx.dataChannel?.send(encodeDC(dc.resumed()));
                }
            }
            else {
                this.setTrackEnabled(consumerId, false);
                ctx.dataChannel?.send(encodeDC(dc.rejected(msg.segmentIndex, decision.reason ?? "rejected")));
                this.emit("consumer:defaulted", consumerId);
            }
        }
    }
    dropConsumer(consumerId) {
        const ctx = this.peers.get(consumerId);
        if (!ctx)
            return;
        if (ctx.segmentTimer)
            clearInterval(ctx.segmentTimer);
        try {
            ctx.dataChannel?.close();
            ctx.pc.close();
        }
        catch {
            /* ignore */
        }
        this.peers.delete(consumerId);
        this.gate.removeViewer(consumerId);
        this.emit("consumer:left", consumerId);
        this.emit("earnings:update", this.gate.totalEarnings());
    }
    /** Stop everything. */
    stop() {
        for (const id of [...this.peers.keys()])
            this.dropConsumer(id);
        this.mediaStream?.getTracks().forEach((t) => t.stop());
        this.signaling?.close();
    }
}
//# sourceMappingURL=PaywalledRTCProvider.js.map