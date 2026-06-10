// ─────────────────────────────────────────────────────────────────────────────
// FundLens Audit — canonical TypeScript types
// These mirror the JSON schemas that agents produce and Zod validates.
// Do not add fields here without updating src/lib/zod/schemas.ts.
// ─────────────────────────────────────────────────────────────────────────────

// ── Enumerations ─────────────────────────────────────────────────────────────

export type FundType = 'PE' | 'VC' | 'HF' | 'Credit' | 'RealEstate'

export type DocumentCategory =
  | 'LPA'
  | 'PPM'
  | 'SubscriptionAgreement'
  | 'FinancialStatements'
  | 'CapitalAccountStatement'
  | 'InvestmentSchedule'
  | 'SideLetter'
  | 'AuditorReport'
  | 'ValuationReport'
  | 'K1'
  | 'ManagementFeeCalculation'
  | 'BoardMinutes'
  | 'Other'
  | 'Unknown'

export type FindingSeverity = 'critical' | 'warning' | 'informational' | 'pass'
export type FindingConfidence = 'high' | 'medium' | 'low'
export type FindingAgent = 'reviewer' | 'challenger' | 'both'
export type FindingStatus = 'open' | 'reviewed' | 'accepted_risk' | 'resolved'

export type FindingCategory =
  | 'NAV'
  | 'CapitalAccounts'
  | 'FeesAndCarry'
  | 'GAAP_ASC946'
  | 'InvestmentSchedule'
  | 'FundTerms'
  | 'Completeness'
  | 'CrossDocument'

export type CrossValidationStatus = 'pass' | 'fail' | 'unable_to_verify'
export type OverallRiskRating = 'low' | 'medium' | 'high' | 'critical'
export type ValidationStatus = 'compliant' | 'non_compliant' | 'unable_to_assess'
export type BenchmarkAssessment = 'market' | 'above_market' | 'below_market' | 'lp_adverse' | 'unable_to_assess'
export type PBCPriority = 'high' | 'medium' | 'low'
export type NextStepUrgency = 'immediate' | 'near_term' | 'before_finalization'
export type FairValueLevel = 1 | 2 | 3
export type ManagementFeeBase = 'committed' | 'invested' | 'nav'
export type WaterfallType = 'deal_by_deal' | 'whole_fund' | 'hybrid'

export type AuditJobStatus =
  | 'queued'
  | 'profiling'
  | 'preparing'
  | 'reviewing'
  | 'challenging'
  | 'synthesizing'
  | 'complete'
  | 'failed'

export type AuditScope = 'full' | 'partial'

// ── Source citations ──────────────────────────────────────────────────────────

export interface SourceCitation {
  documentId: string
  documentName: string
  page: number | null
  section: string | null
  excerpt: string | null
}

// ── Documents ─────────────────────────────────────────────────────────────────

export interface DocumentProfile {
  documentType: DocumentCategory
  fundName: string | null
  periodEnd: string | null          // ISO date
  keyFacts: string[]                // max 20 complete sentences with values
  sectionIndex: { title: string; page: number }[]
  warningFlags: string[]            // formatting issues, image-heavy pages, incompleteness
  estimatedPageCount: number | null
}

export interface FundDocument {
  id: string
  engagementId: string | null       // isolation boundary; null only on legacy rows
  contentHash: string               // SHA-256 for deduplication (scoped per engagement)
  filename: string
  fileType: string                  // 'application/pdf' | docx mime
  blobUrl: string
  fileSizeBytes: number
  detectedCategory: DocumentCategory
  profileJson: DocumentProfile | null
  profiledAt: string | null
  createdAt: string
}

// ── Engagements ───────────────────────────────────────────────────────────────

export interface Engagement {
  id: string
  name: string                      // e.g. "Acme Capital Fund III — Annual Review 2025"
  fundName: string
  fundType: FundType
  description: string | null
  documentIds: string[]
  auditJobIds: string[]
  createdAt: string
  updatedAt: string
}

// ── Preparer output ───────────────────────────────────────────────────────────

