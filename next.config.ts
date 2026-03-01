import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Allow large Excel payroll files up to 10MB to be uploaded via Server Actions.
      // Default Next.js limit is 1MB — payroll XLSX files can be several MB.
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
