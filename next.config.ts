import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // envio de várias fotos de entrada de uma vez
    serverActions: { bodySizeLimit: "30mb" },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
