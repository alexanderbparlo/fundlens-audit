import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Zod validation schemas — mirror src/types/index.ts exactly.
// Every agent output is validated against its schema before being passed
// downstream. Invalid output triggers a controlled retry with a correction prompt.
// ─────────────────────────────────────────────────────────────────────────────

// ── Shared ────────────────────────────────────────────────────────────────────

const sourceCitationSchema = z.object({
  documentId:   z.string(),
  documentName: z.string(),
  page:         z.number().int().nonnegative().nullable(),
  section:      z.string().nullable(),
  excerpt:      z.string().nullable(),
})

const findingSeveritySchema  = z.enum(['critical', 'warning', 'informational', 'pass'])
const findingConfidenceSchema = z.enum(['high', 'medium', 'low'])
const findingCategorySchema  = z.enum([
  'NAV', 'CapitalAccounts', 'FeesAndCarry', 'GAAP_ASC946',
  'InvestmentSchedule', 'FundTerms', 'Completeness', 'CrossDocument',
])

const baseFindingSchema = z.object({
  id:                      z.string().min(1),
  severity:                findingSeveritySchema,
  confidence:              findingConfidenceSchema,
  category:                findingCategorySchema,
  description:             z.string().min(10),
  fieldsReferenced:        z.array(z.string()),
  sourceCitations:         z.array(sourceCitationSchema),
  recommendation:          z.string().min(10),
  agent:                   z.enum(['reviewer', 'challenger', 'both']),
  requiresHumanVerification: z.boolean(),
  relatedFindingIds:       z.array(z.string()),
})

const crossDocumentValidationSchema = z.object({
  check:             z.string(),
  documentsCompared: z.array(z.string()),
  expected:          z.string(),
  found:             z.string(),
  variance:          z.string().nullable(),
  status:            z.enum(['pass', 'fail', 'unable_to_verify']),
  severity:          findingSeveritySchema,
  sourceCitations:   z.array(sourceCitationSchema),
})

// ── DocumentProfile (Profiler output) ────────────────────────────────────────

export const documentProfileSchema = z.object({
  documentType: z.enum([
    'LPA','PPM','SubscriptionAgreement','FinancialStatements',
    'CapitalAccountStatement','InvestmentSchedule','SideLetter',
    'AuditorReport','ValuationReport','K1','ManagementFeeCalculation',
    'BoardMinutes','Other','Unknown',
  ]),
  fundName:           z.string().nullable(),
  periodEnd:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  keyFacts:           z.array(z.string()).max(20),
  sectionIndex:       z.array(z.object({ title: z.string(), page: z.number().int() })),
  warningFlags:       z.array(z.string()),
  estimatedPageCount: z.number().int().positive().nullable(),
})

// ── PreparerOutput ────────────────────────────────────────────────────────────
// Plausibility bounds: fee rates 0–40%, preferred return 0–25%, GP commit 0–10%.

const statementLineItemSchema = z.object({
  label:  z.string(),
  amount: z.number(),
})

const statementSectionSchema = z.object({
  lineItems:   z.array(statementLineItemSchema),
  statedTotal: z.number().nullable(),
})

