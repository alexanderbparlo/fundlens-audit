// Applies a SQL migration file against the Neon database in DATABASE_URL.
// Usage: node scripts/apply-migration.mjs migrations/<file>.sql
// Reads DATABASE_URL from .env.local if not already set.
import { neon } from '@neondatabase/serverless'
import { readFileSync, existsSync } from 'node:fs'

if (!process.env.DATABASE_URL && existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^DATABASE_URL=["']?([^"']+)["']?\s*$/)
    if (m) process.env.DATABASE_URL = m[1]
  }
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set and not found in .env.local')
  process.exit(1)
}

const file = process.argv[2]
if (!file) {
  console.error('Usage: node scripts/apply-migration.mjs <migration.sql>')
  process.exit(1)
}

const sql = neon(process.env.DATABASE_URL)
const statements = readFileSync(file, 'utf8')
  .split(';')
  .map(s => s.replace(/--[^\n]*/g, '').trim())
  .filter(Boolean)

for (const stmt of statements) {
  console.log(`Applying: ${stmt.slice(0, 80)}...`)
  await sql.query(stmt)
}
console.log(`Applied ${statements.length} statement(s) from ${file}`)
