import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set.')
}

// Neon serverless driver — creates a new connection per invocation.
// Safe for Vercel serverless functions; no connection pool needed for HTTP.
export const sql = neon(process.env.DATABASE_URL)