export interface PreparerOutput {
  fundName: string
  fundType: FundType
  vintageYear: number | null
  fiscalYearEnd: string             // ISO date
  currency: string
  totalCommittedCapital: number | null
  calledCapital: number | null
  uncalledCapital: number | null
  nav: {
    total: number
    perUnit: number | null
    asOfDate: string
  } | null
  capitalAccounts: {
    lpId: string
    beginningBalance: number | null   // as explicitly disclosed — never inferred
    contributions: number
    distributions: number
    allocatedIncomeLoss: number
    endingBalance: number
  }[]
  // Stated performance metrics as disclosed in the documents — extracted verbatim,
  // never computed. Deterministic code recomputes and compares (src/lib/validations.ts).
  statedPerformanceMetrics: {
    tvpi: number | null
    dpi: number | null
    rvpi: number | null
    netIrr: number | null             // decimal, e.g. 0.184 for 18.4%
    grossIrr: number | null
    moic: number | null
    cumulativeDistributions: number | null
  } | null
  balanceSheet: {
    totalAssets: number | null
    totalLiabilities: number | null
    totalPartnersCapital: number | null   // or net assets
    cashAndEquivalents: number | null
    asOfDate: string | null
  } | null
  // Period capital activity bridge as disclosed (quarterly or annual)
  navBridge: {
    periodLabel: string | null        // e.g. "Q4 2023"
    beginningNav: number | null
    contributions: number | null
    distributions: number | null
    realizedGainLoss: number | null
    unrealizedGainLoss: number | null
    feesAndExpenses: number | null
    otherChanges: number | null
    endingNav: number | null
  } | null
  valuationDisclosures: {
    independentValuationFirm: string | null   // named third-party firm, if disclosed
    independentValuationScope: string | null  // e.g. ">80% of portfolio fair value"
    methodologySummary: string | null         // prose summary of valuation methodology section
    unobservableInputsDisclosed: boolean | null
  } | null
  // Preparer/reviewer sign-off metadata from audit workpapers
  workpaperMetadata: {
    documentName: string
    preparedBy: string | null
    preparedDate: string | null       // ISO date
    reviewedBy: string | null
    reviewedDate: string | null       // ISO date
  }[]
  investments: {
    name: string
    cost: number
    fairValue: number
    unrealizedGainLoss: number
    asOfDate: string
    fairValueLevel: FairValueLevel | null
    valuationMethodology: string | null
  }[]
  feeTerms: {
    managementFeeRate: number | null
    managementFeeBase: ManagementFeeBase | null
    carriedInterestRate: number | null
    preferredReturn: number | null
    hurdleRate: number | null
    catchUpRate: number | null
    waterfallType: WaterfallType | null
    gpCommitmentPercent: number | null
    clawbackPresent: boolean | null
    clawbackTerms: string | null
    feeOffsets: string | null
  }
  investmentPeriod: {
    startDate: string | null
    endDate: string | null
    hasSteppedDown: boolean | null
  } | null
  fundTerm: {
    years: number | null
    extensionProvisions: string | null
    gpUnilateralExtension: boolean | null
  } | null
  keyPersonProvisions: {
    present: boolean
    namedPersons: string[]
    triggerEvents: string[]
    consequences: string[]        // 'suspension' | 'termination' | 'key_person_vote'
  } | null
  sideLetters: {
    present: boolean
    count: number | null
    summaryNotes: string[]
  }
  ericaStatus: {
    planAssetsApplicable: boolean | null
    notes: string | null
  } | null
  ascDisclosures: {
    fairValueHierarchyPresent: boolean
    investmentCompanyGuidanceCited: boolean
    financialHighlightsPresent: boolean | null
    subsequentEventsDisclosed: boolean | null
    relatedPartyDisclosuresPresent: boolean | null
    scheduleOfInvestmentsPresent: boolean | null
  }
  auditFirm: string | null
  sourceCitations: Record<string, SourceCitation>   // key = field path
  promptVersion: string
  modelVersion: string
}

// ── Findings ──────────────────────────────────────────────────────────────────

