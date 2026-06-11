import { sql } from './client'
import type { Engagement, FundType } from '@/types'

function rowToEngagement(row: Record<string, unknown>): Engagement {
  return {
    id:          row.id as string,
    name:        row.name as string,
    fundName:    row.fund_name as string,
    fundType:    row.fund_type as FundType,
    description: (row.description as string | null) ?? null,
    documentIds: row.document_ids as string[],
    auditJobIds: row.audit_job_ids as string[],
    createdAt:   String(row.created_at),
    updatedAt:   String(row.updated_at),
  }
}

export async function createEngagement(engagement: {
  name: string
  fundName: string
  fundType: FundType
  description?: string | null
}): Promise<Engagement> {
  const rows = await sql`
    INSERT INTO engagements (name, fund_name, fund_type, description)
    VALUES (${engagement.name}, ${engagement.fundName}, ${engagement.fundType}, ${engagement.description ?? null})
    RETURNING *
  `
  return rowToEngagement(rows[0] as Record<string, unknown>)
}

export async function getEngagement(id: string): Promise<Engagement | null> {
  const rows = await sql`SELECT * FROM engagements WHERE id = ${id} LIMIT 1`
  return rows[0] ? rowToEngagement(rows[0] as Record<string, unknown>) : null
}

export async function listEngagements(): Promise<Engagement[]> {
  const rows = await sql`SELECT * FROM engagements ORDER BY created_at DESC`
  return (rows as Record<string, unknown>[]).map(rowToEngagement)
}

// Appends a document to the engagement's document_ids array (no-op if already present)
export async function addDocumentToEngagement(id: string, documentId: string): Promise<void> {
  await sql`
    UPDATE engagements
    SET document_ids = array_append(document_ids, ${documentId}::uuid)
    WHERE id = ${id}
      AND NOT (${documentId}::uuid = ANY(document_ids))
  `
}

// Appends an audit job to the engagement's audit_job_ids array
export async function addAuditJobToEngagement(id: string, jobId: string): Promise<void> {
  await sql`
    UPDATE engagements
    SET audit_job_ids = array_append(audit_job_ids, ${jobId}::uuid)
    WHERE id = ${id}
  `
}

// Removes a document from the engagement's document_ids array (Track C delete)
export async function removeDocumentFromEngagement(id: string, documentId: string): Promise<void> {
  await sql`
    UPDATE engagements
    SET document_ids = array_remove(document_ids, ${documentId}::uuid)
    WHERE id = ${id}
  `
}
