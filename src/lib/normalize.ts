import type { PreparerOutput, StatementLineItem } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Sign normalization — round-2 prerequisite for the verification layer.
//
// Round-2 root cause: the profiler captures flows as displayed (a distribution
// shown as "(10,100)" extracts as −10,100), and the bridge formula then applies
// its own sign ("− distributions"), double-counting the flow. This appeared as
// a 2×-flow variance in all four round-2 NAV bridges.
//
// Fix: every flow is normalized at the extraction→verification boundary to
// magnitude + explicit direction. Reconciliation formulas operate on direction,
// never on a raw signed value. Fields whose direction is semantically fixed
// (contributions are inflows, distributions and fees are outflows) take their
// direction from the field — the extracted sign is discarded via Math.abs and
// can never double-count. Gain/loss fields keep their sign: negative means a
// loss, which is meaningful, so they are classified 'signed' and the C1
// guardrail (validations.ts) covers residual sign artifacts on them.
// ─────────────────────────────────────────────────────────────────────────────

export type FlowConvention = 'inflow' | 'outflow' | 'signed'

export interface NormalizedFlow {
  label: string
  amount: number                    // magnitude — always ≥ 0
  direction: 'inflow' | 'outflow'
  effect: number                    // signed contribution to a bridge: +amount | −amount
  raw: number                       // value as extracted, retained for audit trail
  convention: FlowConvention        // how direction was determined
}

export function normalizeFlow(label: string, raw: number, convention: FlowConvention): NormalizedFlow {
  const amount = Math.abs(raw)
  if (convention === 'signed') {
    // Direction follows the extracted sign; effect is the raw value.
    return { label, amount, direction: raw >= 0 ? 'inflow' : 'outflow', effect: raw, raw, convention }
  }
  return {
    label,
    amount,
    direction: convention,
    effect: convention === 'inflow' ? amount : -amount,
    raw,
    convention,
  }
}

// ── Label-based classification for generic rollforward flows ─────────────────
// Rollforward tables carry arbitrary row labels; direction is inferred from
// fund-accounting vocabulary. Outflow/inflow keywords are checked before the
// signed fallback so "return of capital" classifies as outflow even when the
// document prints it unsigned.

const OUTFLOW_PATTERNS = [
  /distribut/i, /redempt/i, /withdraw/i, /return of capital/i, /sales?\b/i,
  /disposal/i, /repaid|repayment/i, /fees?\b/i, /expense/i, /transfers? out/i,
]

const INFLOW_PATTERNS = [
  /contribut/i, /subscript/i, /capital call/i, /calls?\b/i, /drawdown/i,
  /purchas/i, /acquisit/i, /additions?\b/i, /transfers? in/i,
]

const SIGNED_PATTERNS = [
  /gain|loss/i, /apprec|deprec/i, /income/i, /p&l/i, /change in/i,
  /unrealized|realized/i, /mark[- ]to[- ]market/i, /revaluat/i, /other/i,
]

export function classifyFlowLabel(label: string): FlowConvention {
  // Signed patterns win first: "net realized gain on sales" is a P&L line,
  // not a sale outflow.
  if (SIGNED_PATTERNS.some(p => p.test(label))) return 'signed'
  if (OUTFLOW_PATTERNS.some(p => p.test(label))) return 'outflow'
  if (INFLOW_PATTERNS.some(p => p.test(label))) return 'inflow'
  return 'signed'
}

export function normalizeRollforwardFlows(flows: StatementLineItem[]): NormalizedFlow[] {
  return flows.map(f => normalizeFlow(f.label, f.amount, classifyFlowLabel(f.label)))
}

// ── NAV bridge normalization ──────────────────────────────────────────────────

export interface NormalizedBridge {
  periodLabel: string | null
  beginningNav: number
  statedEndingNav: number
  flows: NormalizedFlow[]           // only components actually disclosed
  missingComponents: string[]       // disclosed-as-null components, treated as zero
  computedEndingNav: number
}

export function normalizeNavBridge(nb: NonNullable<PreparerOutput['navBridge']>): NormalizedBridge | null {
  if (nb.beginningNav == null || nb.endingNav == null) return null

  const componentConventions: { key: keyof typeof nb; label: string; convention: FlowConvention }[] = [
    { key: 'contributions',      label: 'contributions',        convention: 'inflow' },
    { key: 'distributions',      label: 'distributions',        convention: 'outflow' },
    { key: 'realizedGainLoss',   label: 'realized gain/loss',   convention: 'signed' },
    { key: 'unrealizedGainLoss', label: 'unrealized gain/loss', convention: 'signed' },
    { key: 'feesAndExpenses',    label: 'fees and expenses',    convention: 'outflow' },
    { key: 'otherChanges',       label: 'other changes',        convention: 'signed' },
  ]

  const flows: NormalizedFlow[] = []
  const missingComponents: string[] = []
  for (const c of componentConventions) {
    const raw = nb[c.key] as number | null
    if (raw == null) {
      missingComponents.push(c.label)
      continue
    }
    flows.push(normalizeFlow(c.label, raw, c.convention))
  }

  const computedEndingNav = flows.reduce((acc, f) => acc + f.effect, nb.beginningNav)

  return {
    periodLabel: nb.periodLabel,
    beginningNav: nb.beginningNav,
    statedEndingNav: nb.endingNav,
    flows,
    missingComponents,
    computedEndingNav,
  }
}
