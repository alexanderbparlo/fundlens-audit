import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // PDFs are fetched from Vercel Blob server-side — no client body size issue.
  // Individual API route timeouts are set per-route via `export const maxDuration`.
  serverExternalPackages: ['@neondatabase/serverless'],
}

export default nextConfig
