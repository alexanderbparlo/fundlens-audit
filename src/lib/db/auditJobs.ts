import { sql } from './client'
import { PROMPT_VERSION, MODEL_VERSION } from '@/lib/agentConfig'
import type {
  AuditJob, AuditJobStatus, AuditScope, FundType,
  PreparerOutput, ReviewerOutput, ChallengerOutput, SynthesisReport,
} from '@/types'

function rowToJob(row: Record<string, unknown>): AuditJob {
  return {
    id:               row.id as string,
    engagementId:     row.engagement_id as string,
    status:           row.status as AuditJobStatus,
    fundType:         row.fund_type as FundType,
    auditScope:       (row.audit_scope as AuditScope | null) ?? 'full',
    documentIds:      row.document_ids as string[],
    preparerOutput:   (row.preparer_output  as PreparerOutput  | null) ?? null,
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
}): Promise<AuditJob> {
  const rows = await sql`
    INSERT INTO audit_jobs (engagement_id, fund_type, audit_scope, document_ids, prompt_version, model_version)
    VALUES (${job.engagementId}, ${job.fundType}, ${job.auditScope}, ${job.documentIds}, ${PROMPT_VERSION}, ${MODEL_VERSION})
    RETURNING *
  `
  return rowToJob(rows[0] as Record<string, unknown>)
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
