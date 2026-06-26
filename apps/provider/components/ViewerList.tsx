import type { ViewerState } from "@nickthelegend69/webrtc-payment-sdk-core";

function shortHash(s?: string): string {
  if (!s) return "anon";
  const h = s.replace(/^account-hash-/, "").replace(/^00/, "");
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}

export function ViewerList({
  viewers,
  pricePerSecond,
}: {
  viewers: ViewerState[];
  pricePerSecond: string;
}) {
  return (
    <div className="glass rounded-2xl p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-casper-muted">
          Viewers
        </span>
        <span className="font-mono text-xs text-casper-muted">{viewers.length}</span>
      </div>

      {viewers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-casper-muted">
          No viewers yet — share the link to start earning
        </div>
      ) : (
        <ul className="space-y-1.5">
          {viewers.map((v) => (
            <li
              key={v.consumerId}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
            >
              <span
                className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-semibold ${
                  v.enabled
                    ? "bg-casper-green/15 text-casper-green"
                    : "bg-casper-accent/15 text-casper-accent"
                }`}
              >
                {v.enabled ? "▶" : "⏸"}
              </span>
              <span className="font-mono text-sm text-casper-ghost">
                {shortHash(v.address ?? v.consumerId)}
              </span>
              <span
                className={`ml-auto rounded-full px-2.5 py-0.5 font-mono text-[11px] ${
                  v.enabled
                    ? "bg-casper-green/10 text-casper-green"
                    : "bg-casper-accent/10 text-casper-accent"
                }`}
              >
                {v.enabled ? `${pricePerSecond} CSPR/s` : "suspended"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
