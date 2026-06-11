import { describe, it, expect } from 'vitest'
import { runVerification } from '@/lib/validations'
import { normalizeNavBridge, classifyFlowLabel } from '@/lib/normalize'
import type { DeterministicCheck, PreparerOutput, VerificationResult } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Round-2 regression suite — fixtures from
// test/test-results/2026.06.09/round-2/test-results-notes-2026.06.09-2.md §6.
// Engagements: HF (Apex, clean), Multi-Strategy (Ironwood, flawed),
// PE (Bridgepoint, flawed), VC (Sequoia, clean).
// Expected values assume FIXED sign normalization and line-item extraction.
// ─────────────────────────────────────────────────────────────────────────────

function makePreparer(overrides: Partial<PreparerOutput>): PreparerOutput {
  return {
    fundName: 'Test Fund',
    fundType: 'PE',
    vintageYear: 2020,
    fiscalYearEnd: '2023-12-31',
    currency: 'USD',
    totalCommittedCapital: null,
    calledCapital: null,
    uncalledCapital: null,
    nav: null,
    capitalAccounts: [],
    statedPerformanceMetrics: null,
    balanceSheet: null,
    navBridge: null,
    statementSections: null,
    fairValueHierarchy: [],
    rollforwards: [],
    periodCapitalActivity: null,
    statementOfChanges: null,
    valuationDisclosures: null,
    workpaperMetadata: [],
    investments: [],
    feeTerms: {
      managementFeeRate: null, managementFeeBase: null, carriedInterestRate: null,
      preferredReturn: null, hurdleRate: null, catchUpRate: null, waterfallType: null,
      gpCommitmentPercent: null, clawbackPresent: null, clawbackTerms: null, feeOffsets: null,
    },
    investmentPeriod: null,
    fundTerm: null,
    keyPersonProvisions: null,
    sideLetters: { present: false, count: null, summaryNotes: [] },
    ericaStatus: null,
    ascDisclosures: {
      fairValueHierarchyPresent: false, investmentCompanyGuidanceCited: false,
      financialHighlightsPresent: null, subsequentEventsDisclosed: null,
      relatedPartyDisclosuresPresent: null, scheduleOfInvestmentsPresent: null,
    },
    auditFirm: null,
    sourceCitations: {},
    promptVersion: 'test',
    modelVersion: 'test',
    ...overrides,
  }
}

function findFamily(v: VerificationResult, family: DeterministicCheck['family']): DeterministicCheck[] {
  return v.checks.filter(c => c.family === family)
}

function bridgeCheck(v: VerificationResult): DeterministicCheck {
  const c = findFamily(v, 'C1').find(c => c.check.includes('NAV bridge') && !c.check.includes('sign artifact'))
  expect(c).toBeDefined()
  return c!
}

function artifactChecks(v: VerificationResult): DeterministicCheck[] {
  return findFamily(v, 'C1').filter(c => c.check.includes('sign artifact'))
}

// ── C1 — NAV bridge (normalized signs) ────────────────────────────────────────

