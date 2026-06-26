import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import {
  PaywalledRTCProvider,
  type GatingConfig,
  type ViewerState,
} from "@nickthelegend/webrtc-payment-sdk-core";
import { createProviderRail, isConfigured } from "../lib/casper";
import { createDemoStream } from "../lib/demoStream";
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
    source: "demo",
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
      alert(`Could not start stream: ${(err as Error).message}`);
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
        <title>casper-webrtc-stream · Provider</title>
      </Head>
      <main className="min-h-screen p-6 max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold">
            👻 casper-webrtc-stream
            <span className="text-gray-500 font-normal"> · Provider Dashboard</span>
          </h1>
          {!isConfigured() && (
            <span className="text-xs rounded-full border border-casper-accent/40 text-casper-accent px-3 py-1">
              ⚠ payments not configured
            </span>
          )}
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="space-y-4">
            <div className="relative rounded-xl overflow-hidden border border-casper-border bg-black aspect-video">
              <video
                ref={videoRef}
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {live && (
                <span className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-sm">
                  <span className="h-2 w-2 rounded-full bg-casper-accent animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <EarningsPanel amountMotes={earnings} viewers={viewers.length} />
            <ViewerList viewers={viewers} pricePerSecond={settings.pricePerSecond} />
            {settlements.length > 0 && (
              <div className="rounded-lg border border-casper-border bg-black/30 p-4">
                <h3 className="text-xs uppercase tracking-wider text-gray-400 mb-2">
                  ⛓ On-chain settlements · {settlements.length}
                </h3>
                <ul className="space-y-1 max-h-40 overflow-auto mono text-xs">
                  {settlements.map((s) => (
                    <li key={s.txHash} className="flex justify-between gap-2">
                      <span className="text-gray-500">seg {s.idx}</span>
                      <a
                        href={`https://testnet.cspr.live/transaction/${s.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-casper-accent truncate hover:underline"
                      >
                        {s.txHash.slice(0, 18)}…
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section>
            <StreamControls
              live={live}
              settings={settings}
              onChange={setSettings}
              onStart={start}
              onStop={stop}
              streamLink={streamLink}
            />
          </section>
        </div>
      </main>
    </>
  );
}
