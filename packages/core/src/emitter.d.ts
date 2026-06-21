/**
 * Minimal typed event emitter that works in the browser (no Node 'events').
 */
export declare class TypedEmitter<E extends Record<string, (...args: any[]) => void>> {
    private handlers;
    on<K extends keyof E>(event: K, cb: E[K]): this;
    off<K extends keyof E>(event: K, cb: E[K]): this;
    protected emit<K extends keyof E>(event: K, ...args: Parameters<E[K]>): void;
}
//# sourceMappingURL=emitter.d.ts.map