describe('C1 — NAV bridge', () => {
  it('HF (Apex): 152,840 + 12,500 − 18,810 + 30,595 = 177,125 → variance 0 (PASS)', () => {
    const v = runVerification(makePreparer({
      navBridge: {
        periodLabel: 'FY2023', beginningNav: 152_840,
        contributions: 12_500, distributions: 18_810,
        realizedGainLoss: null, unrealizedGainLoss: 30_595,
        feesAndExpenses: null, otherChanges: null, endingNav: 177_125,
      },
    }))
    const c = bridgeCheck(v)
    expect(c.status).toBe('pass')
    expect(c.variance).toBeNull()
  })

  it('PE (Bridgepoint): distributions extracted as DISPLAYED (−18,810) must not double-count — no −37,620 phantom variance', () => {
    // Pre-fix buggy output was −37,620 = 2 × 18,810: the profiler captured the
    // displayed sign and the bridge formula subtracted it again.
    const v = runVerification(makePreparer({
      navBridge: {
        periodLabel: 'FY2023', beginningNav: 152_840,
        contributions: 12_500, distributions: -18_810,   // as displayed: "(18,810)"
        realizedGainLoss: null, unrealizedGainLoss: 31_095,
        feesAndExpenses: null, otherChanges: null, endingNav: 177_625,
      },
    }))
    const c = bridgeCheck(v)
    expect(c.status).toBe('pass')
    expect(c.variance).toBeNull()
    expect(artifactChecks(v)).toHaveLength(0)   // normalization fixed it, not the guardrail
  })

  it('Ironwood: genuine −2,400 variance surfaces as FAIL and is NOT classified a sign artifact', () => {
    const v = runVerification(makePreparer({
      navBridge: {
        periodLabel: 'Q4 2023', beginningNav: 285_100,
        contributions: 15_000, distributions: 8_200,
        realizedGainLoss: null, unrealizedGainLoss: 22_400,
        feesAndExpenses: 4_200, otherChanges: null, endingNav: 312_500,
      },
    }))
    // 285,100 + 15,000 − 8,200 − 4,200 + 22,400 = 310,100 vs stated 312,500
    const c = bridgeCheck(v)
    expect(c.status).toBe('fail')
    expect(c.variance).toContain('2,400')
    expect(artifactChecks(v)).toHaveLength(0)
    expect(c.note).toContain('not disclosed')   // missing realized line hedging
  })

  it('VC (Sequoia): genuine −200 variance surfaces as FAIL even with distributions extracted as −10,100', () => {
    const v = runVerification(makePreparer({
      navBridge: {
        periodLabel: 'Q4 2023', beginningNav: 271_440,
        contributions: null, distributions: -10_100,     // as displayed
        realizedGainLoss: 12_200, unrealizedGainLoss: 13_280,
        feesAndExpenses: 2_300, otherChanges: null, endingNav: 284_720,
      },
    }))
    // 271,440 − 10,100 + 13,280 + 12,200 − 2,300 = 284,520 vs stated 284,720
    const c = bridgeCheck(v)
    expect(c.status).toBe('fail')
    expect(c.variance).toContain('200')
    expect(artifactChecks(v)).toHaveLength(0)
  })

  it('guardrail: variance ≈ 2× a single signed flow → auto-correct, demote, do not escalate', () => {
    // Unrealized gain extracted with an inverted sign (−20,000 instead of +20,000):
    // raw computed = 100,000 − 20,000 = 80,000 vs stated 120,000 → variance 40,000 = 2×20,000.
    const v = runVerification(makePreparer({
      navBridge: {
        periodLabel: 'FY2023', beginningNav: 100_000,
        contributions: null, distributions: null,
        realizedGainLoss: null, unrealizedGainLoss: -20_000,
        feesAndExpenses: null, otherChanges: null, endingNav: 120_000,
      },
    }))
    const c = bridgeCheck(v)
    expect(c.status).toBe('pass')                       // corrected bridge reconciles
    expect(c.note).toContain('Sign artifact')
    const artifacts = artifactChecks(v)
    expect(artifacts).toHaveLength(1)                   // surfaced, demoted — not suppressed
    expect(artifacts[0].severityCeiling).toBe('informational')
  })

  it('guardrail: artifact plus genuine residual — corrects the 2× flow, reports the residual as FAIL', () => {
    // Same artifact, but the stated ending also carries a genuine −200 break.
    const v = runVerification(makePreparer({
      navBridge: {
        periodLabel: 'FY2023', beginningNav: 100_000,
        contributions: null, distributions: null,
        realizedGainLoss: null, unrealizedGainLoss: -20_000,
        feesAndExpenses: null, otherChanges: null, endingNav: 119_800,
      },
    }))
    const c = bridgeCheck(v)
    expect(c.status).toBe('fail')
    expect(c.variance).toContain('200')
    expect(c.variance).not.toContain('40,')             // the 2× component was corrected away
    expect(artifactChecks(v)).toHaveLength(1)
  })
})

// ── C2 — Section footing ──────────────────────────────────────────────────────

