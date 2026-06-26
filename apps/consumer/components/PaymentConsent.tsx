import { useState } from "react";
import { WalletConnect } from "./WalletConnect";
import type { WalletAccount } from "../lib/csprclick";

export function PaymentConsent({
  pricePerSecond,
  providerHint,
  walletAccount,
  walletReady,
  demoAvailable,
  onConnect,
  onDisconnect,
  onStart,
}: {
  pricePerSecond: string;
  providerHint: string;
  walletAccount: WalletAccount | null;
  walletReady: boolean;
  demoAvailable: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onStart: (opts: { maxSpend: string }) => void;
}) {
  const [maxSpend, setMaxSpend] = useState("1.00");
  const canStart = Boolean(walletAccount) || demoAvailable;

  return (
    <div className="mx-auto max-w-md">
      <div className="glass relative overflow-hidden rounded-2xl p-6 shadow-card">
        <div className="pointer-events-none absolute -left-20 -top-24 h-48 w-48 rounded-full bg-casper-violet/15 blur-3xl" />

        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-casper-violet">
          <span className="h-1.5 w-1.5 rounded-full bg-casper-violet" />
          x402 paywall
        </div>
        <h2 className="mt-2 font-display text-2xl font-bold text-casper-ghost">
          Pay-as-you-go stream
        </h2>

        <div className="mt-4 space-y-2.5">
          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-sm">
            <span className="text-casper-muted">Price</span>
            <span className="font-mono text-casper-gold">
              {pricePerSecond === "—" ? "—" : pricePerSecond} CSPR / sec
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-sm">
            <span className="text-casper-muted">Billing</span>
            <span className="text-casper-ghost">per segment · signed EIP-712</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-sm">
            <span className="text-casper-muted">Room</span>
            <span className="font-mono text-casper-ghost">
              {providerHint.slice(0, 12)}…
            </span>
          </div>
        </div>

        <label className="mt-4 block">
          <span className="text-xs text-casper-muted">Spend cap · you never pay more than this</span>
          <div className="mt-1.5 flex items-center rounded-xl border border-white/10 bg-black/30 px-3 focus-within:border-casper-violet/60">
            <span className="font-mono text-sm text-casper-gold">◈</span>
            <input
              type="number"
              step="0.1"
              value={maxSpend}
              onChange={(e) => setMaxSpend(e.target.value)}
              className="w-full bg-transparent px-2 py-2.5 font-mono text-casper-ghost outline-none"
            />
            <span className="text-xs text-casper-muted">CSPR</span>
          </div>
        </label>

        <div className="mt-4">
          <WalletConnect
            account={walletAccount}
            ready={walletReady}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
          />
        </div>

        <button
          disabled={!canStart}
          onClick={() => onStart({ maxSpend })}
          className="mt-4 w-full rounded-xl bg-casper-accent px-4 py-3.5 font-semibold text-white shadow-glow-red transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          ▶ Start watching — {walletAccount ? "pay with wallet" : "pay as you go"}
        </button>
        <p className="mt-2 text-center text-xs text-casper-muted">
          {walletAccount
            ? "Each segment is signed by your Casper wallet"
            : demoAvailable
              ? "Connect a wallet to sign with it — or start with the demo key"
              : "Connect your Casper wallet to begin"}
        </p>
      </div>
    </div>
  );
}
