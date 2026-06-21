/**
 * Minimal typed event emitter that works in the browser (no Node 'events').
 */
export class TypedEmitter {
    handlers = {};
    on(event, cb) {
        (this.handlers[event] ??= []).push(cb);
        return this;
    }
    off(event, cb) {
        this.handlers[event] = (this.handlers[event] ?? []).filter((h) => h !== cb);
        return this;
    }
    emit(event, ...args) {
        for (const cb of this.handlers[event] ?? []) {
            try {
                cb(...args);
            }
            catch (err) {
                // never let a listener crash the SDK
                // eslint-disable-next-line no-console
                console.error(`[casper-webrtc] listener for "${String(event)}" threw`, err);
            }
        }
    }
}
//# sourceMappingURL=emitter.js.map