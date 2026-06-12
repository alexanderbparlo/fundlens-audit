/**
 * Seed a read-only DEMO engagement + one completed audit_job into Neon, so the
 * landing page CTAs ("Run a sample audit" / "See a findings report") land on a
 * real, fully-rendered report and pipeline without spending tokens or a key.
 *
 * Subject: Meridian Growth Partners III (PE) — the fund the hero instrument names.
 * The seeded report surfaces that fund's ground-truth discrepancy (see
 * samples/README.md): Schedule of Investments fair value $548.4M vs balance-sheet
 * investments $550.0M, $1.6M unreconciled. That maps to the hero's C7 exception.
 *
 * Idempotent: deletes the fixed-id demo rows first (cascades), then re-inserts.
 * Run from the project root:  node samples/seed-demo.mjs
 */
import { readFileSync } from 'node:fs'
import { neon } from '../node_modules/@neondatabase/serverless/index.mjs'

// ── env ─────────────────────────────────────────────────────────────────────
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not found in .env.local')
const sql = neon(process.env.DATABASE_URL)

// ── fixed identifiers (let the landing CTAs link deterministically) ───────────
export const DEMO_ENG_ID = '00000000-0000-0000-0000-00000000de10'
const DEMO_JOB_ID        = '00000000-0000-0000-0000-00000000d70b'
const PROMPT_VERSION = '1.3.0'
const MODEL_VERSION  = 'claude-opus-4-8'
// Fixed timestamps so the report's "Date Prepared / Reviewed" are stable.
const PREPARED_AT = '2026-06-09T14:20:00Z'
const REVIEWED_AT = '2026-06-09T14:34:00Z'

const FS_DOC  = 'Meridian Growth Partners III — Financial Statements.pdf'
const CAS_DOC = 'Meridian Growth Partners III — Capital Account Statement.pdf'
const LPA_DOC = 'Meridian Growth Partners III — LPA.pdf'

const cite = (documentName, page, section, excerpt) => ({
  documentId: 'demo', documentName, page, section, excerpt,
})

