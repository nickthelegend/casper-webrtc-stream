/**
 * Real Casper wallet connect via CSPR.click. Shows a Connect button that opens
 * the CSPR.click sign-in modal (Casper Wallet / Ledger / MetaMask Snap), and the
 * connected account hash once signed in.
 */
import type { WalletAccount } from "../lib/csprclick";

function shortHash(s: string): string {
  const h = s.replace(/^account-hash-/, "").replace(/^0x/, "");
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

export function WalletConnect({
  account,
  ready,
  onConnect,
  onDisconnect,
}: {
  account: WalletAccount | null;
  ready: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  if (account) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-casper-green/25 bg-casper-green/[0.06] px-3 py-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-casper-green/15 text-casper-green">
          ✓
        </span>
        <div className="leading-tight">
          <div className="text-[11px] text-casper-muted">Casper wallet connected</div>
          <div className="font-mono text-sm text-casper-green">
            {shortHash(account.accountHash)}
          </div>
        </div>
        <button
          onClick={onDisconnect}
          className="ml-auto rounded-lg px-2 py-1 text-xs text-casper-muted hover:text-casper-ghost"
        >
          disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onConnect}
      disabled={!ready}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-casper-violet/40 bg-casper-violet/10 px-4 py-3 font-semibold text-casper-ghost transition hover:bg-casper-violet/20 disabled:opacity-40"
    >
      <span>🔗</span>
      {ready ? "Connect Casper Wallet" : "Loading wallet…"}
    </button>
  );
}
