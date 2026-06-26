import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { PaywalledRTCConsumer } from "@nickthelegend69/webrtc-payment-sdk-core";
import { createConsumerRail, hasDemoKey, isConfigured } from "../lib/casper";
import { PaymentConsent } from "../components/PaymentConsent";
import { StreamViewer } from "../components/StreamViewer";
import { useCsprClick, makeWalletBuildPayment } from "../lib/csprclick";

const SIGNALING_URL =
  process.env.NEXT_PUBLIC_SIGNALING_URL ?? "ws://localhost:3001";
const SEGMENT_SECONDS = 5;

/** Show the real demo wallet as account-hash 8…6, full value on hover. */
function shortAddr(addr: string): string {
  const h = addr.replace(/^account-hash-/, "").replace(/^00/, "");
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

export default function ConsumerViewer() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const consumerRef = useRef<PaywalledRTCConsumer | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // env-backed rail/signer bundle (stable across renders)
  const bundle = useMemo(() => createConsumerRail(), []);

  // Real Casper wallet via CSPR.click (null until the user connects one).
  const { ready: walletReady, account: wallet, connect, disconnect } = useCsprClick();

  // DEV: call window.__casperTestSign() in the console to test browser signing
  // in isolation (proves the rail can sign a payment without the WebRTC flow).
  useEffect(() => {
    (window as unknown as { __casperTestSign: () => Promise<unknown> }).__casperTestSign =
      async () => {
        try {
          const req = {
            network: "casper:casper-test",
            scheme: "exact",
            asset: process.env.NEXT_PUBLIC_CEP18_TOKEN_CONTRACT ?? "",
            amount: "1000",
            payTo: "account-hash-" + "22".repeat(32),
            description: "test",
            sessionId: "test",
            nonce: "ab".repeat(32),
          };
          const payload = await bundle.rail.buildPayload(
            req as Parameters<typeof bundle.rail.buildPayload>[0],
            bundle.signFn,
          );
          return {
            ok: true,
            sig: payload.payload.signature.slice(0, 24),
            from: payload.payload.authorization.from.slice(0, 16),
            pubkey: payload.payload.publicKey.slice(0, 10),
          };
        } catch (e) {
          return { ok: false, error: String((e as Error)?.message ?? e) };
        }
      };
  }, [bundle]);

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
      // If a Casper wallet is connected, it signs each payment (the wallet
      // hashes the EIP-712 typed data itself). Otherwise fall back to the demo
      // hot key. The provider/facilitator path is identical either way.
      const consumer = new PaywalledRTCConsumer({
        paymentRail: bundle.rail,
        signalingServerUrl: SIGNALING_URL,
        walletAddress: wallet ? wallet.accountHash : bundle.walletAddress,
        signFn: bundle.signFn,
        buildPayment: wallet ? makeWalletBuildPayment(wallet) : undefined,
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
        <title>Casper Stream · Watch Live</title>
      </Head>
      <main className="mx-auto min-h-screen max-w-3xl px-5 py-7">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-casper-violet to-casper-indigo text-xl shadow-glow">
              👻
            </div>
            <div>
              <h1 className="font-display text-xl font-bold leading-none">
                <span className="text-gradient">Casper Stream</span>
                <span className="ml-2 align-middle text-xs font-medium text-casper-muted">
                  Watch Live
                </span>
              </h1>
              <p className="mt-1 text-xs text-casper-muted">
                You pay per second — each segment settles on Casper before it plays
              </p>
            </div>
          </div>
          {(() => {
            const addr = wallet ? wallet.accountHash : bundle.walletAddress;
            if (!addr) return null;
            const label = wallet ? "wallet" : "demo key";
            return (
              <a
                href={`https://testnet.cspr.live/account/${
                  wallet ? wallet.publicKey : bundle.publicKeyHex || addr.replace(/^account-hash-/, "")
                }`}
                target="_blank"
                rel="noreferrer"
                title={addr}
                className="flex items-center gap-2 rounded-full border border-casper-green/25 bg-casper-green/[0.06] px-3 py-1.5 text-xs font-medium text-casper-green transition hover:bg-casper-green/[0.12]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-casper-green" />
                <span className="font-mono">{shortAddr(addr)}</span>
                <span className="text-casper-green/50">· {label} ↗</span>
              </a>
            );
          })()}
        </header>

        {!isConfigured() && phase === "consent" && (
          <div className="mx-auto mb-4 max-w-md rounded-xl border border-casper-accent/30 bg-casper-accent/[0.06] px-4 py-3 text-center text-sm text-casper-accent">
            ⚠ Not configured — set NEXT_PUBLIC_CEP18_TOKEN_CONTRACT and
            NEXT_PUBLIC_CONSUMER_ACCOUNT_HASH in .env.local. See STATUS.md.
          </div>
        )}

        {phase === "consent" && (
          <>
            {!room && (
              <div className="mx-auto mb-4 max-w-md">
                <label className="block">
                  <span className="text-xs text-casper-muted">Stream link or room id</span>
                  <input
                    value={room}
                    onChange={(e) => {
                      const v = e.target.value;
                      const m = v.match(/room=([^&]+)/);
                      setRoom(m ? m[1] : v);
                    }}
                    placeholder="paste the link from the provider…"
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-sm text-casper-ghost outline-none focus:border-casper-violet/60"
                  />
                </label>
              </div>
            )}
            <PaymentConsent
              pricePerSecond={pricePerSecond}
              providerHint={room || "unknown"}
              walletAccount={wallet}
              walletReady={walletReady}
              demoAvailable={hasDemoKey()}
              onConnect={connect}
              onDisconnect={disconnect}
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

        {phase === "watching" && (
          <div className="glass mt-4 rounded-2xl p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-casper-muted">
                <span className="text-casper-green">⛓</span> Your on-chain payments
              </span>
              <span className="rounded-full bg-casper-green/10 px-2 py-0.5 font-mono text-xs text-casper-green">
                {settlements.length}
              </span>
            </div>
            {settlements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-sm text-casper-muted">
                Settlements will appear here as you pay per segment
              </div>
            ) : (
              <ul className="max-h-56 space-y-1.5 overflow-auto pr-1">
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
        )}

        {error && (
          <div className="mx-auto mt-4 max-w-md rounded-xl border border-casper-accent/30 bg-casper-accent/[0.06] px-4 py-3 text-center text-sm text-casper-accent">
            {error}
          </div>
        )}

        <footer className="mt-10 text-center text-xs text-casper-muted">
          Casper Agentic Buildathon 2026 · powered by x402 micropayments
        </footer>
      </main>
    </>
  );
}
