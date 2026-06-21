import type { ViewerState } from "@nickthelegend/webrtc-payment-sdk-core";

function shortHash(s?: string): string {
  if (!s) return "anon";
  const h = s.replace(/^account-hash-/, "");
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
    <div>
      <h2 className="text-sm uppercase tracking-wider text-gray-400 mb-2">
        Viewers
      </h2>
      <div className="rounded-lg border border-casper-border bg-black/30 divide-y divide-casper-border">
        {viewers.length === 0 && (
          <p className="px-4 py-3 text-sm text-gray-500">No viewers yet</p>
        )}
        {viewers.map((v) => (
          <div
            key={v.consumerId}
            className="flex items-center justify-between px-4 py-3 text-sm"
          >
            <span className="mono">
              {v.enabled ? (
                <span className="text-green-400">✓</span>
              ) : (
                <span className="text-casper-accent">✗</span>
              )}{" "}
              {shortHash(v.address ?? v.consumerId)}
            </span>
            <span className="text-gray-400 mono">
              {v.enabled ? `${pricePerSecond} CSPR/s` : "suspended"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
