/**
 * Client for the paid API. `wrapFetch` makes the 402 invisible: it pays the
 * Casper micropayment and retries automatically. This is all an app needs to
 * consume a paid x402 endpoint.
 */
import { CasperX402Rail, makeEd25519SignFn } from "@nickthelegend69/webrtc-payment-rail-x402";
import { wrapFetch, X402_TX_HEADER } from "@nickthelegend69/webrtc-payment-sdk-core";

const E = process.env;
const token = {
  name: E.CEP18_TOKEN_NAME,
  version: E.CEP18_TOKEN_VERSION,
  decimals: E.CEP18_TOKEN_DECIMALS,
  symbol: E.CEP18_TOKEN_SYMBOL,
};

const rail = new CasperX402Rail({
  facilitatorUrl: E.X402_FACILITATOR_URL ?? "https://x402-facilitator.cspr.cloud",
  network: "casper:casper-test",
  tokenContractHash: E.NEXT_PUBLIC_CEP18_TOKEN_CONTRACT ?? E.CEP18_TOKEN_CONTRACT,
  token,
  consumerAccountHash: E.NEXT_PUBLIC_CONSUMER_ACCOUNT_HASH,
  consumerPublicKeyHex: E.NEXT_PUBLIC_CONSUMER_PUBLIC_KEY,
});
const signFn = makeEd25519SignFn(E.NEXT_PUBLIC_CONSUMER_PRIVATE_KEY);

// One wrapped fetch — every 402 from here on is paid + retried.
const pay = wrapFetch(fetch, {
  rail,
  signFn,
  maxValue: "1000000000", // never auto-pay more than 1 token
  onPayment: (req) =>
    console.log(`← 402 Payment Required → signing + paying ${req.amount} base units…`),
});

const url = (E.API ?? "http://localhost:4021") + "/premium";
console.log("GET", url);
const res = await pay(url);
console.log("→ status:", res.status);
console.log("→ body:", await res.json());

const tx = res.headers.get(X402_TX_HEADER);
if (tx) {
  console.log("\n✅ settled on-chain:", tx);
  console.log("   https://testnet.cspr.live/deploy/" + tx);
}
