import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  async rewrites() {
    return [
      { source: "/masuk", destination: "/auth/masuk" },
      { source: "/daftar", destination: "/auth/daftar" },
      { source: "/atur-ulang-sandi", destination: "/auth/atur-ulang-sandi" },
    ];
  },
};

export default nextConfig;
