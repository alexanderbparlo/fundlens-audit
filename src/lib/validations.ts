import type { PreparerOutput } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic validation engine — round-1 fix.
//
// Suite convention: the model never performs arithmetic. Round 1 produced an
// NAV-bridge false positive (liabilities ignored), a missed balance-sheet face
// check, and a missed $200K bridge gap because reconciliation math was done
// in-prompt. Every check here is computed in code from PreparerOutput and
// injected into the Reviewer/Challenger inputs as authoritative results the
// agents interpret but do not recompute.
// ─────────────────────────────────────────────────────────────────────────────

export type DeterministicStatus = 'pass' | 'fail' | 'unable_to_verify'

export interface DeterministicCheck {
  id: string
  check: string
  expected: string          // formula with substituted values
  found: string
  variance: string | null   // signed difference + percentage when computable
  status: DeterministicStatus
  note: string | null       // interpretation guidance for the agents
}

// Currency tolerance: covers presentation rounding (figures reported in
// thousands round to ±0.5 units) plus 1bp of the comparison base for large
// full-dollar figures. Deliberately tight — the $200K gap on a $284.7M NAV
// (7bp) must FAIL, not wash out.
function currencyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(1, 0.0001 * Math.abs(b))
}

// Ratio tolerance: stated multiples are printed to 2 decimal places and may be
// truncated rather than rounded, and component metrics round independently —
// so disagreement up to ~0.01 is presentation noise (round-1 example: stated
// TVPI 1.16x vs. computed 1.166x is clean). 0.015 catches real inconsistencies
// while ignoring rounding artifacts.
function ratioEqual(stated: number, computed: number): boolean {
  return Math.abs(stated - computed) <= 0.015
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function varianceOf(expected: number, found: number): string | null {
  const diff = found - expected
  if (diff === 0) return null
  const pct = expected !== 0 ? ` (${((diff / Math.abs(expected)) * 100).toFixed(3)}%)` : ''
  return `${diff > 0 ? '+' : ''}${fmt(diff)}${pct}`
}

export function runDeterministicChecks(p: PreparerOutput): DeterministicCheck[] {
  const checks: DeterministicCheck[] = []
  let seq = 0
  const add = (c: Omit<DeterministicCheck, 'id'>) => {
    seq += 1
    checks.push({ id: `D-${String(seq).padStart(3, '0')}`, ...c })
  }

  // ── 1. Capital structure: called + uncalled = committed ────────────────────
  if (p.calledCapital != null && p.uncalledCapital != null && p.totalCommittedCapital != null) {
    const sum = p.calledCapital + p.uncalledCapital
    add({
      check: 'Capital structure: called + uncalled = total committed',
      expected: `${fmt(p.calledCapital)} + ${fmt(p.uncalledCapital)} = ${fmt(sum)}`,
      found: `Total committed capital disclosed as ${fmt(p.totalCommittedCapital)}`,
      variance: varianceOf(sum, p.totalCommittedCapital),
      status: currencyEqual(sum, p.totalCommittedCapital) ? 'pass' : 'fail',
      note: null,
    })
  } else {
    add({
      check: 'Capital structure: called + uncalled = total committed',
      expected: 'calledCapital + uncalledCapital = totalCommittedCapital',
      found: 'One or more components not disclosed in the document set',
      variance: null,
      status: 'unable_to_verify',
      note: null,
    })
  }

  // ── 2. Balance sheet face: assets = liabilities + partners' capital ────────
  const bs = p.balanceSheet
  if (bs?.totalAssets != null && bs.totalLiabilities != null && bs.totalPartnersCapital != null) {
    const rhs = bs.totalLiabilities + bs.totalPartnersCapital
    add({
      check: "Balance sheet face: total assets = total liabilities + partners' capital",
      expected: `${fmt(bs.totalLiabilities)} + ${fmt(bs.totalPartnersCapital)} = ${fmt(rhs)}`,
      found: `Total assets disclosed as ${fmt(bs.totalAssets)}`,
      variance: varianceOf(rhs, bs.totalAssets),
      status: currencyEqual(rhs, bs.totalAssets) ? 'pass' : 'fail',
      note: null,
    })
  } else {
    add({
      check: "Balance sheet face: total assets = total liabilities + partners' capital",
      expected: 'totalAssets = totalLiabilities + totalPartnersCapital',
      found: 'Balance sheet totals not extracted from the document set',
      variance: null,
      status: 'unable_to_verify',
      note: 'If a balance sheet / statement of assets and liabilities was provided, this is an extraction gap, not a document deficiency.',
    })
  }

  // ── 3. NAV vs. sum of LP capital accounts ──────────────────────────────────
  if (p.nav && p.capitalAccounts.length > 0) {
    const sum = p.capitalAccounts.reduce((acc, ca) => acc + ca.endingBalance, 0)
    add({
      check: 'Total NAV equals sum of LP ending capital account balances',
      expected: `Sum of ${p.capitalAccounts.length} LP ending balances = ${fmt(sum)}`,
      found: `Total NAV disclosed as ${fmt(p.nav.total)}`,
      variance: varianceOf(sum, p.nav.total),
      status: currencyEqual(sum, p.nav.total) ? 'pass' : 'fail',
      note: 'A variance can be legitimate if the capital account statement covers a subset of LPs — confirm coverage before treating a fail as a finding.',
    })
  }

  // ── 4. Per-LP capital account rollforward ──────────────────────────────────
  for (const ca of p.capitalAccounts) {
    if (ca.beginningBalance == null) continue
    const computed = ca.beginningBalance + ca.contributions + ca.allocatedIncomeLoss - ca.distributions
    add({
      check: `LP capital rollforward (${ca.lpId}): beginning + contributions + allocated income/loss − distributions = ending`,
      expected: `${fmt(ca.beginningBalance)} + ${fmt(ca.contributions)} + ${fmt(ca.allocatedIncomeLoss)} − ${fmt(ca.distributions)} = ${fmt(computed)}`,
      found: `Ending balance disclosed as ${fmt(ca.endingBalance)}`,
      variance: varianceOf(computed, ca.endingBalance),
      status: currencyEqual(computed, ca.endingBalance) ? 'pass' : 'fail',
      note: 'Beginning balance is the value explicitly disclosed in the document, never inferred.',
    })
  }

  // ── 5. NAV bridge: period capital activity reconciliation ──────────────────
  const nb = p.navBridge
  if (nb?.beginningNav != null && nb.endingNav != null) {
    const contributions = nb.contributions ?? 0
    const distributions = nb.distributions ?? 0
    const realized = nb.realizedGainLoss ?? 0
    const unrealized = nb.unrealizedGainLoss ?? 0
    const fees = nb.feesAndExpenses ?? 0
    const other = nb.otherChanges ?? 0
    const computed = nb.beginningNav + contributions - distributions + realized + unrealized - fees + other
    const missing = (['contributions', 'distributions', 'realizedGainLoss', 'unrealizedGainLoss', 'feesAndExpenses', 'otherChanges'] as const)
      .filter(k => nb[k] == null)
    add({
      check: `NAV bridge${nb.periodLabel ? ` (${nb.periodLabel})` : ''}: beginning + contributions − distributions + realized + unrealized − fees + other = ending`,
      expected: `${fmt(nb.beginningNav)} + ${fmt(contributions)} − ${fmt(distributions)} + ${fmt(realized)} + ${fmt(unrealized)} − ${fmt(fees)} + ${fmt(other)} = ${fmt(computed)}`,
      found: `Ending NAV disclosed as ${fmt(nb.endingNav)}`,
      variance: varianceOf(computed, nb.endingNav),
      status: currencyEqual(computed, nb.endingNav) ? 'pass' : 'fail',
      note: missing.length > 0
        ? `Components not disclosed and treated as zero: ${missing.join(', ')}. A failure may reflect an undisclosed component (e.g. a change in liabilities) rather than an arithmetic error — frame accordingly.`
        : 'All bridge components were disclosed. A residual variance is an unexplained reconciling item.',
    })
  }

  // ── 6–9. Stated performance metrics ─────────────────────────────────────────
  const m = p.statedPerformanceMetrics
  if (m) {
    if (m.tvpi != null && m.dpi != null && m.rvpi != null) {
      const sum = m.dpi + m.rvpi
      add({
        check: 'Stated TVPI = stated DPI + stated RVPI',
        expected: `${m.dpi} + ${m.rvpi} = ${fmt(sum)}`,
        found: `Stated TVPI is ${m.tvpi}`,
        variance: varianceOf(sum, m.tvpi),
        status: ratioEqual(m.tvpi, sum) ? 'pass' : 'fail',
        note: 'Tolerance allows for rounding of independently rounded components.',
      })
    }
    if (m.dpi != null && m.cumulativeDistributions != null && p.calledCapital != null && p.calledCapital > 0) {
      const computed = m.cumulativeDistributions / p.calledCapital
      add({
        check: 'Stated DPI reconciles to cumulative distributions ÷ called capital',
        expected: `${fmt(m.cumulativeDistributions)} ÷ ${fmt(p.calledCapital)} = ${computed.toFixed(3)}`,
        found: `Stated DPI is ${m.dpi}`,
        variance: varianceOf(computed, m.dpi),
        status: ratioEqual(m.dpi, computed) ? 'pass' : 'fail',
        note: null,
      })
    }
    if (m.rvpi != null && p.nav && p.calledCapital != null && p.calledCapital > 0) {
      const computed = p.nav.total / p.calledCapital
      add({
        check: 'Stated RVPI reconciles to NAV ÷ called capital',
        expected: `${fmt(p.nav.total)} ÷ ${fmt(p.calledCapital)} = ${computed.toFixed(3)}`,
        found: `Stated RVPI is ${m.rvpi}`,
        variance: varianceOf(computed, m.rvpi),
        status: ratioEqual(m.rvpi, computed) ? 'pass' : 'fail',
        note: null,
      })
    }
    if (m.tvpi != null && m.cumulativeDistributions != null && p.nav && p.calledCapital != null && p.calledCapital > 0) {
      const computed = (p.nav.total + m.cumulativeDistributions) / p.calledCapital
      add({
        check: 'Stated TVPI reconciles to (NAV + cumulative distributions) ÷ called capital',
        expected: `(${fmt(p.nav.total)} + ${fmt(m.cumulativeDistributions)}) ÷ ${fmt(p.calledCapital)} = ${computed.toFixed(3)}`,
        found: `Stated TVPI is ${m.tvpi}`,
        variance: varianceOf(computed, m.tvpi),
        status: ratioEqual(m.tvpi, computed) ? 'pass' : 'fail',
        note: null,
      })
    }
  }

  // ── 10. Investment schedule vs. NAV (with cash/liabilities reconciliation) ──
  if (p.investments.length > 0 && p.nav) {
    const fvSum = p.investments.reduce((acc, inv) => acc + inv.fairValue, 0)
    if (bs && (bs.cashAndEquivalents != null || bs.totalLiabilities != null)) {
      const cash = bs.cashAndEquivalents ?? 0
      const liabilities = bs.totalLiabilities ?? 0
      const computed = fvSum + cash - liabilities
      add({
        check: 'Investments at fair value + cash − liabilities reconciles to total NAV',
        expected: `${fmt(fvSum)} + ${fmt(cash)} − ${fmt(liabilities)} = ${fmt(computed)}`,
        found: `Total NAV disclosed as ${fmt(p.nav.total)}`,
        variance: varianceOf(computed, p.nav.total),
        status: currencyEqual(computed, p.nav.total) ? 'pass' : 'fail',
        note: 'Other assets/receivables not captured in the extraction can explain a small residual — interpret a fail in that light before asserting an error.',
      })
    } else {
      const v = varianceOf(fvSum, p.nav.total)
      add({
        check: 'Sum of investment fair values vs. total NAV',
        expected: `Sum of ${p.investments.length} positions = ${fmt(fvSum)}`,
        found: `Total NAV disclosed as ${fmt(p.nav.total)}`,
        variance: v,
        status: 'unable_to_verify',
        note: 'Cash and liabilities were not extracted, so the difference between portfolio fair value and NAV cannot be attributed deterministically. Do NOT treat this variance as an error — it normally equals cash + other assets − liabilities.',
      })
    }
  }

  // ── 11. Workpaper sign-off date sequence ────────────────────────────────────
  for (const wp of p.workpaperMetadata) {
    if (!wp.preparedDate || !wp.reviewedDate) continue
    const ok = wp.reviewedDate >= wp.preparedDate  // ISO strings compare lexicographically
    add({
      check: `Workpaper sign-off sequence (${wp.documentName}): reviewed date must not precede prepared date`,
      expected: `Reviewed date ≥ prepared date (${wp.preparedDate})`,
      found: `Reviewed ${wp.reviewedDate}${wp.reviewedBy ? ` by ${wp.reviewedBy}` : ''}; prepared ${wp.preparedDate}${wp.preparedBy ? ` by ${wp.preparedBy}` : ''}`,
      variance: null,
      status: ok ? 'pass' : 'fail',
      note: ok ? null : 'A review sign-off dated before preparation indicates a workpaper control failure or a clerical date error.',
    })
  }

  // ── 12. NAV as-of date vs. fiscal year end ──────────────────────────────────
  if (p.nav) {
    add({
      check: 'NAV as-of date matches fiscal year end',
      expected: `Fiscal year end ${p.fiscalYearEnd}`,
      found: `NAV as of ${p.nav.asOfDate}`,
      variance: null,
      status: p.nav.asOfDate === p.fiscalYearEnd ? 'pass' : 'fail',
      note: 'A mismatch may be legitimate for interim/quarterly NAV statements — confirm document period before treating as a finding.',
    })
  }

  return checks
}

/**
 * Format deterministic results as a prompt block for the Reviewer/Challenger.
 * The agents interpret these results; they must not recompute or contradict them.
 */
export function formatChecksForPrompt(checks: DeterministicCheck[]): string {
  if (checks.length === 0) return ''
  const lines = checks.map(c => {
    const parts = [
      `${c.id} [${c.status.toUpperCase()}] ${c.check}`,
      `  Expected: ${c.expected}`,
      `  Found: ${c.found}`,
    ]
    if (c.variance) parts.push(`  Variance: ${c.variance}`)
    if (c.note) parts.push(`  Note: ${c.note}`)
    return parts.join('\n')
  })
  return `=== DETERMINISTIC VALIDATION RESULTS (computed by code — authoritative) ===
The following reconciliation checks were computed deterministically from the extracted data. These results are arithmetically authoritative:
- Do NOT recompute these checks or perform your own reconciliation arithmetic.
- Do NOT raise an arithmetic finding that contradicts a PASS result.
- For each FAIL, interpret its significance using the attached note and cite the check ID (e.g. D-003) in your finding.
- UNABLE_TO_VERIFY means the inputs were not extracted — phrase any related observation as an extraction/verification gap, not as a document deficiency.

${lines.join('\n\n')}
===`
}
