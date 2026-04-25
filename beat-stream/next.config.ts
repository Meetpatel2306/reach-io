import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.saavncdn.com" },
      { protocol: "https", hostname: "**.jiosaavn.com" },
    ],
  },
};

export default nextConfig;
