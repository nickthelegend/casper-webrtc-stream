/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // compile the workspace SDK packages (shipped as TS source)
  transpilePackages: [
    "@nickthelegend/webrtc-payment-sdk-core",
    "@nickthelegend/webrtc-payment-rail-x402",
  ],
};

module.exports = nextConfig;
