import { sql } from './client'
import type { FundDocument, DocumentCategory, DocumentProfile } from '@/types'

function rowToDocument(row: Record<string, unknown>): FundDocument {
  return {
    id:               row.id as string,
    engagementId:     (row.engagement_id as string | null) ?? null,
    contentHash:      row.content_hash as string,
    filename:         row.filename as string,
    fileType:         row.file_type as string,
    blobUrl:          row.blob_url as string,
    fileSizeBytes:    row.file_size_bytes as number,
    detectedCategory: row.detected_category as DocumentCategory,
    profileJson:      (row.profile_json as DocumentProfile | null) ?? null,
    profiledAt:       row.profiled_at ? String(row.profiled_at) : null,
    createdAt:        String(row.created_at),
  }
}

// Dedupe is scoped to one engagement — the same file in another engagement is
// intentionally a separate row (fix-log item 11: document isolation).
export async function findDocumentByHash(engagementId: string, contentHash: string): Promise<FundDocument | null> {
  const rows = await sql`
    SELECT * FROM documents
    WHERE engagement_id = ${engagementId} AND content_hash = ${contentHash}
    LIMIT 1
  `
  return rows[0] ? rowToDocument(rows[0] as Record<string, unknown>) : null
}

export async function findDocumentById(id: string): Promise<FundDocument | null> {
  const rows = await sql`
    SELECT * FROM documents WHERE id = ${id} LIMIT 1
  `
  return rows[0] ? rowToDocument(rows[0] as Record<string, unknown>) : null
}

export async function insertDocument(doc: {
  engagementId: string
  contentHash: string
  filename: string
  fileType: string
  blobUrl: string
  fileSizeBytes: number
}): Promise<FundDocument> {
  const rows = await sql`
    INSERT INTO documents (engagement_id, content_hash, filename, file_type, blob_url, file_size_bytes)
    VALUES (${doc.engagementId}, ${doc.contentHash}, ${doc.filename}, ${doc.fileType}, ${doc.blobUrl}, ${doc.fileSizeBytes})
    RETURNING *
  `
  return rowToDocument(rows[0] as Record<string, unknown>)
}

export async function updateDocumentProfile(
  id: string,
  profile: DocumentProfile,
  detectedCategory: DocumentCategory,
): Promise<FundDocument> {
  const rows = await sql`
    UPDATE documents
    SET profile_json      = ${JSON.stringify(profile)}::jsonb,
        profiled_at       = NOW(),
        detected_category = ${detectedCategory}
    WHERE id = ${id}
    RETURNING *
  `
  return rowToDocument(rows[0] as Record<string, unknown>)
}

export async function findDocumentsByIds(ids: string[]): Promise<FundDocument[]> {
  if (ids.length === 0) return []
  const rows = await sql`SELECT * FROM documents WHERE id = ANY(${ids})`
  return (rows as Record<string, unknown>[]).map(rowToDocument)
}

export async function listDocuments(engagementId: string): Promise<FundDocument[]> {
  const rows = await sql`
    SELECT * FROM documents
    WHERE engagement_id = ${engagementId}
    ORDER BY created_at DESC
  `
  return (rows as Record<string, unknown>[]).map(rowToDocument)
}
