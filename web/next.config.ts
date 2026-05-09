import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "2.26.53.128", port: "9000" },
    ],
  },
};

export default config;