// ── findings (12: 0 critical · 2 warning · 4 informational · 6 pass) ──────────
const findings = [
  {
    id: 'F-001', severity: 'warning', confidence: 'high', category: 'CrossDocument',
    description:
      'The Schedule of Investments reports total fair value of $548,400,000, but the balance sheet carries investments at $550,000,000 — a $1,600,000 difference that does not reconcile. The two figures should be identical.',
    fieldsReferenced: ['scheduleOfInvestments.totalFairValue', 'balanceSheet.investmentsAtFairValue'],
    sourceCitations: [
      cite(FS_DOC, 4, 'Schedule of Investments', 'Total investments, at fair value … 548,400,000'),
      cite(FS_DOC, 2, 'Statement of Assets and Liabilities', 'Investments, at fair value … 550,000,000'),
    ],
    recommendation:
      'Reconcile the Schedule of Investments to the balance sheet. Confirm whether a position was omitted from the schedule or a fair-value adjustment was posted to the balance sheet only, and correct the inconsistent statement before issuance.',
    agent: 'both', requiresHumanVerification: true, relatedFindingIds: ['F-010'],
  },
  {
    id: 'F-002', severity: 'warning', confidence: 'medium', category: 'FeesAndCarry',
    description:
      'Note 7 states carried interest of 20% over an 8% preferred return but does not disclose the GP catch-up percentage. Without the catch-up term, the LP-vs-GP profit split above the preferred return cannot be independently recomputed.',
    fieldsReferenced: ['carriedInterestRate', 'preferredReturn', 'catchUpRate'],
    sourceCitations: [
      cite(FS_DOC, 6, 'Note 7 — Related Party Transactions', 'carried interest of 20% subject to an 8% preferred return'),
      cite(LPA_DOC, 14, 'Section 6 — Distributions', 'Distribution waterfall'),
    ],
    recommendation:
      'Disclose the catch-up percentage and basis in Note 7 (or cross-reference the LPA section) so the carried-interest computation is fully specified.',
    agent: 'reviewer', requiresHumanVerification: false, relatedFindingIds: [],
  },
  {
    id: 'F-003', severity: 'informational', confidence: 'medium', category: 'GAAP_ASC946',
    description:
      'Financial highlights present the expense ratio and net investment income ratio, but the note does not state the denominator basis (average vs. period-end partners’ capital). ASC 946 ratios are typically computed on weighted-average partners’ capital.',
    fieldsReferenced: ['financialHighlights.expenseRatio'],
    sourceCitations: [cite(FS_DOC, 7, 'Financial Highlights', 'Ratio of expenses to average partners’ capital')],
    recommendation: 'Add a sentence specifying the ratio denominator (e.g., weighted-average partners’ capital) for clarity.',
    agent: 'reviewer', requiresHumanVerification: false, relatedFindingIds: [],
  },
  {
    id: 'F-004', severity: 'informational', confidence: 'high', category: 'FundTerms',
    description:
      'The LPA discloses a 10-year term with two permitted one-year extensions and a 5-year investment period. The financial-statement notes restate the term but omit the extension provision. The omission is immaterial to the figures.',
    fieldsReferenced: ['fundTerm', 'investmentPeriod'],
    sourceCitations: [
      cite(LPA_DOC, 3, 'Section 2 — Term', 'ten (10) years … two (2) one-year extensions'),
      cite(FS_DOC, 5, 'Note 1 — Organization', 'The Fund has a ten-year term'),
    ],
    recommendation: 'Consider restating the extension provision in Note 1 so the governance disclosure is complete.',
    agent: 'reviewer', requiresHumanVerification: false, relatedFindingIds: [],
  },
  {
    id: 'F-005', severity: 'informational', confidence: 'medium', category: 'Completeness',
    description:
      'The subsequent-events note covers the period through the report date and discloses no material events. No auditor’s report was provided with the statement set, so the audit opinion type could not be confirmed.',
    fieldsReferenced: ['subsequentEvents'],
    sourceCitations: [cite(FS_DOC, 7, 'Note 9 — Subsequent Events', 'Management has evaluated subsequent events through')],
    recommendation: 'Provide the independent auditor’s report to confirm the opinion type and audit firm.',
    agent: 'reviewer', requiresHumanVerification: false, relatedFindingIds: [],
  },
  {
    id: 'F-006', severity: 'informational', confidence: 'high', category: 'InvestmentSchedule',
    description:
      'The Schedule of Investments lists 14 portfolio positions; the top five represent 58% of total fair value. The concentration is disclosed and consistent with ASC 275 risk-and-uncertainty expectations.',
    fieldsReferenced: ['scheduleOfInvestments.positions'],
    sourceCitations: [cite(FS_DOC, 4, 'Schedule of Investments', '14 portfolio companies')],
    recommendation: 'No action required. Concentration disclosure is adequate.',
    agent: 'challenger', requiresHumanVerification: false, relatedFindingIds: [],
  },
  {
    id: 'F-007', severity: 'pass', confidence: 'high', category: 'NAV',
    description:
      'The NAV bridge reconciles: beginning partners’ capital, plus contributions, less distributions, plus net increase in net assets, ties to ending partners’ capital across the Statement of Changes and the balance sheet.',
    fieldsReferenced: ['navBridge', 'partnersCapital'],
    sourceCitations: [cite(FS_DOC, 3, 'Statement of Changes in Partners’ Capital', 'Ending partners’ capital')],
    recommendation: 'No action required.',
    agent: 'reviewer', requiresHumanVerification: false, relatedFindingIds: [],
  },
  {
    id: 'F-008', severity: 'pass', confidence: 'high', category: 'CapitalAccounts',
    description:
      'The LP capital-account rollforward foots internally and the per-LP ending balances tie pro rata to fund-level partners’ capital.',
    fieldsReferenced: ['capitalAccounts'],
    sourceCitations: [cite(CAS_DOC, 1, 'Capital Account Statement', 'Ending capital account balance')],
    recommendation: 'No action required.',
    agent: 'reviewer', requiresHumanVerification: false, relatedFindingIds: [],
  },
  {
    id: 'F-009', severity: 'pass', confidence: 'high', category: 'GAAP_ASC946',
    description:
      'The fair-value hierarchy footing ties: Level 1 + Level 2 + Level 3 investments sum to total investments at fair value as presented in Note 3.',
    fieldsReferenced: ['fairValueHierarchy'],
    sourceCitations: [cite(FS_DOC, 5, 'Note 3 — Fair Value Measurements', 'Total … Level 3')],
    recommendation: 'No action required.',
    agent: 'challenger', requiresHumanVerification: false, relatedFindingIds: [],
  },
  {
    id: 'F-010', severity: 'pass', confidence: 'high', category: 'CrossDocument',
    description:
      'The LP capital account statement ties pro rata to fund-level partners’ capital on the balance sheet, and committed/called capital is consistent between the LPA and the financial-statement notes.',
    fieldsReferenced: ['calledCapital', 'totalCommitments'],
    sourceCitations: [
      cite(CAS_DOC, 1, 'Capital Account Statement', 'Called capital'),
      cite(LPA_DOC, 2, 'Section 1 — Commitments', 'Aggregate commitments'),
    ],
    recommendation: 'No action required.',
    agent: 'reviewer', requiresHumanVerification: false, relatedFindingIds: ['F-001'],
  },
  {
    id: 'F-011', severity: 'pass', confidence: 'high', category: 'FundTerms',
    description:
      'The management fee of 2.0% of committed capital during the investment period is consistent between the LPA and Note 7 of the financial statements.',
    fieldsReferenced: ['managementFeeRate'],
    sourceCitations: [
      cite(LPA_DOC, 12, 'Section 5 — Management Fee', '2.0% per annum of aggregate commitments'),
      cite(FS_DOC, 6, 'Note 7 — Related Party Transactions', 'management fee of 2.0%'),
    ],
    recommendation: 'No action required.',
    agent: 'reviewer', requiresHumanVerification: false, relatedFindingIds: [],
  },
  {
    id: 'F-012', severity: 'pass', confidence: 'high', category: 'NAV',
    description:
      'Date sequencing is consistent (period end precedes report date precedes subsequent-events evaluation date) and the OCR/typo pass found no anomalies in figures or defined terms.',
    fieldsReferenced: ['workpaperMetadata'],
    sourceCitations: [cite(FS_DOC, 1, 'Cover', 'For the year ended December 31, 2024')],
    recommendation: 'No action required.',
    agent: 'reviewer', requiresHumanVerification: false, relatedFindingIds: [],
  },
]

