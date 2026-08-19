import type { NextConfig } from "next";

const privateNoStoreHeaders = [
  {
    key: "Cache-Control",
    value: "private, no-store, max-age=0, must-revalidate",
  },
  { key: "Pragma", value: "no-cache" },
  { key: "Expires", value: "0" },
  { key: "X-Content-Type-Options", value: "nosniff" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/api/voice/:path*",
        headers: privateNoStoreHeaders,
      },
      {
        source: "/api/telemetry/:path*",
        headers: privateNoStoreHeaders,
      },
      {
        source: "/api/metrics/:path*",
        headers: privateNoStoreHeaders,
      },
    ];
  },
};

export default nextConfig;