describe('C2 — section footing', () => {
  it('HF: asset line items sum 204,015 vs stated 203,915 → exception of 100', () => {
    const v = runVerification(makePreparer({
      statementSections: {
        assets: {
          lineItems: [
            { label: 'Investments at fair value', amount: 185_915 },
            { label: 'Cash and cash equivalents', amount: 15_600 },
            { label: 'Dividends receivable', amount: 2_500 },
          ],
          statedTotal: 203_915,
        },
        liabilities: null,
        operations: null,
      },
    }))
    const c = findFamily(v, 'C2').find(c => c.check.includes('Assets'))!
    expect(c.status).toBe('fail')
    expect(c.variance).toContain('100')
  })

  it('PE: asset line items sum 204,015 vs stated 203,515 → exception of 500', () => {
    const v = runVerification(makePreparer({
      statementSections: {
        assets: {
          lineItems: [
            { label: 'Investments at fair value', amount: 187_450 },
            { label: 'Cash and cash equivalents', amount: 14_065 },
            { label: 'Other assets', amount: 2_500 },
          ],
          statedTotal: 203_515,
        },
        liabilities: null,
        operations: null,
      },
    }))
    const c = findFamily(v, 'C2').find(c => c.check.includes('Assets'))!
    expect(c.status).toBe('fail')
    expect(c.variance).toContain('500')
  })

  it('PE operations: NII −3,495 + net gain 34,090 = 30,595 vs stated 31,095 → exception of 500 (root of the cross-statement break)', () => {
    const v = runVerification(makePreparer({
      statementSections: {
        assets: null,
        liabilities: null,
        operations: {
          lineItems: [
            { label: 'Net investment loss', amount: -3_495 },
            { label: 'Net realized and unrealized gain on investments', amount: 34_090 },
          ],
          statedTotal: 31_095,
        },
      },
    }))
    const c = findFamily(v, 'C2').find(c => c.check.includes('Operations'))!
    expect(c.status).toBe('fail')
    expect(c.variance).toContain('500')
  })

  it('C2 ⊄ C4 (HF): balance-sheet equation passing must not suppress a section-footing fail', () => {
    const v = runVerification(makePreparer({
      balanceSheet: {
        totalAssets: 203_915, totalLiabilities: 12_300,
        totalPartnersCapital: 191_615, cashAndEquivalents: null, asOfDate: '2023-12-31',
      },
      statementSections: {
        assets: {
          lineItems: [
            { label: 'Investments at fair value', amount: 185_915 },
            { label: 'Cash and cash equivalents', amount: 15_600 },
            { label: 'Dividends receivable', amount: 2_500 },
          ],
          statedTotal: 203_915,
        },
        liabilities: null,
        operations: null,
      },
    }))
    const c4 = findFamily(v, 'C4')[0]
    const c2 = findFamily(v, 'C2').find(c => c.check.includes('Assets'))!
    expect(c4.status).toBe('pass')      // 12,300 + 191,615 = 203,915 balances
    expect(c2.status).toBe('fail')      // but the line items do not foot
  })

  it('missing line items → unable_to_verify, never a silent pass', () => {
    const v = runVerification(makePreparer({}))
    for (const c of findFamily(v, 'C2')) {
      expect(c.status).toBe('unable_to_verify')
    }
  })
})

// ── C3 — FV hierarchy footing with outlier attribution ───────────────────────

describe('C3 — FV hierarchy footing', () => {
  it('PE: components 187,450 tie to BS line; stated Note 2 total 188,200 is the outlier (+750)', () => {
    const v = runVerification(makePreparer({
      fairValueHierarchy: [{
        periodLabel: 'Q4 2023', asOfDate: '2023-12-31',
        level1: 163_081, level2: 5_000, level3: 19_369,    // sums to 187,450
        statedTotal: 188_200,
        balanceSheetInvestmentsLine: 187_450,
      }],
    }))
    const c = findFamily(v, 'C3')[0]
    expect(c.status).toBe('fail')
    expect(c.variance).toContain('750')
    expect(c.note).toContain('stated total')
    expect(c.note).toContain('outlier')
    expect(c.note).toContain('not to the components')
  })

  it('components tie to the note but not the BS line → BS line is the outlier', () => {
    const v = runVerification(makePreparer({
      fairValueHierarchy: [{
        periodLabel: 'Q4 2023', asOfDate: '2023-12-31',
        level1: 100_000, level2: 50_000, level3: 38_200,
        statedTotal: 188_200,
        balanceSheetInvestmentsLine: 187_450,
      }],
    }))
    const c = findFamily(v, 'C3')[0]
    expect(c.status).toBe('fail')
    expect(c.note).toContain('balance-sheet')
    expect(c.note).toContain('outlier')
  })

  it('components tie to both totals → pass', () => {
    const v = runVerification(makePreparer({
      fairValueHierarchy: [{
        periodLabel: 'Q4 2023', asOfDate: '2023-12-31',
        level1: 100_000, level2: 50_000, level3: 37_450,
        statedTotal: 187_450,
        balanceSheetInvestmentsLine: 187_450,
      }],
    }))
    expect(findFamily(v, 'C3')[0].status).toBe('pass')
  })
})

// ── C4 — balance-sheet equation ───────────────────────────────────────────────

