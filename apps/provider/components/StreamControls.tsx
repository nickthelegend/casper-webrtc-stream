import { useState } from "react";

export interface StreamSettings {
  pricePerSecond: string; // CSPR
  gatingMode: "signaling" | "track" | "crypto";
  token: string;
  source: "auto" | "demo" | "screen" | "bbb";
}

const MODES: {
  value: StreamSettings["gatingMode"];
  label: string;
  hint: string;
}[] = [
  { value: "track", label: "Track", hint: "pay per segment · N txs" },
  { value: "signaling", label: "Signaling", hint: "pay once · 1 tx" },
  { value: "crypto", label: "Crypto", hint: "per segment · encrypted" },
];

const SOURCES: { value: StreamSettings["source"]; label: string }[] = [
  { value: "bbb", label: "🐰 Big Buck Bunny" },
  { value: "demo", label: "✨ Demo feed" },
  { value: "screen", label: "🖥 Share screen" },
  { value: "auto", label: "🎥 Camera" },
];

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
    <div className="glass rounded-2xl p-5 shadow-card">
      <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-casper-muted">
        Stream settings
      </span>

      {/* price */}
      <label className="mt-4 block">
        <span className="text-xs text-casper-muted">Price · CSPR per second</span>
        <div className="mt-1.5 flex items-center rounded-xl border border-white/10 bg-black/30 px-3 focus-within:border-casper-violet/60">
          <span className="font-mono text-sm text-casper-gold">◈</span>
          <input
            type="number"
            step="0.001"
            disabled={live}
            value={settings.pricePerSecond}
            onChange={(e) => onChange({ ...settings, pricePerSecond: e.target.value })}
            className="w-full bg-transparent px-2 py-2.5 font-mono text-casper-ghost outline-none disabled:opacity-50"
          />
          <span className="text-xs text-casper-muted">CSPR/s</span>
        </div>
      </label>

      {/* gating mode — segmented */}
      <div className="mt-4">
        <span className="text-xs text-casper-muted">Gating mode</span>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {MODES.map((m) => {
            const active = settings.gatingMode === m.value;
            return (
              <button
                key={m.value}
                disabled={live}
                onClick={() => onChange({ ...settings, gatingMode: m.value })}
                className={`rounded-xl border px-2 py-2.5 text-left transition disabled:opacity-50 ${
                  active
                    ? "border-casper-violet/60 bg-casper-violet/10 shadow-glow"
                    : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <div
                  className={`text-sm font-semibold ${
                    active ? "text-casper-ghost" : "text-casper-muted"
                  }`}
                >
                  {m.label}
                </div>
                <div className="mt-0.5 text-[10px] leading-tight text-casper-muted">
                  {m.hint}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* source */}
      <label className="mt-4 block">
        <span className="text-xs text-casper-muted">Video source</span>
        <select
          disabled={live}
          value={settings.source}
          onChange={(e) =>
            onChange({ ...settings, source: e.target.value as StreamSettings["source"] })
          }
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-casper-ghost outline-none focus:border-casper-violet/60 disabled:opacity-50"
        >
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value} className="bg-casper-surface">
              {s.label}
            </option>
          ))}
        </select>
      </label>

      {/* actions */}
      <div className="mt-5 flex gap-2.5">
        {!live ? (
          <button
            onClick={onStart}
            className="group flex-1 rounded-xl bg-casper-accent px-4 py-3 font-semibold text-white shadow-glow-red transition hover:brightness-110"
          >
            ● Go Live
          </button>
        ) : (
          <button
            onClick={onStop}
            className="flex-1 rounded-xl border border-casper-accent/60 px-4 py-3 font-semibold text-casper-accent transition hover:bg-casper-accent/10"
          >
            ■ Stop Stream
          </button>
        )}
        <button
          onClick={copy}
          disabled={!streamLink}
          className="rounded-xl border border-white/10 px-4 py-3 text-sm text-casper-ghost transition hover:bg-white/5 disabled:opacity-40"
        >
          {copied ? "✓ Copied" : "Copy link"}
        </button>
      </div>

      {streamLink && (
        <div className="mt-3 rounded-xl border border-white/5 bg-black/30 px-3 py-2">
          <p className="font-mono text-[11px] leading-relaxed text-casper-muted break-all">
            {streamLink}
          </p>
        </div>
      )}
    </div>
  );
}
