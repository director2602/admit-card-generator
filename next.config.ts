import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / heavy server-only packages are loaded from node_modules at runtime.
  serverExternalPackages: ["puppeteer-core", "pg", "archiver", "jszip", "pdf-lib", "bwip-js", "bcryptjs", "qrcode", "@aws-sdk/client-s3"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
