/**
 * PaywalledRTCConsumer — the viewer.
 *
 * Connects to a provider's stream, pays via the injected PaymentRail, and
 * exposes the remote MediaStream once delivery starts. In Mode 2 it auto-pays
 * each segment over the DataChannel up to a hard spend cap.
 */
import { DEFAULT_ICE_SERVERS, } from "./types.js";
import { TypedEmitter } from "./emitter.js";
import { SignalingClient } from "./SignalingClient.js";
import { dc, decodeDC, encodeDC } from "./DataChannelProtocol.js";
export class PaywalledRTCConsumer extends TypedEmitter {
    cfg;
    pc;
    signaling;
    dataChannel;
    remote = new MediaStream();
    providerId;
    sessionId = "";
    auto;
    totalSpent = 0n;
    capped = false;
    constructor(config) {
        super();
        this.cfg = config;
    }
    /**
     * Connect to a provider stream. `providerUrl` is the signaling URL with a
     * room query param, e.g. "ws://localhost:3001?room=abc123".
     */
    async joinStream(providerUrl) {
        const room = new URL(providerUrl.replace(/^ws/, "http")).searchParams.get("room");
        if (!room)
            throw new Error("providerUrl missing ?room=");
        const wsUrl = providerUrl.split("?")[0];
        this.pc = new RTCPeerConnection({
            iceServers: this.cfg.iceServers ?? DEFAULT_ICE_SERVERS,
        });
        this.signaling = new SignalingClient(wsUrl, room, "consumer");
        this.pc.ontrack = (e) => {
            this.remote.addTrack(e.track);
            if (this.remote.getTracks().length === 1) {
                this.emit("stream:started", this.remote);
            }
        };
        this.pc.onicecandidate = (e) => {
            if (e.candidate && this.providerId) {
                this.signaling?.send("ice-candidate", e.candidate.toJSON(), this.providerId);
            }
        };
        this.pc.ondatachannel = (e) => this.attachDataChannel(e.channel);
        await this.signaling.connect();
        return new Promise((resolve, reject) => {
            const dispose = this.signaling.onMessage(async (msg) => {
                try {
                    if (msg.type === "offer") {
                        this.providerId = msg.from;
                        await this.pc.setRemoteDescription(msg.payload);
                        const answer = await this.pc.createAnswer();
                        await this.pc.setLocalDescription(answer);
                        this.signaling.send("answer", answer, this.providerId);
                        this.sessionId = crypto.randomUUID();
                        resolve({ stream: this.remote, sessionId: this.sessionId });
                    }
                    else if (msg.type === "ice-candidate") {
                        await this.pc.addIceCandidate(msg.payload);
                    }
                }
                catch (err) {
                    dispose();
                    reject(err);
                }
            });
            // safety timeout
            setTimeout(() => reject(new Error("joinStream timed out waiting for offer")), 20_000);
        });
    }
    /** Enable per-segment auto-payment (Mode 2). */
    enableAutoPayment(config) {
        this.auto = config;
    }
    attachDataChannel(channel) {
        this.dataChannel = channel;
        channel.onmessage = (ev) => void this.onDCMessage(String(ev.data)).catch((e) => this.emit("error", e));
    }
    async onDCMessage(raw) {
        const msg = decodeDC(raw);
        if (!msg)
            return;
        switch (msg.type) {
            case "segment_payment_request":
                await this.handlePaymentRequest(msg.segmentIndex, msg.requirements);
                break;
            case "segment_confirmed":
                this.emit("payment:confirmed", msg.segmentIndex, msg.txHash);
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
    async handlePaymentRequest(segmentIndex, requirements) {
        if (!this.auto)
            return; // manual mode: app drives payment itself
        if (this.capped)
            return;
        const next = this.totalSpent + BigInt(requirements.amount);
        if (next > BigInt(this.auto.maxTotalSpend)) {
            this.capped = true;
            this.auto.onMaxReached?.();
            this.emit("stream:paused");
            return;
        }
        const payload = await this.cfg.paymentRail.buildPayload(requirements, this.cfg.signFn);
        this.dataChannel?.send(encodeDC(dc.paymentProof(segmentIndex, payload)));
        this.totalSpent = next;
        this.auto.onPayment?.(requirements.amount, segmentIndex);
        this.emit("payment:sent", requirements.amount, segmentIndex);
    }
    totalSpentMotes() {
        return this.totalSpent.toString();
    }
    disconnect() {
        try {
            this.dataChannel?.close();
            this.pc?.close();
        }
        catch {
            /* ignore */
        }
        this.signaling?.close();
    }
}
//# sourceMappingURL=PaywalledRTCConsumer.js.map