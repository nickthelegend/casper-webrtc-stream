/**
 * Tiny WebSocket signaling client. Relays SDP offers/answers and ICE
 * candidates through the standalone signaling server. Transport-only — it
 * knows nothing about payments.
 */
import type { SignalingMessage, SignalingMessageType } from "./types.js";
type Handler = (msg: SignalingMessage) => void;
export declare class SignalingClient {
    private url;
    private room;
    private role;
    private ws?;
    private handlers;
    private queue;
    readonly peerId: string;
    constructor(url: string, room: string, role: "provider" | "consumer", peerId?: string);
    connect(): Promise<void>;
    onMessage(handler: Handler): () => void;
    send(type: SignalingMessageType, payload: unknown, to?: string): void;
    private raw;
    close(): void;
}
export {};
//# sourceMappingURL=SignalingClient.d.ts.map