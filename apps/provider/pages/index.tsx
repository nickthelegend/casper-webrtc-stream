import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import {
  PaywalledRTCProvider,
  type GatingConfig,
  type ViewerState,
} from "@nickthelegend/webrtc-payment-sdk-core";
import { createProviderRail, isConfigured } from "../lib/casper";
import { createDemoStream, createVideoFileStream } from "../lib/demoStream";
import { StreamControls, type StreamSettings } from "../components/StreamControls";
import { EarningsPanel } from "../components/EarningsPanel";
import { ViewerList } from "../components/ViewerList";

const SIGNALING_URL =
  process.env.NEXT_PUBLIC_SIGNALING_URL ?? "ws://localhost:3001";
const CONSUMER_URL =
  process.env.NEXT_PUBLIC_CONSUMER_URL ?? "http://localhost:3002";
// Seconds per paid segment = one on-chain settle each. Tunable: shorter = more
// frequent on-chain payments, but Casper finality is ~30-60s and the facilitator
// settles sequentially, so keep it ≥ ~10s so settles don't pile up. (The
// reference SDK defaults to 30s.)
const SEGMENT_SECONDS = 15;

function csprToMotes(cspr: string): string {
  const n = Number(cspr || "0");
  return BigInt(Math.round(n * 1e9)).toString();
}

