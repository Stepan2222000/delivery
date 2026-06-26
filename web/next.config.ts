import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "s3.parts-everything.site" },
    ],
  },
};

export default config;
