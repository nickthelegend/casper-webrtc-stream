import { useEffect } from "react";
import type { AppProps } from "next/app";
import "../styles/globals.css";
import { ensureCsprClick } from "../lib/csprclick";

export default function App({ Component, pageProps }: AppProps) {
  // Load the CSPR.click client as early as possible so the wallet is ready.
  useEffect(() => {
    ensureCsprClick();
  }, []);
  return <Component {...pageProps} />;
}