export default function ProviderDashboard() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const providerRef = useRef<PaywalledRTCProvider | null>(null);

  const [live, setLive] = useState(false);
  const [settings, setSettings] = useState<StreamSettings>({
    pricePerSecond: "0.01",
    gatingMode: "track",
    token: "CSPR",
    source: "bbb",
  });
  const [viewers, setViewers] = useState<ViewerState[]>([]);
  const [earnings, setEarnings] = useState("0");
  const [streamLink, setStreamLink] = useState<string>();
  const [settlements, setSettlements] = useState<{ idx: number; txHash: string }[]>([]);

  useEffect(() => {
    return () => providerRef.current?.stop();
  }, []);

  const refresh = () => {
    const p = providerRef.current;
    if (!p) return;
    setViewers([...p.listViewers()]);
    setEarnings(p.totalEarnings());
  };

  const start = async () => {
    try {
      let media: MediaStream;
      if (settings.source === "screen") {
        media = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
      } else if (settings.source === "bbb") {
        // Loop Big Buck Bunny as the broadcast (real video content).
        try {
          media = await createVideoFileStream("/bbb.mp4");
        } catch (e) {
          console.warn("[provider] Big Buck Bunny failed, using demo feed:", e);
          media = createDemoStream();
        }
      } else if (settings.source === "demo") {
        // Synthetic animated feed — works on a machine with no camera.
        media = createDemoStream();
      } else {
        // "auto": real camera, falling back to the demo feed if none is found.
        try {
          media = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        } catch {
          media = createDemoStream();
        }
      }
      if (videoRef.current) {
        videoRef.current.srcObject = media;
        await videoRef.current.play().catch(() => {});
      }

      const pricePerSegment = csprToMotes(
        String(Number(settings.pricePerSecond) * SEGMENT_SECONDS),
      );
      const gating: GatingConfig = {
        mode: settings.gatingMode,
        segmentDurationSeconds: SEGMENT_SECONDS,
        pricePerSegment,
        pricePerSession: pricePerSegment,
      };

      const provider = new PaywalledRTCProvider({
        paymentRail: createProviderRail(),
        gating,
        signalingServerUrl: SIGNALING_URL,
      });
      providerRef.current = provider;

      provider.on("consumer:joined", refresh);
      provider.on("consumer:left", refresh);
      provider.on("consumer:paid", refresh);
      provider.on("consumer:defaulted", refresh);
      provider.on("earnings:update", (total) => {
        setEarnings(total);
        refresh();
      });
      // each segment's on-chain settle confirms here (one real tx per segment)
      provider.on("consumer:settled", (_c, idx, txHash) =>
        setSettlements((s) => [{ idx, txHash }, ...s].slice(0, 25)),
      );

      await provider.startStream(media);
      setStreamLink(`${CONSUMER_URL}/?room=${provider.room}`);
      setLive(true);
    } catch (err) {
      console.error("[provider] start stream failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Could not start stream: ${msg || "see the console (F12) for details"}`);
    }
  };

  const stop = () => {
    providerRef.current?.stop();
    providerRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setLive(false);
    setViewers([]);
    setStreamLink(undefined);
    setSettlements([]);
  };

  return (
    <>
      <Head>
        <title>Casper Stream · Provider Studio</title>
      </Head>
      <main className="mx-auto min-h-screen max-w-6xl px-5 py-7">
        {/* brand header */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-casper-violet to-casper-indigo text-xl shadow-glow">
              👻
            </div>
            <div>
              <h1 className="font-display text-xl font-bold leading-none">
                <span className="text-gradient">Casper Stream</span>
                <span className="ml-2 align-middle text-xs font-medium text-casper-muted">
                  Provider Studio
                </span>
              </h1>
              <p className="mt-1 text-xs text-casper-muted">
                Pay-per-second WebRTC · settled on Casper via x402 micropayments
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {live && (
              <span className="flex animate-pulse-glow items-center gap-2 rounded-full bg-casper-accent/15 px-3 py-1.5 text-xs font-semibold text-casper-accent">
                <span className="h-2 w-2 rounded-full bg-casper-accent" /> ON AIR
              </span>
            )}
            <span
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                isConfigured()
                  ? "bg-casper-green/10 text-casper-green"
                  : "bg-casper-accent/10 text-casper-accent"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isConfigured() ? "bg-casper-green" : "bg-casper-accent"
                }`}
              />
              {isConfigured() ? "facilitator connected" : "payments not configured"}
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* left: stage + earnings + viewers */}
          <section className="space-y-6 lg:col-span-3">
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-card">
              <video
                ref={videoRef}
                muted
                playsInline
                className="aspect-video w-full object-cover"
              />
              {/* gradient frame */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
              {live ? (
                <span className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold backdrop-blur">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-casper-accent" />
                  LIVE
                </span>
              ) : (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <div className="font-display text-2xl font-semibold text-casper-muted">
                      Studio ready
                    </div>
                    <p className="mt-1 text-sm text-casper-muted/70">
                      Press <span className="text-casper-accent">Go Live</span> to start the paid stream
                    </p>
                  </div>
                </div>
              )}
              {live && (
                <span className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1.5 font-mono text-xs text-casper-gold backdrop-blur">
                  {settings.pricePerSecond} CSPR/s · {SEGMENT_SECONDS}s segments
                </span>
              )}
            </div>

            <EarningsPanel amountMotes={earnings} viewers={viewers.length} />
            <ViewerList viewers={viewers} pricePerSecond={settings.pricePerSecond} />
          </section>

          {/* right: controls + settlement feed */}
          <section className="space-y-6 lg:col-span-2">
            <StreamControls
              live={live}
              settings={settings}
              onChange={setSettings}
              onStart={start}
              onStop={stop}
              streamLink={streamLink}
            />

            <div className="glass rounded-2xl p-4 shadow-card">
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-casper-muted">
                  <span className="text-casper-green">⛓</span> On-chain settlements
                </span>
                <span className="rounded-full bg-casper-green/10 px-2 py-0.5 font-mono text-xs text-casper-green">
                  {settlements.length}
                </span>
              </div>
              {settlements.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-casper-muted">
                  Each paid segment settles here as a real Casper testnet tx
                </div>
              ) : (
                <ul className="max-h-72 space-y-1.5 overflow-auto pr-1">
                  {settlements.map((s) => (
                    <li
                      key={s.txHash}
                      className="flex animate-slide-up items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
                    >
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-casper-green/15 text-xs text-casper-green">
                        ✓
                      </span>
                      <span className="font-mono text-xs text-casper-muted">
                        segment {s.idx}
                      </span>
                      <a
                        href={`https://testnet.cspr.live/transaction/${s.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto truncate font-mono text-xs text-casper-indigo hover:text-casper-violet hover:underline"
                      >
                        {s.txHash.slice(0, 12)}… ↗
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-casper-muted">
          <span>Casper Agentic Buildathon 2026</span>
          <span className="text-white/20">·</span>
          <span>x402 facilitator: CSPR.cloud</span>
          <span className="text-white/20">·</span>
          <span className="font-mono">@nickthelegend/webrtc-payment-sdk</span>
        </footer>
      </main>
    </>
  );
}
