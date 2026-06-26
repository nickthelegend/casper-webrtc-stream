import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { PaywalledRTCConsumer } from "@nickthelegend/webrtc-payment-sdk-core";
import { createConsumerRail, hasDemoKey, isConfigured } from "../lib/casper";
import { PaymentConsent } from "../components/PaymentConsent";
import { StreamViewer } from "../components/StreamViewer";

const SIGNALING_URL =
  process.env.NEXT_PUBLIC_SIGNALING_URL ?? "ws://localhost:3001";
const SEGMENT_SECONDS = 5;

export default function ConsumerViewer() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const consumerRef = useRef<PaywalledRTCConsumer | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // env-backed rail/signer bundle (stable across renders)
  const bundle = useMemo(() => createConsumerRail(), []);

  const [room, setRoom] = useState("");
  const [phase, setPhase] = useState<"consent" | "watching">("consent");
  const [paid, setPaid] = useState("0");
  const [watching, setWatching] = useState(0);
  const [suspended, setSuspended] = useState(false);
  const [pricePerSecond, setPricePerSecond] = useState("—");
  const [error, setError] = useState<string>();
  const [settlements, setSettlements] = useState<{ idx: number; txHash: string }[]>([]);

  useEffect(() => {
    if (router.isReady && typeof router.query.room === "string") {
      setRoom(router.query.room);
    }
  }, [router.isReady, router.query.room]);

  useEffect(() => {
    return () => {
      consumerRef.current?.disconnect();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const start = async ({ maxSpend }: { maxSpend: string }) => {
    setError(undefined);
    if (!room) {
      setError("No room — paste a stream link or add ?room=… to the URL");
      return;
    }
    try {
      const consumer = new PaywalledRTCConsumer({
        paymentRail: bundle.rail,
        signalingServerUrl: SIGNALING_URL,
        walletAddress: bundle.walletAddress,
        signFn: bundle.signFn,
      });
      consumerRef.current = consumer;

      consumer.on("stream:started", (stream) => {
        if (videoRef.current) videoRef.current.srcObject = stream;
        setSuspended(false);
        timerRef.current = setInterval(() => setWatching((s) => s + 1), 1000);
      });
      consumer.on("stream:paused", () => setSuspended(true));
      consumer.on("stream:resumed", () => setSuspended(false));
      consumer.on("payment:sent", (amount, segmentIndex) => {
        console.log(`[consumer] 💸 paid segment ${segmentIndex} — ${amount}`);
        setPaid(consumer.totalSpentMotes());
        const perSec = Number(amount) / SEGMENT_SECONDS;
        if (perSec > 0) setPricePerSecond(String(perSec));
      });
      consumer.on("payment:confirmed", (segmentIndex, txHash) => {
        if (!txHash) return;
        console.log(
          `[consumer] ⛓ segment ${segmentIndex} settled on-chain → https://testnet.cspr.live/transaction/${txHash}`,
        );
        setSettlements((s) => [{ idx: segmentIndex, txHash }, ...s].slice(0, 25));
      });
      consumer.on("error", (e) => {
        console.error("[consumer] error:", e);
        setError(e.message);
      });

      const maxMotes = BigInt(Math.round(Number(maxSpend) * 1e9)).toString();
      consumer.enableAutoPayment({
        maxTotalSpend: maxMotes,
        onMaxReached: () => setSuspended(true),
      });

      setPhase("watching");
      await consumer.joinStream(`${SIGNALING_URL}?room=${room}`);
    } catch (err) {
      console.error("[consumer] start/join failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setPhase("consent");
    }
  };

  return (
    <>
      <Head>
        <title>casper-webrtc-stream · Watch</title>
      </Head>
      <main className="min-h-screen p-6 max-w-2xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold">
            👻 casper-webrtc-stream
            <span className="text-gray-500 font-normal"> · Watch Live</span>
          </h1>
          {hasDemoKey() && (
            <span className="text-xs rounded-full border border-casper-gold/40 text-casper-gold px-3 py-1">
              demo hot-key — insecure
            </span>
          )}
        </header>

        {!isConfigured() && phase === "consent" && (
          <p className="mb-4 text-center text-sm text-casper-accent">
            ⚠ Not configured — set NEXT_PUBLIC_CEP18_TOKEN_CONTRACT and
            NEXT_PUBLIC_CONSUMER_ACCOUNT_HASH in .env.local. See STATUS.md.
          </p>
        )}

        {phase === "consent" && (
          <>
            {!room && (
              <div className="max-w-md mx-auto mb-4">
                <label className="block text-sm">
                  <span className="text-gray-400">Stream link or room id</span>
                  <input
                    value={room}
                    onChange={(e) => {
                      const v = e.target.value;
                      const m = v.match(/room=([^&]+)/);
                      setRoom(m ? m[1] : v);
                    }}
                    placeholder="paste link from the provider…"
                    className="mt-1 w-full rounded bg-casper-bg border border-casper-border px-3 py-2 mono"
                  />
                </label>
              </div>
            )}
            <PaymentConsent
              pricePerSecond={pricePerSecond}
              providerHint={room || "unknown"}
              walletAddress={bundle.walletAddress}
              onStart={start}
            />
          </>
        )}

        {phase === "watching" && (
          <StreamViewer
            ref={videoRef}
            paid={paid}
            watching={watching}
            suspended={suspended}
          />
        )}

        {phase === "watching" && settlements.length > 0 && (
          <div className="mt-4 rounded-lg border border-casper-border bg-black/30 p-4">
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

        {error && (
          <p className="mt-4 text-center text-sm text-casper-accent">{error}</p>
        )}
      </main>
    </>
  );
}