const crossDocumentValidations = [
  {
    check: 'Schedule of Investments total fair value vs. balance-sheet investments',
    documentsCompared: [FS_DOC],
    expected: '$550,000,000', found: '$548,400,000',
    variance: '-$1,600,000 (-0.29%)', status: 'fail', severity: 'warning',
    sourceCitations: [
      cite(FS_DOC, 4, 'Schedule of Investments', 'Total investments, at fair value … 548,400,000'),
      cite(FS_DOC, 2, 'Statement of Assets and Liabilities', 'Investments, at fair value … 550,000,000'),
    ],
  },
  {
    check: 'LP capital account vs. fund-level partners’ capital (pro rata)',
    documentsCompared: [CAS_DOC, FS_DOC],
    expected: 'consistent', found: 'consistent', variance: null,
    status: 'pass', severity: 'pass', sourceCitations: [],
  },
  {
    check: 'Management fee per LPA vs. Note 7',
    documentsCompared: [LPA_DOC, FS_DOC],
    expected: '2.0% of committed capital', found: '2.0% of committed capital', variance: null,
    status: 'pass', severity: 'pass', sourceCitations: [],
  },
]

const riskMatrix = [
  { category: 'NAV',               critical: 0, warning: 0, informational: 0, pass: 2 },
  { category: 'CapitalAccounts',   critical: 0, warning: 0, informational: 0, pass: 1 },
  { category: 'FeesAndCarry',      critical: 0, warning: 1, informational: 0, pass: 0 },
  { category: 'GAAP_ASC946',       critical: 0, warning: 0, informational: 1, pass: 1 },
  { category: 'FundTerms',         critical: 0, warning: 0, informational: 1, pass: 1 },
  { category: 'Completeness',      critical: 0, warning: 0, informational: 1, pass: 0 },
  { category: 'InvestmentSchedule',critical: 0, warning: 0, informational: 1, pass: 0 },
  { category: 'CrossDocument',     critical: 0, warning: 1, informational: 0, pass: 1 },
]

