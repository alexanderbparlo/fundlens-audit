// Generates a synthetic, compliance-safe fund-document corpus for testing the
// FundLens Audit pipeline. All entities, people, and figures are fictional.
//
// Each fund module (samples/funds/*.mjs) is one engagement covering a fund type
// (PE / VC / HF / Credit / RealEstate) and carries ONE deliberately seeded
// discrepancy as ground truth — see samples/README.md.
//
// Usage:
//   node samples/generate.mjs            # generate all engagements
//   node samples/generate.mjs vc         # only the VC engagement (by fundType)
//   node samples/generate.mjs hadrian    # filter by slug substring

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import pe from './funds/pe.mjs'
import vc from './funds/vc.mjs'
import hf from './funds/hf.mjs'
import credit from './funds/credit.mjs'
import realestate from './funds/realestate.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const FUNDS = [pe, vc, hf, credit, realestate]

const filter = (process.argv[2] ?? '').toLowerCase()
const selected = filter
  ? FUNDS.filter(f => f.fundType.toLowerCase() === filter || f.slug.includes(filter))
  : FUNDS

if (selected.length === 0) {
  console.error(`No fund matched "${filter}". Available: ${FUNDS.map(f => f.fundType).join(', ')}`)
  process.exit(1)
}

let total = 0
for (const fund of selected) {
  const dir = join(HERE, fund.slug)
  mkdirSync(dir, { recursive: true })
  console.log(`\n${fund.fundType} — ${fund.name}`)
  for (const [name, buf] of fund.build()) {
    writeFileSync(join(dir, name), buf)
    console.log(`  wrote ${fund.slug}/${name} (${(buf.length / 1024).toFixed(1)} KB)`)
    total += 1
  }
  console.log(`  seeded: ${fund.seeded}`)
}
console.log(`\nDone. ${total} documents across ${selected.length} engagement(s).`)
