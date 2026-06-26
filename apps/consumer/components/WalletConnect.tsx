/**
 * Wallet display. In the demo the account comes from configured env
 * (NEXT_PUBLIC_CONSUMER_*). In production this is where you'd trigger CSPR.click
 * and read the connected account hash + public key.
 */
export function WalletConnect({
  address,
  connected,
  onConnect,
}: {
  address: string;
  connected: boolean;
  onConnect: () => void;
}) {
  const short = address
    ? address.replace(/^account-hash-/, "").replace(/^00/, "").slice(0, 8) +
      "…" +
      address.slice(-4)
    : "(no wallet configured)";

  if (connected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-casper-green/25 bg-casper-green/[0.06] px-3 py-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-casper-green/15 text-casper-green">
          ✓
        </span>
        <div className="leading-tight">
          <div className="text-[11px] text-casper-muted">Wallet connected</div>
          <div className="font-mono text-sm text-casper-green">{short}</div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onConnect}
      disabled={!address}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-casper-violet/40 bg-casper-violet/10 px-4 py-3 font-semibold text-casper-ghost transition hover:bg-casper-violet/20 disabled:opacity-40"
    >
      <span>🔗</span>
      {address ? "Connect wallet" : "No wallet configured"}
    </button>
  );
}
