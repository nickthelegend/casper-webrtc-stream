/**
 * CSPR.click integration (global client, loaded from the CDN).
 *
 * Loads the CSPR.click client, exposes a React hook that tracks the connected
 * account, and turns the connected wallet into an x402 `buildPayment` the SDK
 * consumer can use (the wallet signs the EIP-712 typed data itself).
 *
 * Docs: https://docs.cspr.click — events: csprclick:loaded / :signed_in /
 * :switched_account / :disconnected; methods: signIn(), getActiveAccount(),
 * disconnect(), signTypedData().
 */
import { useCallback, useEffect, useState } from "react";
import type { PaymentPayload, PaymentRequirements } from "@nickthelegend69/webrtc-payment-sdk-core";
import { accountHashFromPublicKey } from "@nickthelegend69/webrtc-payment-rail-x402";
import { signX402PaymentWithCsprClick } from "./csprclick-signer";

const APP_ID =
  process.env.NEXT_PUBLIC_CSPR_CLICK_APP_ID ?? "522f151c-54a5-46d3-be0e-dbd4321a";
const CLIENT_SRC = "https://cdn.cspr.click/ui/v2.1.0/csprclick-client-2.1.0.js";

interface CsprClickAccount {
  public_key: string | null;
  provider?: string;
}
interface CsprClick {
  on(event: string, cb: (evt: { account?: CsprClickAccount }) => void): void;
  off?(event: string, cb: (evt: { account?: CsprClickAccount }) => void): void;
  signIn(): void;
  disconnect(from?: string, options?: unknown): void;
  getActiveAccount?(): CsprClickAccount | null;
}
declare global {
  interface Window {
    csprclick?: CsprClick;
    clickSDKOptions?: unknown;
    __csprclickLoading?: boolean;
  }
}

export interface WalletAccount {
  publicKey: string;
  accountHash: string;
}

/** Inject the CSPR.click client once (idempotent, client-side only). */
export function ensureCsprClick(): void {
  if (typeof window === "undefined") return;
  if (!window.clickSDKOptions) {
    window.clickSDKOptions = {
      appName: "Casper Stream",
      appId: APP_ID,
      contentMode: "iframe",
      providers: ["casper-wallet", "ledger", "metamask-snap"],
    };
  }
  if (window.csprclick || window.__csprclickLoading) return;
  if (document.querySelector(`script[src="${CLIENT_SRC}"]`)) return;
  window.__csprclickLoading = true;
  const s = document.createElement("script");
  s.src = CLIENT_SRC;
  s.async = true;
  document.head.appendChild(s);
}

function toAccount(a: CsprClickAccount | null | undefined): WalletAccount | null {
  if (!a || !a.public_key) return null;
  try {
    return { publicKey: a.public_key, accountHash: accountHashFromPublicKey(a.public_key) };
  } catch {
    return null;
  }
}

/** React hook: tracks the connected CSPR.click account + connect/disconnect. */
export function useCsprClick() {
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<WalletAccount | null>(null);

  useEffect(() => {
    ensureCsprClick();
    let click: CsprClick | undefined;
    const onSignedIn = (evt: { account?: CsprClickAccount }) => setAccount(toAccount(evt?.account));
    const onSwitched = (evt: { account?: CsprClickAccount }) => setAccount(toAccount(evt?.account));
    const onDisconnected = () => setAccount(null);

    const attach = () => {
      click = window.csprclick;
      if (!click) return;
      setReady(true);
      setAccount(toAccount(click.getActiveAccount?.()));
      click.on("csprclick:signed_in", onSignedIn);
      click.on("csprclick:switched_account", onSwitched);
      click.on("csprclick:disconnected", onDisconnected);
    };

    if (window.csprclick) attach();
    else window.addEventListener("csprclick:loaded", attach, { once: true });

    return () => {
      window.removeEventListener("csprclick:loaded", attach);
      if (click?.off) {
        click.off("csprclick:signed_in", onSignedIn);
        click.off("csprclick:switched_account", onSwitched);
        click.off("csprclick:disconnected", onDisconnected);
      }
    };
  }, []);

  const connect = useCallback(() => window.csprclick?.signIn(), []);
  const disconnect = useCallback(() => {
    try {
      window.csprclick?.disconnect();
    } catch {
      /* ignore */
    }
    setAccount(null);
  }, []);

  return { ready, account, connect, disconnect };
}

/**
 * Build an x402 `buildPayment` override backed by the connected wallet. The
 * wallet signs the EIP-712 typed data and we return a full PaymentPayload.
 */
export function makeWalletBuildPayment(account: WalletAccount) {
  return (requirements: PaymentRequirements): Promise<PaymentPayload> =>
    signX402PaymentWithCsprClick({
      requirements,
      publicKeyHex: account.publicKey,
      accountHash: account.accountHash,
      maxTimeoutSeconds: 300,
    });
}
