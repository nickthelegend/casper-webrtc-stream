/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // compile the workspace SDK packages (shipped as TS source)
  transpilePackages: [
    "@nickthelegend69/webrtc-payment-sdk-core",
    "@nickthelegend69/webrtc-payment-rail-x402",
  ],
  webpack: (config) => {
    // the SDK uses NodeNext-style `.js` import specifiers in its TS source;
    // let webpack resolve those to the actual `.ts` files when transpiling.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

module.exports = nextConfig;
