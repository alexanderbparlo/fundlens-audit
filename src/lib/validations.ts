import type {
  PreparerOutput, DocumentProfile,
  DeterministicCheck, DeterministicStatus, CheckFamily,
  VerificationResult, VerifiedFigure,
} from '@/types'
import { normalizeNavBridge, normalizeRollforwardFlows } from './normalize'
import type { NormalizedFlow } from './normalize'

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic verification layer — round-2 Workstream A.
//
// Runs in code immediately after extraction, before any LLM reasoning. The
// round-2 root cause was agents accepting an extracted figure as ground truth
// without footing, vouching, or recomputing it, then building the audit on it.
// This layer establishes verified ground truth ONCE: a verified figure set and
// a clerical/mathematical exception list, both passed to Preparer/Reviewer/
// Challenger/Synthesizer. All arithmetic here is executed in code — LLM mental
// math on the NAV bridge was the round-2 bug; never reintroduce it.
//
// Check families C1–C10 per the round-2 remediation spec
// (test/test-results/2026.06.09/round-2/). LEGACY = round-1 checks kept as-is.
// ─────────────────────────────────────────────────────────────────────────────

export type { DeterministicCheck, DeterministicStatus, VerificationResult, VerifiedFigure }

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

// Variance convention used everywhere in this file: found − expected, i.e.
// stated/disclosed figure minus the code-computed figure.
function varianceOf(expected: number, found: number): string | null {
  const diff = found - expected
  if (diff === 0) return null
  const pct = expected !== 0 ? ` (${((diff / Math.abs(expected)) * 100).toFixed(3)}%)` : ''
  return `${diff > 0 ? '+' : ''}${fmt(diff)}${pct}`
}

// Render a normalized flow for the "expected" formula string.
function flowTerm(f: NormalizedFlow): string {
  if (f.convention === 'signed') return `${f.effect >= 0 ? '+' : '−'} ${fmt(Math.abs(f.effect))} [${f.label}]`
  return `${f.direction === 'inflow' ? '+' : '−'} ${fmt(f.amount)} [${f.label}]`
}

export interface VerificationTextSource {
  source: string                    // e.g. document name or field path
  text: string
}

// ── C10 lexicon ───────────────────────────────────────────────────────────────
// Curated fund-reporting vocabulary. A token is flagged when it is NOT in the
// lexicon (modulo simple suffixes) but is within edit distance 1 (length 6–8)
// or 2 (length ≥ 9) of a lexicon word — e.g. "Decmber", "PAFORMANCE",
// "substntial", "Mangement". Deterministic and low-severity by design.

const LEXICON = new Set([
  'january', 'february', 'march', 'april', 'august', 'september', 'october', 'november', 'december',
  'management', 'performance', 'substantial', 'statement', 'statements',
  'partner', 'partners', 'partnership', 'capital', 'distribution', 'distributions',
  'contribution', 'contributions', 'investment', 'investments', 'investor', 'investors',
  'valuation', 'valuations', 'unrealized', 'realized', 'liability', 'liabilities',
  'financial', 'quarter', 'quarterly', 'annual', 'audited', 'auditor', 'auditors',
  'schedule', 'schedules', 'hierarchy', 'beginning', 'ending', 'balance', 'balances',
  'account', 'accounts', 'accounting', 'accrued', 'expense', 'expenses', 'income',
  'interest', 'carried', 'committed', 'commitment', 'commitments', 'subscription',
  'subscriptions', 'redemption', 'redemptions', 'portfolio', 'methodology',
  'disclosure', 'disclosures', 'agreement', 'agreements', 'administrator',
  'depreciation', 'appreciation', 'allocation', 'allocated', 'aggregate', 'summary',
  'period', 'periods', 'fiscal', 'increase', 'decrease', 'operations', 'operating',
  'reconciliation', 'rollforward', 'general', 'limited', 'company', 'companies',
  'securities', 'holdings', 'proceeds', 'expenses', 'highlights', 'subsequent',
  'related', 'parties', 'measurement', 'observable', 'unobservable', 'estimate',
  'estimates', 'significant', 'consolidated', 'condensed', 'unaudited', 'attributable',
])

const SUFFIXES = ['s', 'es', 'd', 'ed', 'ing', 'al', 'ally', 'ly']

function inLexicon(tokenLower: string): boolean {
  if (LEXICON.has(tokenLower)) return true
  for (const suf of SUFFIXES) {
    if (tokenLower.endsWith(suf) && LEXICON.has(tokenLower.slice(0, -suf.length))) return true
    if (LEXICON.has(tokenLower + suf)) return true
  }
  return false
}

// Damerau-Levenshtein distance, early-exit above `max`.
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const da = a.length, db = b.length
  const d: number[][] = Array.from({ length: da + 1 }, () => new Array<number>(db + 1).fill(0))
  for (let i = 0; i <= da; i++) d[i][0] = i
  for (let j = 0; j <= db; j++) d[0][j] = j
  for (let i = 1; i <= da; i++) {
    let rowMin = Infinity
    for (let j = 1; j <= db; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)  // transposition
      }
      rowMin = Math.min(rowMin, d[i][j])
    }
    if (rowMin > max) return max + 1
  }
  return d[da][db]
}

