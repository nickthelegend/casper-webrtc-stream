import { useState } from "react";
import { WalletConnect } from "./WalletConnect";

export function PaymentConsent({
  pricePerSecond,
  providerHint,
  walletAddress,
  onStart,
}: {
  pricePerSecond: string;
  providerHint: string;
  walletAddress: string;
  onStart: (opts: { maxSpend: string }) => void;
}) {
  const [maxSpend, setMaxSpend] = useState("1.00");
  const [connected, setConnected] = useState(false);

  return (
    <div className="max-w-md mx-auto rounded-xl border border-casper-border bg-casper-panel p-6 space-y-4">
      <h2 className="text-lg font-semibold">Pay-as-you-go stream</h2>
      <div className="space-y-1 text-sm text-gray-300">
        <p>
          This stream costs{" "}
          <span className="text-casper-gold mono">{pricePerSecond}</span> token
          base units per second.
        </p>
        <p className="text-gray-400">
          Provider: <span className="mono">{providerHint.slice(0, 10)}…</span>
        </p>
        <p className="text-gray-400">Payment: per 5s segment, signed EIP-712</p>
      </div>

      <label className="block text-sm">
        <span className="text-gray-400">Max spend cap (CSPR)</span>
        <input
          type="number"
          step="0.1"
          value={maxSpend}
          onChange={(e) => setMaxSpend(e.target.value)}
          className="mt-1 w-full rounded bg-casper-bg border border-casper-border px-3 py-2 mono"
        />
      </label>

      <WalletConnect
        address={walletAddress}
        connected={connected}
        onConnect={() => setConnected(true)}
      />

      <button
        disabled={!connected || !walletAddress}
        onClick={() => onStart({ maxSpend })}
        className="w-full rounded-lg bg-casper-accent px-4 py-3 font-semibold hover:opacity-90 disabled:opacity-40"
      >
        ▶ Start Watching — Pay as you go
      </button>
    </div>
  );
}
