import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse v2 and its pdfjs-dist dependency are ESM-only packages.
  // They must run in Node.js directly — not bundled by Turbopack/webpack.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],

  experimental: {
    serverActions: {
      // Allow large Excel payroll files up to 10MB to be uploaded via Server Actions.
      // Default Next.js limit is 1MB — payroll XLSX files can be several MB.
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