const report = {
  executiveSummary:
    'Meridian Growth Partners III presents financial statements that are internally consistent across the NAV bridge, capital-account rollforward, and fair-value hierarchy, with fund terms tying to the LPA. One reconciling exception warrants attention: the Schedule of Investments understates total fair value by $1,600,000 relative to the balance sheet. A second, presentational item — an undisclosed carried-interest catch-up percentage — limits independent recomputation of the GP profit split. Neither item indicates pervasive misstatement, and the overall document set is well-supported. We recommend resolving the $1.6M investment variance before the statements are finalized.',
  overallRiskRating: 'medium',
  overallScore: 7,
  categoryScores: [
    { category: 'NAV',            score: 9, rationale: 'NAV bridge and partners’ capital reconcile cleanly across all statements.' },
    { category: 'CrossDocument',  score: 6, rationale: 'One unreconciled $1.6M variance between the Schedule of Investments and the balance sheet.' },
    { category: 'FeesAndCarry',   score: 7, rationale: 'Fee terms tie to the LPA; the carried-interest catch-up percentage is undisclosed.' },
    { category: 'GAAP_ASC946',    score: 8, rationale: 'Presentation is consistent with ASC 946; a minor ratio-basis disclosure gap remains.' },
  ],
  findings,
  crossDocumentValidations,
  riskMatrix,
  openItems: [
    {
      description: 'Resolve the $1,600,000 difference between the Schedule of Investments and the balance-sheet investment balance.',
      requiresHumanReview: true,
      rationale: 'A fair-value total that does not tie across statements must be reconciled before issuance.',
    },
    {
      description: 'Obtain the independent auditor’s report to confirm the opinion type and audit firm.',
      requiresHumanReview: true,
      rationale: 'No auditor’s report was included in the document set.',
    },
  ],
  pbcList: [
    {
      id: 'PBC-01', priority: 'high', requestedFrom: 'Fund Administrator',
      description: 'Investment-level fair-value roll showing how the Schedule of Investments ($548.4M) reconciles to the balance sheet ($550.0M).',
      relatedFindingIds: ['F-001'], documentType: 'InvestmentSchedule',
    },
    {
      id: 'PBC-02', priority: 'medium', requestedFrom: 'General Partner',
      description: 'Carried-interest waterfall worksheet disclosing the catch-up percentage and basis.',
      relatedFindingIds: ['F-002'], documentType: 'ManagementFeeCalculation',
    },
    {
      id: 'PBC-03', priority: 'medium', requestedFrom: 'Auditor',
      description: 'Signed independent auditor’s report for the year ended December 31, 2024.',
      relatedFindingIds: ['F-005'], documentType: 'AuditorReport',
    },
  ],
  recommendedNextSteps: [
    { priority: 1, action: 'Reconcile the $1.6M Schedule of Investments vs. balance-sheet fair-value variance and correct the inconsistent statement.', urgency: 'immediate' },
    { priority: 2, action: 'Obtain the carried-interest catch-up disclosure and the independent auditor’s report.', urgency: 'before_finalization' },
    { priority: 3, action: 'Add the ratio-denominator basis and the LPA extension provision to the relevant notes.', urgency: 'near_term' },
  ],
  documentSetCompleteness: {
    provided: ['FinancialStatements', 'CapitalAccountStatement', 'LPA'],
    recommended: ['FinancialStatements', 'CapitalAccountStatement', 'LPA', 'AuditorReport'],
    missing: ['AuditorReport'],
    completenessNote:
      'Core statement set, capital account, and LPA were provided and are sufficient for a substantive review. The independent auditor’s report was not included; its absence is noted rather than treated as a deficiency.',
  },
  promptVersion: PROMPT_VERSION,
  modelVersion: MODEL_VERSION,
}

