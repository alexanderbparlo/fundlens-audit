import { sql } from './client'
import type { FindingStatus, FindingStatusRecord } from '@/types'

function rowToRecord(row: Record<string, unknown>): FindingStatusRecord {
  return {
    findingId: row.finding_id as string,
    jobId:     row.job_id as string,
    status:    row.status as FindingStatus,
    note:      (row.note as string | null) ?? null,
    updatedAt: String(row.updated_at),
  }
}

/** All user-managed finding statuses for a single audit job. */
export async function getFindingStatuses(jobId: string): Promise<FindingStatusRecord[]> {
  const rows = await sql`
    SELECT * FROM finding_statuses WHERE job_id = ${jobId} ORDER BY updated_at DESC
  `
  return rows.map(r => rowToRecord(r as Record<string, unknown>))
}

/**
 * Insert or update the status of a single finding within a job.
 * Keyed on (finding_id, job_id) — the composite primary key.
 */
export async function upsertFindingStatus(input: {
  jobId: string
  findingId: string
  status: FindingStatus
  note: string | null
}): Promise<FindingStatusRecord> {
  const rows = await sql`
    INSERT INTO finding_statuses (finding_id, job_id, status, note, updated_at)
    VALUES (${input.findingId}, ${input.jobId}, ${input.status}, ${input.note}, NOW())
    ON CONFLICT (finding_id, job_id)
    DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note, updated_at = NOW()
    RETURNING *
  `
  return rowToRecord(rows[0] as Record<string, unknown>)
}
