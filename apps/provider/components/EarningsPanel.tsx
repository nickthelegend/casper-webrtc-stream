/** Live earnings hero. amountMotes is the raw base-unit total. */
export function EarningsPanel({
  amountMotes,
  viewers,
}: {
  amountMotes: string;
  viewers: number;
}) {
  const cspr = Number(BigInt(amountMotes || "0")) / 1e9;
  const usd = cspr * 0.05; // illustrative

  return (
    <div className="glass relative overflow-hidden rounded-2xl p-5 shadow-card">
      <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-casper-gold/10 blur-3xl" />
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-casper-muted">
          Earned this session
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-casper-green">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping2 rounded-full bg-casper-green/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-casper-green" />
          </span>
          settling on-chain
        </span>
      </div>

      <div className="mt-3 flex items-end gap-2">
        <span className="font-display text-5xl font-bold tabular-nums text-casper-gold [text-shadow:0_0_34px_rgba(255,194,75,0.32)]">
          {cspr.toFixed(5)}
        </span>
        <span className="mb-1.5 text-sm text-casper-muted">CSPR</span>
      </div>
      <div className="mt-1 text-xs text-casper-muted">
        ≈ ${usd.toFixed(2)} · paid per second, settled per segment
      </div>

      <div className="mt-4 flex items-center border-t border-white/5 pt-3 text-sm">
        <span className="text-casper-muted">Active viewers</span>
        <span className="ml-auto rounded-full bg-white/5 px-2.5 py-0.5 font-mono text-casper-ghost">
          {viewers}
        </span>
      </div>
    </div>
  );
}
