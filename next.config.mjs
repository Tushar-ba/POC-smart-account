/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Suppress warnings from MetaMask SDK and WalletConnect dependencies
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "pino-pretty": false,
    };
    config.externals.push("@react-native-async-storage/async-storage");
    return config;
  },
};

export default nextConfig;
