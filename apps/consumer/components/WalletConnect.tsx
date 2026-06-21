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
    ? address.replace(/^account-hash-/, "").slice(0, 10) + "…"
    : "(no wallet configured)";

  if (connected) {
    return (
      <div className="text-sm text-gray-400">
        Wallet: <span className="mono text-green-400">{short}</span>
      </div>
    );
  }

  return (
    <button
      onClick={onConnect}
      disabled={!address}
      className="w-full rounded-lg border border-casper-border px-4 py-2 hover:bg-white/5 disabled:opacity-40"
    >
      {address ? "Use wallet" : "No wallet configured"}
    </button>
  );
}
