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
import { type PaymentPayload, type PaymentRequirements, type ProviderConfig } from "./types.js";
import { TypedEmitter } from "./emitter.js";
interface ProviderEvents extends Record<string, (...args: any[]) => void> {
    "consumer:joined": (consumerId: string) => void;
    "consumer:paid": (consumerId: string, amount: string, segmentIndex: number) => void;
    "consumer:defaulted": (consumerId: string) => void;
    "consumer:left": (consumerId: string) => void;
    "earnings:update": (totalMotes: string) => void;
    error: (err: Error) => void;
}
export declare class PaywalledRTCProvider extends TypedEmitter<ProviderEvents> {
    private cfg;
    private sessions;
    private gate;
    private signaling?;
    private mediaStream?;
    private peers;
    /** sessionId per consumer */
    private sessionOf;
    readonly room: string;
    constructor(config: ProviderConfig);
    /** Begin broadcasting. Connects to signaling and waits for consumers. */
    startStream(mediaStream: MediaStream): Promise<void>;
    /** PaymentRequirements for a consumer's whole-stream (Mode 1) gate. */
    getPaymentRequirements(sessionId: string): PaymentRequirements;
    /**
     * Mode 1: verify a consumer's whole-stream payment, then build + return an
     * SDP offer. Wire this to your HTTP /join route.
     */
    admitConsumer(consumerId: string, paymentPayload: PaymentPayload): Promise<{
        accepted: boolean;
        sdpOffer?: RTCSessionDescriptionInit;
        reason?: string;
    }>;
    /** Mode 2: directly toggle a consumer's track. */
    setTrackEnabled(consumerId: string, enabled: boolean): void;
    listViewers(): import("./types.js").ViewerState[];
    totalEarnings(): string;
    private createPeerFor;
    private startSegmentLoop;
    private onDCMessage;
    private dropConsumer;
    /** Stop everything. */
    stop(): void;
}
export {};
//# sourceMappingURL=PaywalledRTCProvider.d.ts.map