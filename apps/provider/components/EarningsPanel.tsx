/** Live CSPR earnings ticker. amountMotes is the raw motes total. */
export function EarningsPanel({
  amountMotes,
  viewers,
}: {
  amountMotes: string;
  viewers: number;
}) {
  // 1 CSPR = 1e9 motes
  const cspr = Number(BigInt(amountMotes || "0")) / 1e9;
  const usd = cspr * 0.05; // illustrative price

  return (
    <div>
      <h2 className="text-sm uppercase tracking-wider text-gray-400 mb-2">
        Earnings Today
      </h2>
      <div className="rounded-lg border border-casper-border bg-black/30 p-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-casper-gold">
            {cspr.toFixed(5)}
          </span>
          <span className="text-gray-400">CSPR</span>
          <span className="text-gray-500 text-sm">
            (~${usd.toFixed(2)})
          </span>
        </div>
        <div className="mt-2 text-sm text-gray-400">
          Active viewers: <span className="text-white">{viewers}</span>
        </div>
      </div>
    </div>
  );
}
