import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Behind Caddy /api is routed to the backend. Running `next dev` alone, set API_URL=http://localhost:8000.
  async rewrites() {
    return process.env.API_URL ? [{ source: "/api/:path*", destination: `${process.env.API_URL}/:path*` }] : [];
  },
};

export default nextConfig;
