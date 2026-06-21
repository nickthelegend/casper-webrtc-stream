/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@nickthelegend/webrtc-payment-sdk-core",
    "@nickthelegend/webrtc-payment-rail-x402",
  ],
};

module.exports = nextConfig;
