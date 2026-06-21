/**
 * Session + segment nonce management and replay protection.
 *
 * Segment nonces are deterministic (SHA-256 of "sessionId:segmentIndex") so
 * both peers can derive and bind them. The provider rejects any nonce it has
 * already seen. Hashing is synchronous and dependency-free so the same code
 * runs in the browser and in Node (agents, tests).
 */
export declare function sha256Hex(input: string): string;
export declare class SessionManager {
    /** nonce -> expiry (ms) */
    private seen;
    /** RFC4122 session id. */
    generateSessionId(): string;
    /** Deterministic per-segment nonce (64-hex / 32 bytes), derivable by peers. */
    generateSegmentNonce(sessionId: string, segmentIndex: number): string;
    /**
     * Returns true if this nonce has already been used (replay). First use is
     * recorded and returns false.
     */
    isReplay(nonce: string, _sessionId?: string, ttlSeconds?: number): boolean;
    /**
     * Validate a nonce matches the expected segment nonce AND has not been used.
     * Returns false on mismatch or replay.
     */
    validateNonce(nonce: string, sessionId: string, segmentIndex: number, ttlSeconds?: number): boolean;
    private evictExpired;
}
//# sourceMappingURL=SessionManager.d.ts.map