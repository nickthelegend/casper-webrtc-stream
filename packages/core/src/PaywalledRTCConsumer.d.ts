/**
 * PaywalledRTCConsumer — the viewer.
 *
 * Connects to a provider's stream, pays via the injected PaymentRail, and
 * exposes the remote MediaStream once delivery starts. In Mode 2 it auto-pays
 * each segment over the DataChannel up to a hard spend cap.
 */
import { type AutoPaymentConfig, type ConsumerConfig } from "./types.js";
import { TypedEmitter } from "./emitter.js";
interface ConsumerEvents extends Record<string, (...args: any[]) => void> {
    "stream:started": (stream: MediaStream) => void;
    "stream:paused": () => void;
    "stream:resumed": () => void;
    "payment:sent": (amount: string, segmentIndex: number) => void;
    "payment:confirmed": (segmentIndex: number, txHash?: string) => void;
    error: (err: Error) => void;
}
export declare class PaywalledRTCConsumer extends TypedEmitter<ConsumerEvents> {
    private cfg;
    private pc?;
    private signaling?;
    private dataChannel?;
    private remote;
    private providerId?;
    private sessionId;
    private auto?;
    private totalSpent;
    private capped;
    constructor(config: ConsumerConfig);
    /**
     * Connect to a provider stream. `providerUrl` is the signaling URL with a
     * room query param, e.g. "ws://localhost:3001?room=abc123".
     */
    joinStream(providerUrl: string): Promise<{
        stream: MediaStream;
        sessionId: string;
    }>;
    /** Enable per-segment auto-payment (Mode 2). */
    enableAutoPayment(config: AutoPaymentConfig): void;
    private attachDataChannel;
    private onDCMessage;
    private handlePaymentRequest;
    totalSpentMotes(): string;
    disconnect(): void;
}
export {};
//# sourceMappingURL=PaywalledRTCConsumer.d.ts.map