describe('C4 — balance-sheet equation', () => {
  it('PE: assets 203,515 vs liabilities + capital 203,915 → −400 exception', () => {
    const v = runVerification(makePreparer({
      balanceSheet: {
        totalAssets: 203_515, totalLiabilities: 26_790,
        totalPartnersCapital: 177_125, cashAndEquivalents: null, asOfDate: '2023-12-31',
      },
    }))
    const c = findFamily(v, 'C4')[0]
    expect(c.status).toBe('fail')
    expect(c.variance).toContain('-400')
  })
})

// ── C5 — capital-account rollforward (sign-normalized) ────────────────────────

describe('C5 — LP capital rollforward', () => {
  it('distributions captured as displayed (negative) still foot correctly', () => {
    const v = runVerification(makePreparer({
      capitalAccounts: [{
        lpId: 'LP-1', beginningBalance: 100_000,
        contributions: 10_000, distributions: -5_000,   // as displayed
        allocatedIncomeLoss: 2_000, endingBalance: 107_000,
      }],
    }))
    const c = findFamily(v, 'C5')[0]
    expect(c.status).toBe('pass')
  })
})

// ── C6 — rollforward table audit ──────────────────────────────────────────────

describe('C6 — rollforward audit', () => {
  const ironwoodHierarchy = [
    { periodLabel: 'Q3 2023', asOfDate: '2023-09-30', level1: null, level2: null, level3: 207_000, statedTotal: null, balanceSheetInvestmentsLine: null },
    { periodLabel: 'Q4 2023', asOfDate: '2023-12-31', level1: null, level2: null, level3: 228_400, statedTotal: null, balanceSheetInvestmentsLine: null },
  ]

  it('Ironwood: column foots to 277,300 vs stated 279,100 → +1,800 exception; both endpoints disconnect from L3', () => {
    const v = runVerification(makePreparer({
      fairValueHierarchy: ironwoodHierarchy,
      rollforwards: [{
        tableName: 'Level 3 rollforward', subject: 'level3',
        periodLabel: 'Q4 2023',
        beginningBalance: 248_100, beginningPeriodLabel: 'Q3 2023',
        flows: [
          { label: 'Capital calls', amount: 15_000 },
          { label: 'Distributions', amount: -8_200 },
          { label: 'Net unrealized appreciation', amount: 22_400 },
        ],
        statedEndingBalance: 279_100, endingPeriodLabel: 'Q4 2023',
      }],
    }))
    const internal = findFamily(v, 'C6').find(c => c.check.includes('internal footing'))!
    expect(internal.status).toBe('fail')
    expect(internal.variance).toContain('1,800')

    const opening = findFamily(v, 'C6').find(c => c.check.includes('opening'))!
    expect(opening.status).toBe('fail')        // 248,100 vs Q3 L3 207,000
    const ending = findFamily(v, 'C6').find(c => c.check.includes('ending balance vs') || (c.check.includes('endpoint') && c.check.includes('ending')))!
    expect(ending.status).toBe('fail')         // 279,100 vs Q4 L3 228,400
  })

  it('VC: column foots to 254,320 vs stated 264,900 → +10,580 exception; endpoints disconnect (off by liability amounts)', () => {
    const v = runVerification(makePreparer({
      fairValueHierarchy: [
        { periodLabel: 'Q3 2023', asOfDate: '2023-09-30', level1: null, level2: null, level3: 271_240, statedTotal: null, balanceSheetInvestmentsLine: null },
        { periodLabel: 'Q4 2023', asOfDate: '2023-12-31', level1: null, level2: null, level3: 284_720, statedTotal: null, balanceSheetInvestmentsLine: null },
      ],
      rollforwards: [{
        tableName: 'Investment rollforward', subject: 'level3',
        periodLabel: 'Q4 2023',
        beginningBalance: 253_240, beginningPeriodLabel: 'Q3 2023',
        flows: [
          { label: 'Distributions to partners', amount: -12_200 },
          { label: 'Net change in unrealized appreciation', amount: 13_280 },
        ],
        statedEndingBalance: 264_900, endingPeriodLabel: 'Q4 2023',
      }],
    }))
    const internal = findFamily(v, 'C6').find(c => c.check.includes('internal footing'))!
    expect(internal.status).toBe('fail')
    expect(internal.variance).toContain('10,580')

    const endpointFails = findFamily(v, 'C6').filter(c => c.check.includes('endpoint tie') && c.status === 'fail')
    expect(endpointFails).toHaveLength(2)
  })
})

// ── C7 — flow-to-balance / cross-period ───────────────────────────────────────

