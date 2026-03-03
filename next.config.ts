import type { NextConfig } from "next"

const isDev = process.env.NODE_ENV === 'development'

// Supabase URL needed in CSP for connect-src (API calls) and img-src (Storage).
// This is a NEXT_PUBLIC_ var — available at build time, not a secret.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

// Static CSP — no nonces (avoids forcing all pages to dynamic rendering).
// 'unsafe-inline' for script-src: Next.js injects inline scripts for hydration.
// 'unsafe-inline' for style-src: Tailwind v4 + shadcn/ui inject inline styles.
// 'unsafe-eval' in dev only: needed for React Fast Refresh / Turbopack HMR.
// NOTE: No fonts.googleapis.com or fonts.gstatic.com — Heebo is served locally
// via next/font/google (verified in src/app/layout.tsx). font-src 'self' is sufficient.
const cspHeader = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseUrl} wss://*.supabase.co https://*.tile.openstreetmap.org`,
  `img-src 'self' blob: data: ${supabaseUrl} https://*.tile.openstreetmap.org`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join('; ')

const nextConfig: NextConfig = {
  // pdf-parse v2 and its pdfjs-dist dependency are ESM-only packages.
  // They must run in Node.js directly — not bundled by Turbopack/webpack.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Clickjacking protection — both X-Frame-Options (legacy) and CSP
          // frame-ancestors (modern) are set for full browser coverage.
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevent MIME-type sniffing — enforces declared Content-Type.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Send origin only on cross-origin requests, no referrer on downgrade.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Disable camera/mic/geolocation — admin panel has no need for them.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // HSTS only in production — local dev uses HTTP, HSTS would break it.
          ...(isDev ? [] : [{
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          }]),
          // CSP — restricts resource loading to 'self' + Supabase.
          // See cspHeader constant above for directive details.
          { key: 'Content-Security-Policy', value: cspHeader },
        ],
      },
    ]
  },

  experimental: {
    serverActions: {
      // Allow large Excel payroll files up to 10MB to be uploaded via Server Actions.
      // Default Next.js limit is 1MB — payroll XLSX files can be several MB.
      bodySizeLimit: '10mb',
      // TODO: fill allowedOrigins with Vercel domain before production go-live
      // allowedOrigins: ['chemosystem.vercel.app'],
    },
  },
}

export default nextConfig