export const preparerOutputSchema = z.object({
  fundName:             z.string().min(1),
  fundType:             z.enum(['PE','VC','HF','Credit','RealEstate']),
  vintageYear:          z.number().int().min(1980).max(2035).nullable(),
  fiscalYearEnd:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency:             z.string().length(3),
  totalCommittedCapital: z.number().positive().nullable(),
  calledCapital:         z.number().nonnegative().nullable(),
  uncalledCapital:       z.number().nonnegative().nullable(),
  nav: z.object({
    total:      z.number(),
    perUnit:    z.number().nullable(),
    asOfDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).nullable(),
  capitalAccounts: z.array(z.object({
    lpId:               z.string(),
    beginningBalance:   z.number().nullable(),
    contributions:      z.number().nonnegative(),
    distributions:      z.number().nonnegative(),
    allocatedIncomeLoss: z.number(),
    endingBalance:       z.number(),
  })),
  statedPerformanceMetrics: z.object({
    tvpi:                    z.number().nonnegative().nullable(),
    dpi:                     z.number().nonnegative().nullable(),
    rvpi:                    z.number().nonnegative().nullable(),
    netIrr:                  z.number().min(-1).max(3).nullable(),   // plausibility: -100% to 300%
    grossIrr:                z.number().min(-1).max(3).nullable(),
    moic:                    z.number().nonnegative().nullable(),
    cumulativeDistributions: z.number().nonnegative().nullable(),
  }).nullable(),
  balanceSheet: z.object({
    totalAssets:          z.number().nullable(),
    totalLiabilities:     z.number().nullable(),
    totalPartnersCapital: z.number().nullable(),
    cashAndEquivalents:   z.number().nullable(),
    asOfDate:             z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  }).nullable(),
  navBridge: z.object({
    periodLabel:        z.string().nullable(),
    beginningNav:       z.number().nullable(),
    contributions:      z.number().nullable(),
    distributions:      z.number().nullable(),
    realizedGainLoss:   z.number().nullable(),
    unrealizedGainLoss: z.number().nullable(),
    feesAndExpenses:    z.number().nullable(),
    otherChanges:       z.number().nullable(),
    endingNav:          z.number().nullable(),
  }).nullable(),
  statementSections: z.object({
    assets:      statementSectionSchema.nullable(),
    liabilities: statementSectionSchema.nullable(),
    operations:  statementSectionSchema.nullable(),
  }).nullable(),
  fairValueHierarchy: z.array(z.object({
    periodLabel:                 z.string().nullable(),
    asOfDate:                    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    level1:                      z.number().nullable(),
    level2:                      z.number().nullable(),
    level3:                      z.number().nullable(),
    statedTotal:                 z.number().nullable(),
    balanceSheetInvestmentsLine: z.number().nullable(),
  })),
  rollforwards: z.array(z.object({
    tableName:            z.string(),
    subject:              z.enum(['investments', 'level3', 'capital', 'other']),
    periodLabel:          z.string().nullable(),
    beginningBalance:     z.number().nullable(),
    beginningPeriodLabel: z.string().nullable(),
    flows:                z.array(statementLineItemSchema),
    statedEndingBalance:  z.number().nullable(),
    endingPeriodLabel:    z.string().nullable(),
  })),
  periodCapitalActivity: z.object({
    periodLabel:                       z.string().nullable(),
    periodCapitalCalls:                z.number().nullable(),
    periodDistributions:               z.number().nullable(),
    cumulativeCalledBeginning:         z.number().nullable(),
    cumulativeCalledEnding:            z.number().nullable(),
    cumulativeDistributionsBeginning:  z.number().nullable(),
    cumulativeDistributionsEnding:     z.number().nullable(),
  }).nullable(),
  statementOfChanges: z.object({
    periodLabel:      z.string().nullable(),
    beginningCapital: z.number().nullable(),
    endingCapital:    z.number().nullable(),
  }).nullable(),
  valuationDisclosures: z.object({
    independentValuationFirm:    z.string().nullable(),
    independentValuationScope:   z.string().nullable(),
    methodologySummary:          z.string().nullable(),
    unobservableInputsDisclosed: z.boolean().nullable(),
  }).nullable(),
  workpaperMetadata: z.array(z.object({
    documentName: z.string(),
    preparedBy:   z.string().nullable(),
    preparedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    reviewedBy:   z.string().nullable(),
    reviewedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  })),
  investments: z.array(z.object({
    name:                z.string(),
    cost:                z.number(),
    fairValue:           z.number(),
    unrealizedGainLoss:  z.number(),
    asOfDate:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    fairValueLevel:      z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
    valuationMethodology: z.string().nullable(),
  })),
  feeTerms: z.object({
    managementFeeRate:   z.number().min(0).max(0.40).nullable(),  // plausibility: 0–40%
    managementFeeBase:   z.enum(['committed','invested','nav']).nullable(),
    carriedInterestRate: z.number().min(0).max(0.40).nullable(),
    preferredReturn:     z.number().min(0).max(0.25).nullable(),
    hurdleRate:          z.number().min(0).max(0.25).nullable(),
    catchUpRate:         z.number().min(0).max(1.0).nullable(),
    waterfallType:       z.enum(['deal_by_deal','whole_fund','hybrid']).nullable(),
    gpCommitmentPercent: z.number().min(0).max(0.10).nullable(),  // 0–10%
    clawbackPresent:     z.boolean().nullable(),
    clawbackTerms:       z.string().nullable(),
    feeOffsets:          z.string().nullable(),
  }),
  investmentPeriod: z.object({
    startDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    endDate:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    hasSteppedDown:  z.boolean().nullable(),
  }).nullable(),
  fundTerm: z.object({
    years:                 z.number().int().positive().nullable(),
    extensionProvisions:   z.string().nullable(),
    gpUnilateralExtension: z.boolean().nullable(),
  }).nullable(),
  keyPersonProvisions: z.object({
    present:       z.boolean(),
    namedPersons:  z.array(z.string()),
    triggerEvents: z.array(z.string()),
    consequences:  z.array(z.string()),
  }).nullable(),
  sideLetters: z.object({
    present:      z.boolean(),
    count:        z.number().int().nonnegative().nullable(),
    summaryNotes: z.array(z.string()),
  }),
  ericaStatus: z.object({
    planAssetsApplicable: z.boolean().nullable(),
    notes:                z.string().nullable(),
  }).nullable(),
  ascDisclosures: z.object({
    fairValueHierarchyPresent:        z.boolean(),
    investmentCompanyGuidanceCited:   z.boolean(),
    financialHighlightsPresent:       z.boolean().nullable(),
    subsequentEventsDisclosed:        z.boolean().nullable(),
    relatedPartyDisclosuresPresent:   z.boolean().nullable(),
    scheduleOfInvestmentsPresent:     z.boolean().nullable(),
  }),
  auditFirm:       z.string().nullable(),
  sourceCitations: z.record(z.string(), sourceCitationSchema),
  promptVersion:   z.string(),
  modelVersion:    z.string(),
})

// ── ReviewerOutput ────────────────────────────────────────────────────────────

export const reviewerOutputSchema = z.object({
  findings: z.array(baseFindingSchema.extend({ agent: z.literal('reviewer') })),
  crossDocumentValidations: z.array(crossDocumentValidationSchema),
  ilpaComplianceChecks: z.array(z.object({
    principle: z.string(),
    status:    z.enum(['compliant','non_compliant','unable_to_assess']),
    notes:     z.string(),
  })),
  promptVersion: z.string(),
  modelVersion:  z.string(),
})

// ── ChallengerOutput ──────────────────────────────────────────────────────────

export const challengerOutputSchema = z.object({
  challenges: z.array(baseFindingSchema.extend({
    agent:               z.literal('challenger'),
    targetFindingId:     z.string().nullable(),
    adversarialArgument: z.string().min(10),
  })),
  benchmarkComparisons: z.array(z.object({
    field:          z.string(),
    fundValue:      z.string(),
    marketStandard: z.string(),
    assessment:     z.enum(['market','above_market','below_market','lp_adverse','unable_to_assess']),
    notes:          z.string(),
  })),
  promptVersion: z.string(),
  modelVersion:  z.string(),
})

// ── SynthesisReport ───────────────────────────────────────────────────────────

export const synthesisReportSchema = z.object({
  executiveSummary:   z.string().min(50),
  overallRiskRating:  z.enum(['low','medium','high','critical']),
  overallScore:       z.number().int().min(1).max(10),
  categoryScores: z.array(z.object({
    category:  findingCategorySchema,
    score:     z.number().int().min(1).max(10),
    rationale: z.string(),
  })),
  findings:                 z.array(baseFindingSchema),
  crossDocumentValidations: z.array(crossDocumentValidationSchema),
  riskMatrix: z.array(z.object({
    category:      findingCategorySchema,
    critical:      z.number().int().nonnegative(),
    warning:       z.number().int().nonnegative(),
    informational: z.number().int().nonnegative(),
    pass:          z.number().int().nonnegative(),
  })),
  openItems: z.array(z.object({
    description:          z.string(),
    requiresHumanReview:  z.boolean(),
    rationale:            z.string(),
  })),
  pbcList: z.array(z.object({
    id:               z.string(),
    priority:         z.enum(['high','medium','low']),
    requestedFrom:    z.string(),
    description:      z.string().min(10),
    relatedFindingIds: z.array(z.string()),
    documentType:     z.string().nullable(),
  })),
  recommendedNextSteps: z.array(z.object({
    priority: z.number().int().positive(),
    action:   z.string(),
    urgency:  z.enum(['immediate','near_term','before_finalization']),
  })),
  documentSetCompleteness: z.object({
    provided:          z.array(z.string()),
    recommended:       z.array(z.string()),
    missing:           z.array(z.string()),
    completenessNote:  z.string(),
  }),
  promptVersion: z.string(),
  modelVersion:  z.string(),
})

// ── Type exports (inferred from Zod) ─────────────────────────────────────────

export type DocumentProfileSchema  = z.infer<typeof documentProfileSchema>
export type PreparerOutputSchema   = z.infer<typeof preparerOutputSchema>
export type ReviewerOutputSchema   = z.infer<typeof reviewerOutputSchema>
export type ChallengerOutputSchema = z.infer<typeof challengerOutputSchema>
export type SynthesisReportSchema  = z.infer<typeof synthesisReportSchema>