describe('C7 — flow-to-balance', () => {
  it('Ironwood: Q4 calls 15,000 but cumulative called flat at 290,000 → exception (was a false PASS)', () => {
    const v = runVerification(makePreparer({
      periodCapitalActivity: {
        periodLabel: 'Q4 2023',
        periodCapitalCalls: 15_000, periodDistributions: null,
        cumulativeCalledBeginning: 290_000, cumulativeCalledEnding: 290_000,
        cumulativeDistributionsBeginning: null, cumulativeDistributionsEnding: null,
      },
    }))
    const c = findFamily(v, 'C7').find(c => c.check.includes('capital calls'))!
    expect(c.status).toBe('fail')
  })

  it('VC: no Q4 calls, cumulative called flat at 285,500 → PASS (true negative — must not flag)', () => {
    const v = runVerification(makePreparer({
      periodCapitalActivity: {
        periodLabel: 'Q4 2023',
        periodCapitalCalls: null, periodDistributions: null,
        cumulativeCalledBeginning: 285_500, cumulativeCalledEnding: 285_500,
        cumulativeDistributionsBeginning: null, cumulativeDistributionsEnding: null,
      },
    }))
    const c = findFamily(v, 'C7').find(c => c.check.includes('capital calls'))!
    expect(c.status).toBe('pass')
  })
})

// ── C8 — cross-statement consistency ──────────────────────────────────────────

describe('C8 — cross-statement consistency', () => {
  it('PE: SoC ending 177,625 vs BS capital 177,125 → −500 exception, cross-referencing C2 operations', () => {
    const v = runVerification(makePreparer({
      balanceSheet: {
        totalAssets: null, totalLiabilities: null,
        totalPartnersCapital: 177_125, cashAndEquivalents: null, asOfDate: '2023-12-31',
      },
      statementOfChanges: { periodLabel: 'FY2023', beginningCapital: 152_840, endingCapital: 177_625 },
    }))
    const c = findFamily(v, 'C8')[0]
    expect(c.status).toBe('fail')
    expect(c.variance).toContain('-500')
    expect(c.note).toContain('C2')
  })
})

// ── C9 — date sequencing ──────────────────────────────────────────────────────

describe('C9 — workpaper date sequencing', () => {
  it('PE: reviewed 2024-02-09 before prepared 2024-02-14 → exception', () => {
    const v = runVerification(makePreparer({
      workpaperMetadata: [{
        documentName: 'NAV workpaper', preparedBy: 'A. Smith', preparedDate: '2024-02-14',
        reviewedBy: 'B. Jones', reviewedDate: '2024-02-09',
      }],
    }))
    expect(findFamily(v, 'C9')[0].status).toBe('fail')
  })

  it('HF: reviewed 2024-02-21 after prepared 2024-02-14 → PASS', () => {
    const v = runVerification(makePreparer({
      workpaperMetadata: [{
        documentName: 'NAV workpaper', preparedBy: 'A. Smith', preparedDate: '2024-02-14',
        reviewedBy: 'B. Jones', reviewedDate: '2024-02-21',
      }],
    }))
    expect(findFamily(v, 'C9')[0].status).toBe('pass')
  })
})

// ── C10 — typo / OCR pass ─────────────────────────────────────────────────────

describe('C10 — typo/OCR pass', () => {
  it('PE: surfaces "Decmber", "PAFORMANCE", "substntial" at low severity', () => {
    const v = runVerification(makePreparer({}), [
      { source: 'financial statements', text: 'For the year ended Decmber 31, 2023. FUND PAFORMANCE was substntial.' },
    ])
    const typos = findFamily(v, 'C10')
    const tokens = typos.map(c => c.check.toLowerCase())
    expect(tokens.some(t => t.includes('decmber'))).toBe(true)
    expect(tokens.some(t => t.includes('paformance'))).toBe(true)
    expect(tokens.some(t => t.includes('substntial'))).toBe(true)
    for (const c of typos) expect(c.severityCeiling).toBe('informational')
  })

  it('Ironwood: surfaces "Mangement"', () => {
    const v = runVerification(makePreparer({}), [
      { source: 'notes', text: 'Mangement fees are calculated quarterly.' },
    ])
    expect(findFamily(v, 'C10').some(c => c.check.toLowerCase().includes('mangement'))).toBe(true)
  })

  it('clean text produces no typo checks', () => {
    const v = runVerification(makePreparer({}), [
      { source: 'notes', text: 'December performance was substantial. Management fees and distributions were allocated to the partners quarterly.' },
    ])
    expect(findFamily(v, 'C10')).toHaveLength(0)
  })
})

