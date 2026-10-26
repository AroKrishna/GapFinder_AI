import type { NextConfig } from "next";

// Cache Components is intentionally off: every app page is per-user and reads the
// Supabase session cookie, so the classic request-time rendering model is simpler.
const nextConfig: NextConfig = {
  serverExternalPackages: ["unpdf"],
  // The topic map now lives inside Topic Gaps; keep old links working.
  async redirects() {
    return [{ source: "/w/:wid/topics", destination: "/w/:wid/gaps", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