// ── deterministic verification snapshot (Track D) — C7 fails, matching the hero
const checks = [
  { id: 'D-001', family: 'C1',  check: 'NAV bridge reconciliation',            expected: '$612,300,000', found: '$612,300,000', variance: null, status: 'pass', severityCeiling: null, note: null },
  { id: 'D-002', family: 'C2',  check: 'Section footing (line items → subtotal)', expected: 'foots',     found: 'foots',        variance: null, status: 'pass', severityCeiling: null, note: null },
  { id: 'D-003', family: 'C3',  check: 'Fair-value hierarchy footing',          expected: '$550,000,000', found: '$550,000,000', variance: null, status: 'pass', severityCeiling: null, note: null },
  { id: 'D-004', family: 'C4',  check: 'Balance-sheet equation',                expected: 'A = L + Cap',  found: 'A = L + Cap',  variance: null, status: 'pass', severityCeiling: null, note: null },
  { id: 'D-005', family: 'C5',  check: 'Capital-account rollforward (per-LP)',  expected: 'ties',        found: 'ties',         variance: null, status: 'pass', severityCeiling: null, note: null },
  { id: 'D-006', family: 'C6',  check: 'Rollforward table audit',              expected: 'foots + ties', found: 'foots + ties', variance: null, status: 'pass', severityCeiling: null, note: null },
  {
    id: 'D-007', family: 'C7', check: 'Flow-to-balance / cross-statement fair value',
    expected: '$550,000,000', found: '$548,400,000', variance: '-$1,600,000 (-0.29%)',
    status: 'fail', severityCeiling: 'warning',
    note: 'Schedule of Investments total fair value does not tie to the balance-sheet investment balance.',
  },
  { id: 'D-008', family: 'C8',  check: 'Cross-statement consistency',           expected: 'consistent',  found: 'consistent',   variance: null, status: 'pass', severityCeiling: null, note: null },
  { id: 'D-009', family: 'C9',  check: 'Date sequencing',                       expected: 'ordered',     found: 'ordered',      variance: null, status: 'pass', severityCeiling: null, note: null },
  { id: 'D-010', family: 'C10', check: 'Typo / OCR-quality pass',               expected: 'clean',       found: 'clean',        variance: null, status: 'pass', severityCeiling: null, note: null },
]
const verification = {
  checks,
  verifiedFigureSet: [
    { label: 'Ending partners’ capital', value: 612300000, verifiedBy: ['D-001', 'D-004'] },
    { label: 'Total investments at fair value (balance sheet)', value: 550000000, verifiedBy: ['D-003', 'D-004'] },
  ],
  exceptionList: checks.filter(c => c.status === 'fail'),
}

// ── write ─────────────────────────────────────────────────────────────────────
async function main() {
  // Idempotent: remove any prior demo rows (cascades to audit_jobs / finding_statuses / documents).
  await sql`DELETE FROM engagements WHERE id = ${DEMO_ENG_ID}`

  await sql`
    INSERT INTO engagements (id, name, fund_name, fund_type, description, created_at, updated_at)
    VALUES (
      ${DEMO_ENG_ID},
      ${'Meridian Growth Partners III — Sample Audit'},
      ${'Meridian Growth Partners III'},
      ${'PE'},
      ${'Read-only demo engagement powering the landing-page sample report. Synthetic data — see samples/README.md.'},
      ${PREPARED_AT}, ${REVIEWED_AT}
    )
  `

  await sql`
    INSERT INTO audit_jobs (
      id, engagement_id, status, fund_type, audit_scope, document_ids, control_run,
      preparer_output, verification, reviewer_output, challenger_output, final_report,
      error_message, prompt_version, model_version, created_at, completed_at
    ) VALUES (
      ${DEMO_JOB_ID}, ${DEMO_ENG_ID}, ${'complete'}, ${'PE'}, ${'full'}, ${'{}'}, ${false},
      ${null}, ${JSON.stringify(verification)}::jsonb, ${null}, ${null}, ${JSON.stringify(report)}::jsonb,
      ${null}, ${PROMPT_VERSION}, ${MODEL_VERSION}, ${PREPARED_AT}, ${REVIEWED_AT}
    )
  `

  await sql`
    UPDATE engagements SET audit_job_ids = ARRAY[${DEMO_JOB_ID}]::uuid[] WHERE id = ${DEMO_ENG_ID}
  `

  // Verify round-trip
  const [job] = await sql`SELECT status, jsonb_array_length(final_report->'findings') AS n_findings,
    jsonb_array_length(verification->'exceptionList') AS n_exceptions FROM audit_jobs WHERE id = ${DEMO_JOB_ID}`
  console.log('Seeded demo engagement:', DEMO_ENG_ID)
  console.log('Seeded demo audit_job: ', DEMO_JOB_ID)
  console.log('  status:', job.status, '· findings:', job.n_findings, '· exceptions:', job.n_exceptions)
  console.log('\nLanding CTAs should link to:')
  console.log('  Run a sample audit  → /app?view=pipeline&eng=' + DEMO_ENG_ID)
  console.log('  See a findings report → /app?view=report&eng=' + DEMO_ENG_ID)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
