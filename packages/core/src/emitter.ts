/**
 * Minimal typed event emitter that works in the browser (no Node 'events').
 */
export class TypedEmitter<E extends Record<string, (...args: any[]) => void>> {
  private handlers: { [K in keyof E]?: Array<E[K]> } = {};

  on<K extends keyof E>(event: K, cb: E[K]): this {
    (this.handlers[event] ??= []).push(cb);
    return this;
  }

  off<K extends keyof E>(event: K, cb: E[K]): this {
    this.handlers[event] = (this.handlers[event] ?? []).filter(
      (h) => h !== cb,
    ) as Array<E[K]>;
    return this;
  }

  protected emit<K extends keyof E>(event: K, ...args: Parameters<E[K]>): void {
    for (const cb of this.handlers[event] ?? []) {
      try {
        (cb as (...a: any[]) => void)(...args);
      } catch (err) {
        // never let a listener crash the SDK
        // eslint-disable-next-line no-console
        console.error(`[casper-webrtc] listener for "${String(event)}" threw`, err);
      }
    }
  }
}
