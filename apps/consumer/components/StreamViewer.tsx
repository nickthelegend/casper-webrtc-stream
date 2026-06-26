import { forwardRef } from "react";

export const StreamViewer = forwardRef<
  HTMLVideoElement,
  { paid: string; watching: number; suspended: boolean }
>(function StreamViewer({ paid, watching, suspended }, ref) {
  const cspr = Number(BigInt(paid || "0")) / 1e9;
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-card">
        <video
          ref={ref}
          autoPlay
          playsInline
          className="aspect-video w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />

        {!suspended && (
          <span className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold backdrop-blur">
            <span className="h-2 w-2 animate-pulse rounded-full bg-casper-green" />
            WATCHING
          </span>
        )}

        {suspended && (
          <div className="absolute inset-0 grid place-items-center bg-black/75 backdrop-blur-sm">
            <div className="text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 animate-pulse-glow place-items-center rounded-2xl bg-casper-accent/15 text-xl text-casper-accent">
                ⏸
              </div>
              <p className="font-display text-lg font-semibold text-casper-ghost">
                Stream paused
              </p>
              <p className="mt-1 text-sm text-casper-muted">
                Awaiting the next on-chain payment…
              </p>
            </div>
          </div>
        )}
      </div>

      {/* live stat strip */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-2xl p-4 shadow-card">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-casper-muted">
            Paid so far
          </div>
          <div className="mt-1 flex items-end gap-1.5">
            <span className="font-display text-2xl font-bold tabular-nums text-casper-gold">
              {cspr.toFixed(5)}
            </span>
            <span className="mb-0.5 text-xs text-casper-muted">CSPR</span>
          </div>
        </div>
        <div className="glass rounded-2xl p-4 shadow-card">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-casper-muted">
            Watch time
          </div>
          <div className="mt-1 flex items-end gap-1.5">
            <span className="font-display text-2xl font-bold tabular-nums text-casper-ghost">
              {watching}
            </span>
            <span className="mb-0.5 text-xs text-casper-muted">sec</span>
          </div>
        </div>
      </div>
    </div>
  );
});
