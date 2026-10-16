import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Baseline browser protections on every response (HTTPS itself is already forced by Vercel).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), payment=()" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // Server Actions default to a 1MB request body limit, which rejects
      // photo uploads with a raw framework-level 413 before uploadImage.ts's
      // own 5MB check ever runs. Set just above that check so our friendly
      // validation message fires first for genuinely oversized files.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