export interface Finding {
  id: string
  severity: FindingSeverity
  confidence: FindingConfidence
  category: FindingCategory
  description: string
  fieldsReferenced: string[]
  sourceCitations: SourceCitation[]
  recommendation: string
  agent: FindingAgent
  requiresHumanVerification: boolean
  relatedFindingIds: string[]
}

export interface CrossDocumentValidation {
  check: string
  documentsCompared: string[]
  expected: string
  found: string
  variance: string | null
  status: CrossValidationStatus
  severity: FindingSeverity
  sourceCitations: SourceCitation[]
}

// ── Reviewer output ───────────────────────────────────────────────────────────

export interface ILPACheck {
  principle: string
  status: ValidationStatus
  notes: string
}

export interface ReviewerOutput {
  findings: Finding[]
  crossDocumentValidations: CrossDocumentValidation[]
  ilpaComplianceChecks: ILPACheck[]
  promptVersion: string
  modelVersion: string
}

// ── Challenger output ─────────────────────────────────────────────────────────

export interface ChallengeItem extends Finding {
  targetFindingId: string | null    // null = new finding; populated = challenges Reviewer conclusion
  adversarialArgument: string       // the specific challenge raised
}

export interface BenchmarkComparison {
  field: string
  fundValue: string
  marketStandard: string
  assessment: BenchmarkAssessment
  notes: string
}

export interface ChallengerOutput {
  challenges: ChallengeItem[]
  benchmarkComparisons: BenchmarkComparison[]
  promptVersion: string
  modelVersion: string
}

// ── Synthesizer / final report ────────────────────────────────────────────────

export interface CategoryScore {
  category: FindingCategory
  score: number                     // 1–10
  rationale: string
}

export interface PBCItem {
  id: string
  priority: PBCPriority
  requestedFrom: string             // e.g. "Fund Administrator" | "General Partner" | "Auditor"
  description: string               // specific, actionable document or data request
  relatedFindingIds: string[]
  documentType: DocumentCategory | null
}

export interface RiskMatrixRow {
  category: FindingCategory
  critical: number
  warning: number
  informational: number
  pass: number
}

export interface OpenItem {
  description: string
  requiresHumanReview: boolean
  rationale: string
}

export interface RecommendedNextStep {
  priority: number
  action: string
  urgency: NextStepUrgency
}

export interface DocumentSetCompleteness {
  provided: DocumentCategory[]
  recommended: DocumentCategory[]
  missing: DocumentCategory[]
  completenessNote: string
}

export interface SynthesisReport {
  executiveSummary: string          // 3–5 sentences, investment-committee language
  overallRiskRating: OverallRiskRating
  overallScore: number              // 1–10
  categoryScores: CategoryScore[]
  findings: Finding[]               // merged, deduplicated, with resolution note
  crossDocumentValidations: CrossDocumentValidation[]
  riskMatrix: RiskMatrixRow[]
  openItems: OpenItem[]
  pbcList: PBCItem[]
  recommendedNextSteps: RecommendedNextStep[]
  documentSetCompleteness: DocumentSetCompleteness
  promptVersion: string
  modelVersion: string
}

// ── Audit job ─────────────────────────────────────────────────────────────────

export interface AuditJob {
  id: string
  engagementId: string
  status: AuditJobStatus
  fundType: FundType
  auditScope: AuditScope
  documentIds: string[]
  preparerOutput: PreparerOutput | null
  reviewerOutput: ReviewerOutput | null
  challengerOutput: ChallengerOutput | null
  finalReport: SynthesisReport | null
  errorMessage: string | null
  promptVersion: string
  modelVersion: string
  createdAt: string
  completedAt: string | null
}

// ── Finding status (user-managed, stored separately) ─────────────────────────

export interface FindingStatusRecord {
  findingId: string
  jobId: string
  status: FindingStatus
  note: string | null
  updatedAt: string
}

// ── API response envelope ─────────────────────────────────────────────────────

export interface ApiSuccess<T> { success: true; data: T }
export interface ApiError { success: false; error: string }
export type ApiResponse<T> = ApiSuccess<T> | ApiError