// ── Preserve list (§7) — behaviors that must survive the refactor ─────────────

describe('preserve — round-1 behaviors', () => {
  it('rounding tolerance: stated TVPI 1.16 vs computed 1.166 → PASS within tolerance', () => {
    const v = runVerification(makePreparer({
      statedPerformanceMetrics: {
        tvpi: 1.16, dpi: 0, rvpi: 1.166, netIrr: null, grossIrr: null,
        moic: null, cumulativeDistributions: null,
      },
    }))
    const c = v.checks.find(c => c.check.includes('TVPI = stated DPI + stated RVPI'))!
    expect(c.status).toBe('pass')
  })

  it('Ironwood: TVPI ≠ DPI + RVPI is a recomputable inconsistency → FAIL (may remain critical per EQR)', () => {
    const v = runVerification(makePreparer({
      statedPerformanceMetrics: {
        tvpi: 1.50, dpi: 0.50, rvpi: 0.80, netIrr: null, grossIrr: null,
        moic: null, cumulativeDistributions: null,
      },
    }))
    const c = v.checks.find(c => c.check.includes('TVPI = stated DPI + stated RVPI'))!
    expect(c.status).toBe('fail')
    expect(c.note).toContain('RECOMPUTABLE')
  })

  it('VC: stated IRR is unverifiable without dated cash flows → severity ceiling WARNING (EQR calibration input)', () => {
    const v = runVerification(makePreparer({
      statedPerformanceMetrics: {
        tvpi: 1.16, dpi: null, rvpi: null, netIrr: 0.184, grossIrr: null,
        moic: null, cumulativeDistributions: null,
      },
    }))
    const c = v.checks.find(c => c.check.includes('net IRR'))!
    expect(c.status).toBe('unable_to_verify')
    expect(c.severityCeiling).toBe('warning')
    expect(c.note).toContain('WARNING')
  })

  it('investments vs NAV without cash/liabilities stays unable_to_verify, never a false error', () => {
    const v = runVerification(makePreparer({
      nav: { total: 100_000, perUnit: null, asOfDate: '2023-12-31' },
      investments: [{
        name: 'PortCo', cost: 50_000, fairValue: 80_000, unrealizedGainLoss: 30_000,
        asOfDate: '2023-12-31', fairValueLevel: 3, valuationMethodology: null,
      }],
    }))
    const c = v.checks.find(c => c.check.includes('Sum of investment fair values'))!
    expect(c.status).toBe('unable_to_verify')
  })
})

// ── Verified figure set + exception list plumbing ─────────────────────────────

describe('verification outputs', () => {
  it('passing checks populate the verified figure set; failing checks populate the exception list', () => {
    const v = runVerification(makePreparer({
      balanceSheet: {
        totalAssets: 203_915, totalLiabilities: 12_300,
        totalPartnersCapital: 191_615, cashAndEquivalents: null, asOfDate: '2023-12-31',
      },
      statementOfChanges: { periodLabel: 'FY2023', beginningCapital: 150_000, endingCapital: 191_115 },
    }))
    expect(v.verifiedFigureSet.some(f => f.label.includes('Total assets') && f.value === 203_915)).toBe(true)
    expect(v.exceptionList.length).toBeGreaterThan(0)               // C8 fails: 191,115 ≠ 191,615
    expect(v.exceptionList.every(c => c.status === 'fail')).toBe(true)
  })
})

// ── normalize.ts unit coverage ────────────────────────────────────────────────

describe('normalize', () => {
  it('classifies rollforward labels: signed beats outflow for P&L lines', () => {
    expect(classifyFlowLabel('Net realized gain on sales')).toBe('signed')
    expect(classifyFlowLabel('Sales of investments')).toBe('outflow')
    expect(classifyFlowLabel('Capital calls')).toBe('inflow')
    expect(classifyFlowLabel('Distributions to partners')).toBe('outflow')
  })

  it('fixed-direction flows discard the extracted sign', () => {
    const bridge = normalizeNavBridge({
      periodLabel: null, beginningNav: 100, contributions: -10, distributions: -5,
      realizedGainLoss: null, unrealizedGainLoss: null, feesAndExpenses: null,
      otherChanges: null, endingNav: 105,
    })!
    expect(bridge.computedEndingNav).toBe(105)   // 100 + |−10| − |−5|
  })
})
