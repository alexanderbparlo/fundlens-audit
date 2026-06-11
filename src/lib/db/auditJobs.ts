import { sql } from './client'
import { PROMPT_VERSION, MODEL_VERSION } from '@/lib/agentConfig'
import type {
  AuditJob, AuditJobStatus, AuditScope, FundType,
  PreparerOutput, ReviewerOutput, ChallengerOutput, SynthesisReport,
  VerificationResult,
} from '@/types'

function rowToJob(row: Record<string, unknown>): AuditJob {
  return {
    id:               row.id as string,
    engagementId:     row.engagement_id as string,
    status:           row.status as AuditJobStatus,
    fundType:         row.fund_type as FundType,
    auditScope:       (row.audit_scope as AuditScope | null) ?? 'full',
    documentIds:      row.document_ids as string[],
    controlRun:       (row.control_run as boolean | null) ?? false,
    preparerOutput:   (row.preparer_output  as PreparerOutput  | null) ?? null,
    verification:     (row.verification     as VerificationResult | null) ?? null,
    reviewerOutput:   (row.reviewer_output  as ReviewerOutput  | null) ?? null,
    challengerOutput: (row.challenger_output as ChallengerOutput | null) ?? null,
    finalReport:      (row.final_report      as SynthesisReport  | null) ?? null,
    errorMessage:     (row.error_message as string | null) ?? null,
    promptVersion:    row.prompt_version as string,
    modelVersion:     row.model_version as string,
    createdAt:        String(row.created_at),
    completedAt:      row.completed_at ? String(row.completed_at) : null,
  }
}

export async function createAuditJob(job: {
  engagementId: string
  fundType: FundType
  auditScope: AuditScope
  documentIds: string[]
  controlRun?: boolean
}): Promise<AuditJob> {
  const rows = await sql`
    INSERT INTO audit_jobs (engagement_id, fund_type, audit_scope, document_ids, control_run, prompt_version, model_version)
    VALUES (${job.engagementId}, ${job.fundType}, ${job.auditScope}, ${job.documentIds}, ${job.controlRun ?? false}, ${PROMPT_VERSION}, ${MODEL_VERSION})
    RETURNING *
  `
  return rowToJob(rows[0] as Record<string, unknown>)
}

export async function getLatestJobForEngagement(engagementId: string): Promise<AuditJob | null> {
  const rows = await sql`
    SELECT * FROM audit_jobs
    WHERE engagement_id = ${engagementId}
    ORDER BY created_at DESC
    LIMIT 1
  `
  return rows[0] ? rowToJob(rows[0] as Record<string, unknown>) : null
}

export async function getAuditJob(id: string): Promise<AuditJob | null> {
  const rows = await sql`SELECT * FROM audit_jobs WHERE id = ${id} LIMIT 1`
  return rows[0] ? rowToJob(rows[0] as Record<string, unknown>) : null
}

export async function updateAuditJobStatus(id: string, status: AuditJobStatus): Promise<void> {
  await sql`UPDATE audit_jobs SET status = ${status} WHERE id = ${id}`
}

export async function savePreparerOutput(id: string, output: PreparerOutput): Promise<void> {
  await sql`
    UPDATE audit_jobs SET preparer_output = ${JSON.stringify(output)}::jsonb WHERE id = ${id}
  `
}

// Track D: the verification snapshot is persisted alongside the run so future
// rounds can diff run-over-run and attribute breaks to profiler vs. checks.
export async function saveVerification(id: string, verification: VerificationResult): Promise<void> {
  await sql`
    UPDATE audit_jobs SET verification = ${JSON.stringify(verification)}::jsonb WHERE id = ${id}
  `
}

export async function saveReviewerOutput(id: string, output: ReviewerOutput): Promise<void> {
  await sql`
    UPDATE audit_jobs SET reviewer_output = ${JSON.stringify(output)}::jsonb WHERE id = ${id}
  `
}

export async function saveChallengerOutput(id: string, output: ChallengerOutput): Promise<void> {
  await sql`
    UPDATE audit_jobs SET challenger_output = ${JSON.stringify(output)}::jsonb WHERE id = ${id}
  `
}

export async function saveFinalReport(id: string, report: SynthesisReport): Promise<AuditJob> {
  const rows = await sql`
    UPDATE audit_jobs
    SET final_report  = ${JSON.stringify(report)}::jsonb,
        status        = 'complete',
        completed_at  = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  return rowToJob(rows[0] as Record<string, unknown>)
}

export async function setAuditJobFailed(id: string, errorMessage: string): Promise<void> {
  await sql`
    UPDATE audit_jobs
    SET status = 'failed', error_message = ${errorMessage}
    WHERE id = ${id}
  `
}
