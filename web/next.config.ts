import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "194.164.245.107", port: "9000" },
    ],
  },
};

export default config;
