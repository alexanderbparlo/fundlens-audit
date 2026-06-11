import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { findDocumentById, deleteDocument } from '@/lib/db/documents'
import { removeDocumentFromEngagement } from '@/lib/db/engagements'
import { enforceRateLimit } from '@/lib/rateLimit'

export const maxDuration = 30

// Track C: remove & re-upload per audit-support document. Deleting a document
// does not touch historical audit jobs — their extraction and verification
// snapshots are persisted on the job rows (Track D).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await enforceRateLimit(req, 'audit')
  if (limited) return limited

  const { id } = await params
  try {
    const document = await findDocumentById(id)
    if (!document) {
      return NextResponse.json({ success: false, error: 'Document not found.' }, { status: 404 })
    }

    const deleted = await deleteDocument(id)
    if (deleted?.engagementId) {
      await removeDocumentFromEngagement(deleted.engagementId, id)
    }

    // Blob cleanup is best-effort: the DB row is the source of truth and a
    // dangling blob is harmless, while a failed delete must not block re-upload.
    try {
      await del(document.blobUrl)
    } catch (blobErr) {
      console.warn('[documents/delete] Blob cleanup failed:', blobErr)
    }

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    console.error('[documents/delete] Error:', error)
    const message = error instanceof Error ? error.message : 'Failed to delete document.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