function nearestLexiconWord(tokenLower: string): { word: string; distance: number } | null {
  const threshold = tokenLower.length >= 9 ? 2 : 1
  let best: { word: string; distance: number } | null = null
  for (const word of LEXICON) {
    if (Math.abs(word.length - tokenLower.length) > threshold) continue
    const dist = editDistance(tokenLower, word, threshold)
    if (dist <= threshold && (!best || dist < best.distance)) {
      best = { word, distance: dist }
      if (dist === 1 && threshold === 1) break
    }
  }
  return best
}

// Assemble the text corpus C10 scans: profile narrative fields plus prose
// fields of the extraction itself.
export function collectTextSources(
  p: PreparerOutput,
  profiles: { documentName: string; profile: DocumentProfile }[] = [],
): VerificationTextSource[] {
  const sources: VerificationTextSource[] = []
  for (const { documentName, profile } of profiles) {
    if (profile.keyFacts.length > 0) sources.push({ source: documentName, text: profile.keyFacts.join('\n') })
    if (profile.sectionIndex.length > 0) sources.push({ source: documentName, text: profile.sectionIndex.map(s => s.title).join('\n') })
    if (profile.warningFlags.length > 0) sources.push({ source: documentName, text: profile.warningFlags.join('\n') })
  }
  const excerpts = Object.values(p.sourceCitations)
    .map(c => c.excerpt)
    .filter((e): e is string => e != null)
  if (excerpts.length > 0) sources.push({ source: 'extraction excerpts', text: excerpts.join('\n') })
  if (p.valuationDisclosures?.methodologySummary) {
    sources.push({ source: 'valuation methodology', text: p.valuationDisclosures.methodologySummary })
  }
  if (p.sideLetters.summaryNotes.length > 0) {
    sources.push({ source: 'side letter notes', text: p.sideLetters.summaryNotes.join('\n') })
  }
  return sources
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

export function runVerification(
  p: PreparerOutput,
  textSources: VerificationTextSource[] = [],
): VerificationResult {
  const checks: DeterministicCheck[] = []
  const verifiedFigureSet: VerifiedFigure[] = []
  let seq = 0

  const add = (c: Omit<DeterministicCheck, 'id'>): DeterministicCheck => {
    seq += 1
    const full = { id: `D-${String(seq).padStart(3, '0')}`, ...c }
    checks.push(full)
    return full
  }
  const verify = (label: string, value: number, check: DeterministicCheck) => {
    verifiedFigureSet.push({ label, value, verifiedBy: [check.id] })
  }

  // ── LEGACY: capital structure — called + uncalled = committed ──────────────
  if (p.calledCapital != null && p.uncalledCapital != null && p.totalCommittedCapital != null) {
    const called = Math.abs(p.calledCapital)
    const uncalled = Math.abs(p.uncalledCapital)
    const sum = called + uncalled
    const c = add({
      family: 'LEGACY',
      check: 'Capital structure: called + uncalled = total committed',
      expected: `${fmt(called)} + ${fmt(uncalled)} = ${fmt(sum)}`,
      found: `Total committed capital disclosed as ${fmt(p.totalCommittedCapital)}`,
      variance: varianceOf(sum, p.totalCommittedCapital),
      status: currencyEqual(sum, p.totalCommittedCapital) ? 'pass' : 'fail',
      severityCeiling: null,
      note: null,
    })
    if (c.status === 'pass') verify('Total committed capital', p.totalCommittedCapital, c)
  } else {
    add({
      family: 'LEGACY',
      check: 'Capital structure: called + uncalled = total committed',
      expected: 'calledCapital + uncalledCapital = totalCommittedCapital',
      found: 'One or more components not disclosed in the document set',
      variance: null,
      status: 'unable_to_verify',
      severityCeiling: null,
      note: null,
    })
  }

  // ── C4: balance-sheet equation — assets = liabilities + capital ────────────
  // NOTE (round-2 HF case): a balanced equation at the totals level must NEVER
  // suppress C2 — the totals can balance while the line items do not foot.
  // C2 below runs unconditionally and independently of this result.
  const bs = p.balanceSheet
  if (bs?.totalAssets != null && bs.totalLiabilities != null && bs.totalPartnersCapital != null) {
    const rhs = bs.totalLiabilities + bs.totalPartnersCapital
    const c = add({
      family: 'C4',
      check: "Balance-sheet equation: total assets = total liabilities + partners' capital",
      expected: `${fmt(bs.totalLiabilities)} + ${fmt(bs.totalPartnersCapital)} = ${fmt(rhs)}`,
      found: `Total assets disclosed as ${fmt(bs.totalAssets)}`,
      variance: varianceOf(rhs, bs.totalAssets),
      status: currencyEqual(rhs, bs.totalAssets) ? 'pass' : 'fail',
      severityCeiling: null,
      note: 'Totals-level balance does not verify line-item footing — see C2 section-footing results, which are independent of this check.',
    })
    if (c.status === 'pass') verify('Total assets (balance-sheet equation)', bs.totalAssets, c)
  } else {
    add({
      family: 'C4',
      check: "Balance-sheet equation: total assets = total liabilities + partners' capital",
      expected: 'totalAssets = totalLiabilities + totalPartnersCapital',
      found: 'Balance sheet totals not extracted from the document set',
      variance: null,
      status: 'unable_to_verify',
      severityCeiling: null,
      note: 'If a balance sheet / statement of assets and liabilities was provided, this is an extraction gap, not a document deficiency.',
    })
  }

  // ── C2: section footing — line items sum to their stated subtotal ──────────
  const sections: { key: string; label: string; section: { lineItems: { label: string; amount: number }[]; statedTotal: number | null } | null | undefined }[] = [
    { key: 'assets', label: 'Assets → Total Assets', section: p.statementSections?.assets },
    { key: 'liabilities', label: 'Liabilities → Total Liabilities', section: p.statementSections?.liabilities },
    { key: 'operations', label: 'Operations → Net Increase/Decrease from Operations', section: p.statementSections?.operations },
  ]
  for (const { key, label, section } of sections) {
    if (!section || section.lineItems.length === 0 || section.statedTotal == null) {
      add({
        family: 'C2',
        check: `Section footing: ${label}`,
        expected: 'Sum of itemized line items = stated subtotal',
        found: !section || section.lineItems.length === 0
          ? `No itemized ${key} line items captured in extraction`
          : 'Stated subtotal not captured in extraction',
        variance: null,
        status: 'unable_to_verify',
        severityCeiling: null,
        note: 'Line items were not captured — an extraction gap, not evidence the section foots. Do not treat as verified.',
      })
      continue
    }
    const sum = section.lineItems.reduce((acc, li) => acc + li.amount, 0)
    const c = add({
      family: 'C2',
      check: `Section footing: ${label}`,
      expected: `${section.lineItems.map(li => `${li.amount >= 0 ? '+' : '−'} ${fmt(Math.abs(li.amount))} [${li.label}]`).join(' ')} = ${fmt(sum)}`,
      found: `Stated subtotal is ${fmt(section.statedTotal)}`,
      variance: varianceOf(sum, section.statedTotal),
      status: currencyEqual(sum, section.statedTotal) ? 'pass' : 'fail',
      severityCeiling: null,
      note: c4Independence(key),
    })
    if (c.status === 'pass') verify(`Section subtotal: ${label}`, section.statedTotal, c)
  }

  // ── C3: FV hierarchy footing with outlier attribution ──────────────────────
  for (const fv of p.fairValueHierarchy) {
    const levels = [fv.level1, fv.level2, fv.level3]
    const disclosed = levels.filter((l): l is number => l != null)
    const periodTag = fv.periodLabel ? ` (${fv.periodLabel})` : ''
    if (disclosed.length === 0 || (fv.statedTotal == null && fv.balanceSheetInvestmentsLine == null)) {
      add({
        family: 'C3',
        check: `FV hierarchy footing${periodTag}: L1 + L2 + L3 vs. stated total and balance-sheet investments`,
        expected: 'level1 + level2 + level3 = note stated total = balance-sheet investments line',
        found: 'Hierarchy levels or comparison totals not captured in extraction',
        variance: null,
        status: 'unable_to_verify',
        severityCeiling: null,
        note: 'Extraction gap — do not treat the hierarchy as verified.',
      })
      continue
    }
    const sum = disclosed.reduce((a, b) => a + b, 0)
    const missingLevels = (['level1', 'level2', 'level3'] as const).filter(k => fv[k] == null)
    const sumExpr = `${fv.level1 != null ? `L1 ${fmt(fv.level1)}` : ''} ${fv.level2 != null ? `+ L2 ${fmt(fv.level2)}` : ''} ${fv.level3 != null ? `+ L3 ${fmt(fv.level3)}` : ''}`.trim()
    const tiesToNote = fv.statedTotal != null && currencyEqual(sum, fv.statedTotal)
    const tiesToBs = fv.balanceSheetInvestmentsLine != null && currencyEqual(sum, fv.balanceSheetInvestmentsLine)

    let status: DeterministicStatus
    let note: string
    let variance: string | null
    if ((fv.statedTotal == null || tiesToNote) && (fv.balanceSheetInvestmentsLine == null || tiesToBs)) {
      status = 'pass'
      variance = null
      note = 'Hierarchy components foot to all available comparison totals.'
    } else if (tiesToBs && !tiesToNote && fv.statedTotal != null) {
      status = 'fail'
      variance = varianceOf(sum, fv.statedTotal)
      note = `Components tie to the balance-sheet investments line (${fmt(fv.balanceSheetInvestmentsLine!)}); the note's own stated total (${fmt(fv.statedTotal)}) is the outlier. Attribute the break to the stated note total, not to the components.`
    } else if (tiesToNote && !tiesToBs && fv.balanceSheetInvestmentsLine != null) {
      status = 'fail'
      variance = varianceOf(sum, fv.balanceSheetInvestmentsLine)
      note = `Components tie to the note's stated total (${fmt(fv.statedTotal!)}); the balance-sheet investments line (${fmt(fv.balanceSheetInvestmentsLine)}) is the outlier. Attribute the break to the balance-sheet line.`
    } else {
      status = 'fail'
      variance = fv.statedTotal != null ? varianceOf(sum, fv.statedTotal) : varianceOf(sum, fv.balanceSheetInvestmentsLine!)
      note = 'Components do not tie to either comparison total — an unattributed hierarchy break. Both the note total and the balance-sheet line require vouching.'
    }
    if (missingLevels.length > 0) {
      note += ` Levels not captured and treated as zero: ${missingLevels.join(', ')}.`
    }
    const c = add({
      family: 'C3',
      check: `FV hierarchy footing${periodTag}: components vs. note total and balance-sheet investments line`,
      expected: `${sumExpr} = ${fmt(sum)}`,
      found: `Note stated total: ${fv.statedTotal != null ? fmt(fv.statedTotal) : 'not captured'}; balance-sheet investments line: ${fv.balanceSheetInvestmentsLine != null ? fmt(fv.balanceSheetInvestmentsLine) : 'not captured'}`,
      variance,
      status,
      severityCeiling: null,
      note,
    })
    if (c.status === 'pass') verify(`FV hierarchy total${periodTag}`, sum, c)
  }

  // ── C1: NAV bridge on normalized flows, with sign-artifact guardrail ───────
  const bridge = p.navBridge ? normalizeNavBridge(p.navBridge) : null
  if (bridge) {
    const periodTag = bridge.periodLabel ? ` (${bridge.periodLabel})` : ''
    let flows = bridge.flows
    let computed = bridge.computedEndingNav
    let artifactNote: string | null = null

    // Guardrail: if the residual variance ≈ 2× a single flow's effect, the flow
    // was extracted with an inverted sign (possible only on 'signed' components
    // after normalization — fixed-direction flows cannot double-count). Flip it,
    // recompute, and surface the artifact as a demoted low-severity exception
    // rather than escalating a phantom NAV break.
    if (!currencyEqual(computed, bridge.statedEndingNav)) {
      const variance = bridge.statedEndingNav - computed
      const candidates = flows.filter(f =>
        f.effect !== 0 &&
        Math.abs(Math.abs(variance) - 2 * Math.abs(f.effect)) <= Math.max(2, 0.02 * 2 * Math.abs(f.effect))
      )
      if (candidates.length === 1) {
        const a = candidates[0]
        const flippedComputed = computed - 2 * a.effect
        if (Math.abs(bridge.statedEndingNav - flippedComputed) < Math.abs(variance)) {
          flows = flows.map(f => f === a ? { ...f, effect: -f.effect, direction: f.effect >= 0 ? 'outflow' as const : 'inflow' as const } : f)
          computed = flippedComputed
          artifactNote = `Sign artifact detected: the raw variance (${fmt(variance)}) equaled 2× the "${a.label}" flow (${fmt(a.raw)} as extracted) — the flow's sign was inverted at extraction. Auto-corrected before comparison.`
          add({
            family: 'C1',
            check: `NAV bridge${periodTag}: extraction sign artifact on "${a.label}"`,
            expected: `"${a.label}" with corrected sign (effect ${fmt(-a.effect)})`,
            found: `Extracted as ${fmt(a.raw)}, producing a 2× double-count in the bridge`,
            variance: null,
            status: 'fail',
            severityCeiling: 'informational',
            note: 'Extraction-quality issue, not a NAV error. Demote: report as a low-severity sign/presentation artifact. Do not escalate, and do not raise a NAV reconciliation finding from this artifact — the corrected bridge result below is authoritative.',
          })
        }
      }
    }

    const missing = bridge.missingComponents
    const baseNote = missing.length > 0
      ? `Components not disclosed and treated as zero: ${missing.join(', ')}. A failure may reflect an undisclosed component (e.g. a change in liabilities) rather than an arithmetic error — frame accordingly.`
      : 'All bridge components were disclosed. A residual variance is an unexplained reconciling item — a genuine exception, not a sign artifact (the guardrail already screened for that).'
    const c = add({
      family: 'C1',
      check: `NAV bridge${periodTag}: beginning + normalized flows = ending`,
      expected: `${fmt(bridge.beginningNav)} ${flows.map(flowTerm).join(' ')} = ${fmt(computed)}`,
      found: `Ending NAV disclosed as ${fmt(bridge.statedEndingNav)}`,
      variance: varianceOf(computed, bridge.statedEndingNav),
      status: currencyEqual(computed, bridge.statedEndingNav) ? 'pass' : 'fail',
      severityCeiling: null,
      note: artifactNote ? `${artifactNote} ${baseNote}` : baseNote,
    })
    if (c.status === 'pass') verify(`Ending NAV${periodTag}`, bridge.statedEndingNav, c)
  }

  // ── LEGACY: NAV vs. sum of LP capital accounts ──────────────────────────────
  if (p.nav && p.capitalAccounts.length > 0) {
    const sum = p.capitalAccounts.reduce((acc, ca) => acc + ca.endingBalance, 0)
    const c = add({
      family: 'LEGACY',
      check: 'Total NAV equals sum of LP ending capital account balances',
      expected: `Sum of ${p.capitalAccounts.length} LP ending balances = ${fmt(sum)}`,
      found: `Total NAV disclosed as ${fmt(p.nav.total)}`,
      variance: varianceOf(sum, p.nav.total),
      status: currencyEqual(sum, p.nav.total) ? 'pass' : 'fail',
      severityCeiling: null,
      note: 'A variance can be legitimate if the capital account statement covers a subset of LPs — confirm coverage before treating a fail as a finding.',
    })
    if (c.status === 'pass') verify('Total NAV (vs. LP capital accounts)', p.nav.total, c)
  }

  // ── C5: per-LP capital account rollforward ──────────────────────────────────
  for (const ca of p.capitalAccounts) {
    if (ca.beginningBalance == null) continue
    // Normalized: contributions/distributions are magnitudes regardless of
    // displayed sign; allocated income/loss keeps its sign.
    const contributions = Math.abs(ca.contributions)
    const distributions = Math.abs(ca.distributions)
    const computed = ca.beginningBalance + contributions + ca.allocatedIncomeLoss - distributions
    const c = add({
      family: 'C5',
      check: `LP capital rollforward (${ca.lpId}): beginning + contributions + allocated income/loss − distributions = ending`,
      expected: `${fmt(ca.beginningBalance)} + ${fmt(contributions)} + ${fmt(ca.allocatedIncomeLoss)} − ${fmt(distributions)} = ${fmt(computed)}`,
      found: `Ending balance disclosed as ${fmt(ca.endingBalance)}`,
      variance: varianceOf(computed, ca.endingBalance),
      status: currencyEqual(computed, ca.endingBalance) ? 'pass' : 'fail',
      severityCeiling: null,
      note: 'Beginning balance is the value explicitly disclosed in the document, never inferred.',
    })
    if (c.status === 'pass') verify(`LP ending balance (${ca.lpId})`, ca.endingBalance, c)
  }

  // ── C6: rollforward table audit — internal foot + endpoint ties ─────────────
  for (const rf of p.rollforwards) {
    const periodTag = rf.periodLabel ? ` (${rf.periodLabel})` : ''
    // (a) internal footing of the column
    if (rf.beginningBalance != null && rf.statedEndingBalance != null && rf.flows.length > 0) {
      const flows = normalizeRollforwardFlows(rf.flows)
      const computed = flows.reduce((acc, f) => acc + f.effect, rf.beginningBalance)
      const c = add({
        family: 'C6',
        check: `Rollforward internal footing: ${rf.tableName}${periodTag}`,
        expected: `${fmt(rf.beginningBalance)} ${flows.map(flowTerm).join(' ')} = ${fmt(computed)}`,
        found: `Stated ending balance is ${fmt(rf.statedEndingBalance)}`,
        variance: varianceOf(computed, rf.statedEndingBalance),
        status: currencyEqual(computed, rf.statedEndingBalance) ? 'pass' : 'fail',
        severityCeiling: null,
        note: 'Flow directions were normalized from row labels; verify direction assignments against the source when interpreting a fail. A variance may indicate a missing flow row (e.g. an undisclosed realized line) rather than bad arithmetic.',
      })
      if (c.status === 'pass') verify(`Rollforward ending: ${rf.tableName}${periodTag}`, rf.statedEndingBalance, c)
    } else {
      add({
        family: 'C6',
        check: `Rollforward internal footing: ${rf.tableName}${periodTag}`,
        expected: 'beginning + flows = stated ending',
        found: 'Beginning balance, flows, or stated ending not captured in extraction',
        variance: null,
        status: 'unable_to_verify',
        severityCeiling: null,
        note: 'Extraction gap — the rollforward cannot be footed.',
      })
    }
    // (b) endpoint ties to the FV hierarchy for investment/L3 rollforwards
    if ((rf.subject === 'level3' || rf.subject === 'investments') && p.fairValueHierarchy.length > 0) {
      const tieValue = (entry: PreparerOutput['fairValueHierarchy'][number]): number | null =>
        rf.subject === 'level3' ? entry.level3 : (entry.statedTotal ?? entry.balanceSheetInvestmentsLine)
      const findPeriod = (label: string | null) =>
        label == null ? undefined : p.fairValueHierarchy.find(e => e.periodLabel?.trim().toLowerCase() === label.trim().toLowerCase())
      const endpoints: { name: string; balance: number | null; periodLabel: string | null }[] = [
        { name: 'opening', balance: rf.beginningBalance, periodLabel: rf.beginningPeriodLabel },
        { name: 'ending', balance: rf.statedEndingBalance, periodLabel: rf.endingPeriodLabel },
      ]
      for (const ep of endpoints) {
        const entry = findPeriod(ep.periodLabel)
        const target = entry ? tieValue(entry) : null
        if (ep.balance == null || entry == null || target == null) {
          add({
            family: 'C6',
            check: `Rollforward endpoint tie: ${rf.tableName} ${ep.name} balance vs. ${rf.subject === 'level3' ? 'Level 3' : 'investments'} subtotal${ep.periodLabel ? ` (${ep.periodLabel})` : ''}`,
            expected: 'Rollforward endpoint ties to the corresponding holdings/balance subtotal',
            found: ep.balance == null ? 'Endpoint balance not captured' : 'No matching-period hierarchy disclosure captured',
            variance: null,
            status: 'unable_to_verify',
            severityCeiling: null,
            note: 'Cannot tie the rollforward endpoint to a holdings subtotal — extraction gap or the document does not disclose the comparison period.',
          })
          continue
        }
        const tied = currencyEqual(ep.balance, target)
        add({
          family: 'C6',
          check: `Rollforward endpoint tie: ${rf.tableName} ${ep.name} balance vs. ${rf.subject === 'level3' ? 'Level 3' : 'investments'} subtotal (${ep.periodLabel})`,
          expected: `${rf.subject === 'level3' ? 'Level 3' : 'Investments'} subtotal for ${ep.periodLabel} is ${fmt(target)}`,
          found: `Rollforward ${ep.name} balance is ${fmt(ep.balance)}`,
          variance: varianceOf(target, ep.balance),
          status: tied ? 'pass' : 'fail',
          severityCeiling: null,
          note: tied ? null : 'The rollforward endpoint does not tie to the corresponding subtotal — the table is disconnected from the holdings/balance data it purports to roll forward. Vouch which figure set is authoritative.',
        })
      }
    }
  }

  // ── C7: flow-to-balance / cross-period consistency ──────────────────────────
  const pca = p.periodCapitalActivity
  if (pca) {
    const periodTag = pca.periodLabel ? ` (${pca.periodLabel})` : ''
    const pairs: { label: string; periodFlow: number | null; cumBeginning: number | null; cumEnding: number | null }[] = [
      { label: 'capital calls', periodFlow: pca.periodCapitalCalls, cumBeginning: pca.cumulativeCalledBeginning, cumEnding: pca.cumulativeCalledEnding },
      { label: 'distributions', periodFlow: pca.periodDistributions, cumBeginning: pca.cumulativeDistributionsBeginning, cumEnding: pca.cumulativeDistributionsEnding },
    ]
    for (const pair of pairs) {
      if (pair.cumBeginning == null || pair.cumEnding == null) {
        if (pair.periodFlow != null) {
          add({
            family: 'C7',
            check: `Flow-to-balance${periodTag}: period ${pair.label} vs. Δ cumulative`,
            expected: `Period ${pair.label} = cumulative ending − cumulative beginning`,
            found: 'Cumulative balances not captured in extraction',
            variance: null,
            status: 'unable_to_verify',
            severityCeiling: null,
            note: 'Extraction gap — period flow cannot be reconciled to cumulative balances.',
          })
        }
        continue
      }
      const delta = pair.cumEnding - pair.cumBeginning
      const flow = Math.abs(pair.periodFlow ?? 0)   // null period flow ⇒ no disclosed activity ⇒ expected Δ = 0
      const c = add({
        family: 'C7',
        check: `Flow-to-balance${periodTag}: period ${pair.label} reconcile to Δ cumulative ${pair.label}`,
        expected: `Δ cumulative = ${fmt(pair.cumEnding)} − ${fmt(pair.cumBeginning)} = ${fmt(delta)}`,
        found: `Period ${pair.label} disclosed as ${pair.periodFlow != null ? fmt(flow) : 'none (no period activity disclosed)'}`,
        variance: varianceOf(delta, flow),
        status: currencyEqual(delta, flow) ? 'pass' : 'fail',
        severityCeiling: null,
        note: currencyEqual(delta, flow)
          ? null
          : `Period activity does not flow into the cumulative balance — either the period ${pair.label} figure or the cumulative balance is wrong, or activity was recorded in a different period. This is a cross-period integrity exception, not a rounding issue.`,
      })
      if (c.status === 'pass' && pair.periodFlow != null) verify(`Period ${pair.label}${periodTag}`, flow, c)
    }
  }

  // ── C8: cross-statement consistency — SoC ending capital = BS capital ───────
  if (p.statementOfChanges?.endingCapital != null && bs?.totalPartnersCapital != null) {
    const soc = p.statementOfChanges.endingCapital
    const c = add({
      family: 'C8',
      check: "Cross-statement consistency: Statement-of-Changes ending capital = balance-sheet partners' capital",
      expected: `Statement of Changes ending capital is ${fmt(soc)}`,
      found: `Balance-sheet partners' capital is ${fmt(bs.totalPartnersCapital)}`,
      variance: varianceOf(soc, bs.totalPartnersCapital),
      status: currencyEqual(soc, bs.totalPartnersCapital) ? 'pass' : 'fail',
      severityCeiling: null,
      note: currencyEqual(soc, bs.totalPartnersCapital)
        ? null
        : 'The two statements disagree on ending capital. Cross-reference the C2 operations footing — an income-statement component error propagates into the Statement of Changes and produces exactly this break.',
    })
    if (c.status === 'pass') verify("Ending partners' capital (cross-statement)", bs.totalPartnersCapital, c)
  } else if (p.statementOfChanges?.endingCapital != null || bs?.totalPartnersCapital != null) {
    add({
      family: 'C8',
      check: "Cross-statement consistency: Statement-of-Changes ending capital = balance-sheet partners' capital",
      expected: 'SoC ending capital = balance-sheet capital',
      found: 'One of the two figures was not captured in extraction',
      variance: null,
      status: 'unable_to_verify',
      severityCeiling: null,
      note: 'Extraction gap — cross-statement consistency cannot be verified.',
    })
  }

  // ── LEGACY: stated performance metrics ──────────────────────────────────────
  const m = p.statedPerformanceMetrics
  if (m) {
    if (m.tvpi != null && m.dpi != null && m.rvpi != null) {
      const sum = m.dpi + m.rvpi
      add({
        family: 'LEGACY',
        check: 'Stated TVPI = stated DPI + stated RVPI',
        expected: `${m.dpi} + ${m.rvpi} = ${fmt(sum)}`,
        found: `Stated TVPI is ${m.tvpi}`,
        variance: varianceOf(sum, m.tvpi),
        status: ratioEqual(m.tvpi, sum) ? 'pass' : 'fail',
        severityCeiling: null,
        note: 'Tolerance allows for rounding of independently rounded components. A fail here is a RECOMPUTABLE internal inconsistency — it may legitimately remain critical.',
      })
    }
    if (m.dpi != null && m.cumulativeDistributions != null && p.calledCapital != null && p.calledCapital > 0) {
      const computed = m.cumulativeDistributions / p.calledCapital
      add({
        family: 'LEGACY',
        check: 'Stated DPI reconciles to cumulative distributions ÷ called capital',
        expected: `${fmt(m.cumulativeDistributions)} ÷ ${fmt(p.calledCapital)} = ${computed.toFixed(3)}`,
        found: `Stated DPI is ${m.dpi}`,
        variance: varianceOf(computed, m.dpi),
        status: ratioEqual(m.dpi, computed) ? 'pass' : 'fail',
        severityCeiling: null,
        note: null,
      })
    }
    if (m.rvpi != null && p.nav && p.calledCapital != null && p.calledCapital > 0) {
      const computed = p.nav.total / p.calledCapital
      add({
        family: 'LEGACY',
        check: 'Stated RVPI reconciles to NAV ÷ called capital',
        expected: `${fmt(p.nav.total)} ÷ ${fmt(p.calledCapital)} = ${computed.toFixed(3)}`,
        found: `Stated RVPI is ${m.rvpi}`,
        variance: varianceOf(computed, m.rvpi),
        status: ratioEqual(m.rvpi, computed) ? 'pass' : 'fail',
        severityCeiling: null,
        note: null,
      })
    }
    if (m.tvpi != null && m.cumulativeDistributions != null && p.nav && p.calledCapital != null && p.calledCapital > 0) {
      const computed = (p.nav.total + m.cumulativeDistributions) / p.calledCapital
      add({
        family: 'LEGACY',
        check: 'Stated TVPI reconciles to (NAV + cumulative distributions) ÷ called capital',
        expected: `(${fmt(p.nav.total)} + ${fmt(m.cumulativeDistributions)}) ÷ ${fmt(p.calledCapital)} = ${computed.toFixed(3)}`,
        found: `Stated TVPI is ${m.tvpi}`,
        variance: varianceOf(computed, m.tvpi),
        status: ratioEqual(m.tvpi, computed) ? 'pass' : 'fail',
        severityCeiling: null,
        note: null,
      })
    }
    if (m.netIrr != null) {
      add({
        family: 'LEGACY',
        check: 'Stated net IRR — independent recomputation',
        expected: 'Recomputation requires dated cash flows, which fund reporting does not disclose',
        found: `Stated net IRR is ${(m.netIrr * 100).toFixed(1)}%`,
        variance: null,
        status: 'unable_to_verify',
        severityCeiling: 'warning',
        note: 'IRR cannot be independently recomputed without dated cash flows. Any tension between stated IRR and multiples (e.g. a high IRR with a modest TVPI) is a PLAUSIBILITY observation on an unverifiable figure — cap severity at WARNING, never CRITICAL.',
      })
    }
  }

  // ── LEGACY: investment schedule vs. NAV ─────────────────────────────────────
  if (p.investments.length > 0 && p.nav) {
    const fvSum = p.investments.reduce((acc, inv) => acc + inv.fairValue, 0)
    if (bs && (bs.cashAndEquivalents != null || bs.totalLiabilities != null)) {
      const cash = bs.cashAndEquivalents ?? 0
      const liabilities = bs.totalLiabilities ?? 0
      const computed = fvSum + cash - liabilities
      add({
        family: 'LEGACY',
        check: 'Investments at fair value + cash − liabilities reconciles to total NAV',
        expected: `${fmt(fvSum)} + ${fmt(cash)} − ${fmt(liabilities)} = ${fmt(computed)}`,
        found: `Total NAV disclosed as ${fmt(p.nav.total)}`,
        variance: varianceOf(computed, p.nav.total),
        status: currencyEqual(computed, p.nav.total) ? 'pass' : 'fail',
        severityCeiling: null,
        note: 'Other assets/receivables not captured in the extraction can explain a small residual — interpret a fail in that light before asserting an error.',
      })
    } else {
      add({
        family: 'LEGACY',
        check: 'Sum of investment fair values vs. total NAV',
        expected: `Sum of ${p.investments.length} positions = ${fmt(fvSum)}`,
        found: `Total NAV disclosed as ${fmt(p.nav.total)}`,
        variance: varianceOf(fvSum, p.nav.total),
        status: 'unable_to_verify',
        severityCeiling: null,
        note: 'Cash and liabilities were not extracted, so the difference between portfolio fair value and NAV cannot be attributed deterministically. Do NOT treat this variance as an error — it normally equals cash + other assets − liabilities.',
      })
    }
  }

  // ── C9: workpaper sign-off date sequence ────────────────────────────────────
  for (const wp of p.workpaperMetadata) {
    if (!wp.preparedDate || !wp.reviewedDate) continue
    const ok = wp.reviewedDate >= wp.preparedDate  // ISO strings compare lexicographically
    add({
      family: 'C9',
      check: `Workpaper sign-off sequence (${wp.documentName}): reviewed date must not precede prepared date`,
      expected: `Reviewed date ≥ prepared date (${wp.preparedDate})`,
      found: `Reviewed ${wp.reviewedDate}${wp.reviewedBy ? ` by ${wp.reviewedBy}` : ''}; prepared ${wp.preparedDate}${wp.preparedBy ? ` by ${wp.preparedBy}` : ''}`,
      variance: null,
      status: ok ? 'pass' : 'fail',
      severityCeiling: null,
      note: ok ? null : 'A review sign-off dated before preparation indicates a workpaper control failure or a clerical date error.',
    })
  }

  // ── LEGACY: NAV as-of date vs. fiscal year end ──────────────────────────────
  if (p.nav) {
    add({
      family: 'LEGACY',
      check: 'NAV as-of date matches fiscal year end',
      expected: `Fiscal year end ${p.fiscalYearEnd}`,
      found: `NAV as of ${p.nav.asOfDate}`,
      variance: null,
      status: p.nav.asOfDate === p.fiscalYearEnd ? 'pass' : 'fail',
      severityCeiling: null,
      note: 'A mismatch may be legitimate for interim/quarterly NAV statements — confirm document period before treating as a finding.',
    })
  }

  // ── C10: typo / OCR-quality pass ────────────────────────────────────────────
  const flagged = new Map<string, { suggestion: string; sources: Set<string> }>()
  for (const ts of textSources) {
    for (const match of ts.text.matchAll(/[A-Za-z]{6,}/g)) {
      const token = match[0]
      const lower = token.toLowerCase()
      if (flagged.has(lower)) { flagged.get(lower)!.sources.add(ts.source); continue }
      if (inLexicon(lower)) continue
      const nearest = nearestLexiconWord(lower)
      if (nearest) {
        flagged.set(lower, { suggestion: nearest.word, sources: new Set([ts.source]) })
      }
    }
  }
  let typoCount = 0
  for (const [token, info] of flagged) {
    if (typoCount >= 10) break   // cap noise; surface the first 10 distinct tokens
    typoCount += 1
    add({
      family: 'C10',
      check: `Typo/OCR quality: "${token}"`,
      expected: `Likely intended: "${info.suggestion}"`,
      found: `Token "${token}" appears in: ${[...info.sources].join('; ')}`,
      variance: null,
      status: 'fail',
      severityCeiling: 'informational',
      note: 'Deterministic spelling surface — low severity. A misspelling in a financial document is a presentation-quality observation unless it affects a reported figure or date.',
    })
  }

  return {
    checks,
    verifiedFigureSet,
    exceptionList: checks.filter(c => c.status === 'fail'),
  }
}

// C2 note text varies by section to anchor the C2 ⊄ C4 rule where it bit in
// round 2 (HF: equation balanced while asset line items did not foot).
function c4Independence(sectionKey: string): string | null {
  if (sectionKey === 'assets' || sectionKey === 'liabilities') {
    return 'This footing is independent of the balance-sheet equation (C4): totals can balance while the line items do not foot. A C4 pass never clears a C2 fail.'
  }
  return 'An operations footing break propagates into the Statement of Changes — cross-reference the C8 cross-statement result.'
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format the verification result as a prompt block for downstream agents.
 * The agents interpret these results; they must not recompute or contradict them.
 */
export function formatVerificationForPrompt(v: VerificationResult): string {
  if (v.checks.length === 0) return ''

  const checkLines = v.checks.map(c => {
    const parts = [
      `${c.id} [${c.family}] [${c.status.toUpperCase()}] ${c.check}`,
      `  Expected: ${c.expected}`,
      `  Found: ${c.found}`,
    ]
    if (c.variance) parts.push(`  Variance: ${c.variance}`)
    if (c.severityCeiling) parts.push(`  Severity ceiling: ${c.severityCeiling.toUpperCase()} — do not raise any finding from this check above this severity.`)
    if (c.note) parts.push(`  Note: ${c.note}`)
    return parts.join('\n')
  })

  const verifiedLines = v.verifiedFigureSet.length > 0
    ? v.verifiedFigureSet.map(f => `- ${f.label}: ${fmt(f.value)} (verified by ${f.verifiedBy.join(', ')})`).join('\n')
    : '- None — no figure passed deterministic verification. Treat all extracted figures as unvouched.'

  return `=== DETERMINISTIC VERIFICATION (computed by code — authoritative) ===
The extraction was verified by deterministic code before any agent reasoning. Two artifacts follow: the VERIFIED FIGURE SET (figures that passed code-computed reconciliation — reason on these, never on raw extraction) and the full check list including the CLERICAL/MATHEMATICAL EXCEPTION LIST (status FAIL).

Rules:
- Do NOT recompute these checks or perform your own reconciliation arithmetic.
- Do NOT raise an arithmetic finding that contradicts a PASS result.
- Every quantitative finding you produce MUST cite the deterministic check ID (e.g. D-003) it rests on, or explicitly state the figure was vouched another way.
- Respect each check's severity ceiling where present — guardrail-demoted items (e.g. extraction sign artifacts) must not be escalated.
- For each FAIL, interpret its significance using the attached note and cite the check ID in your finding.
- UNABLE_TO_VERIFY means the inputs were not extracted — phrase any related observation as an extraction/verification gap, not as a document deficiency.

VERIFIED FIGURE SET:
${verifiedLines}

CHECKS (exceptions are the FAIL entries):
${checkLines.join('\n\n')}
===`
}
