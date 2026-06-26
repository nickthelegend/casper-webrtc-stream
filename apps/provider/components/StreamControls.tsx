import { useState } from "react";

export interface StreamSettings {
  pricePerSecond: string; // CSPR
  gatingMode: "signaling" | "track" | "crypto";
  token: string;
  source: "auto" | "demo" | "screen" | "bbb";
}

export function StreamControls({
  live,
  settings,
  onChange,
  onStart,
  onStop,
  streamLink,
}: {
  live: boolean;
  settings: StreamSettings;
  onChange: (s: StreamSettings) => void;
  onStart: () => void;
  onStop: () => void;
  streamLink?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!streamLink) return;
    await navigator.clipboard.writeText(streamLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm uppercase tracking-wider text-gray-400 mb-2">
          Stream Settings
        </h2>
        <div className="rounded-lg border border-casper-border bg-black/30 p-4 space-y-3">
          <label className="block text-sm">
            <span className="text-gray-400">Price (CSPR / second)</span>
            <input
              type="number"
              step="0.001"
              disabled={live}
              value={settings.pricePerSecond}
              onChange={(e) =>
                onChange({ ...settings, pricePerSecond: e.target.value })
              }
              className="mt-1 w-full rounded bg-casper-bg border border-casper-border px-3 py-2 mono disabled:opacity-50"
            />
          </label>

          <label className="block text-sm">
            <span className="text-gray-400">Gating mode</span>
            <select
              disabled={live}
              value={settings.gatingMode}
              onChange={(e) =>
                onChange({
                  ...settings,
                  gatingMode: e.target.value as StreamSettings["gatingMode"],
                })
              }
              className="mt-1 w-full rounded bg-casper-bg border border-casper-border px-3 py-2 disabled:opacity-50"
            >
              <option value="track">Track Gate (per-segment)</option>
              <option value="signaling">Signaling Gate (whole-stream)</option>
              <option value="crypto">Crypto Gate (per-segment, encrypted)</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-gray-400">Video source</span>
            <select
              disabled={live}
              value={settings.source}
              onChange={(e) =>
                onChange({
                  ...settings,
                  source: e.target.value as StreamSettings["source"],
                })
              }
              className="mt-1 w-full rounded bg-casper-bg border border-casper-border px-3 py-2 disabled:opacity-50"
            >
              <option value="bbb">🐰 Big Buck Bunny (looping video)</option>
              <option value="demo">Demo feed (animated, no camera)</option>
              <option value="screen">Share screen / window</option>
              <option value="auto">Camera (falls back to demo)</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-gray-400">Token</span>
            <select
              disabled={live}
              value={settings.token}
              onChange={(e) => onChange({ ...settings, token: e.target.value })}
              className="mt-1 w-full rounded bg-casper-bg border border-casper-border px-3 py-2 disabled:opacity-50"
            >
              <option value="CSPR">CSPR</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex gap-3">
        {!live ? (
          <button
            onClick={onStart}
            className="flex-1 rounded-lg bg-casper-accent px-4 py-3 font-semibold hover:opacity-90"
          >
            Start Stream
          </button>
        ) : (
          <button
            onClick={onStop}
            className="flex-1 rounded-lg border border-casper-accent text-casper-accent px-4 py-3 font-semibold hover:bg-casper-accent/10"
          >
            Stop Stream
          </button>
        )}
        <button
          onClick={copy}
          disabled={!streamLink}
          className="rounded-lg border border-casper-border px-4 py-3 hover:bg-white/5 disabled:opacity-40"
        >
          {copied ? "Copied!" : "Copy Stream Link"}
        </button>
      </div>
      {streamLink && (
        <p className="mono text-xs text-gray-500 break-all">{streamLink}</p>
      )}
    </div>
  );
}
