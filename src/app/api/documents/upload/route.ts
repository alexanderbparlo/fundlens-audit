import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { hashFile } from '@/lib/utils'
import { findDocumentByHash, insertDocument } from '@/lib/db/documents'
import { getEngagement, addDocumentToEngagement } from '@/lib/db/engagements'
import {
  convertWordToPdf, isWordDocument, isConversionAvailable, DOCX_MIME, DOC_MIME,
} from '@/lib/convert/docxToPdf'
import { enforceRateLimit } from '@/lib/rateLimit'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ACCEPTED_TYPES = new Set(['application/pdf', DOCX_MIME, DOC_MIME])

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, 'upload')
  if (limited) return limited
  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const engagementId = formData.get('engagementId')

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'No file provided.' },
        { status: 400 }
      )
    }

    // Documents are scoped to an engagement (isolation boundary)
    if (typeof engagementId !== 'string' || !engagementId) {
      return NextResponse.json(
        { success: false, error: 'engagementId is required.' },
        { status: 400 }
      )
    }
    const engagement = await getEngagement(engagementId)
    if (!engagement) {
      return NextResponse.json(
        { success: false, error: 'Engagement not found.' },
        { status: 404 }
      )
    }

    // Server-side type validation (client check is not sufficient)
    if (!ACCEPTED_TYPES.has(file.type)) {
      return NextResponse.json(
        { success: false, error: `Unsupported file type "${file.type}". Only PDF and Word (.docx/.doc) are accepted.` },
        { status: 400 }
      )
    }

    if (isWordDocument(file.type) && !isConversionAvailable()) {
      return NextResponse.json(
        { success: false, error: 'Word document conversion is not configured. Please upload a PDF.' },
        { status: 503 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File exceeds the 10 MB limit.' },
        { status: 400 }
      )
    }

    const buffer = await file.arrayBuffer()
    // Deduplicate on the ORIGINAL uploaded bytes so a re-uploaded Word doc is
    // recognized even though conversion output is not byte-deterministic.
    const contentHash = await hashFile(buffer)

    // Dedupe within this engagement only — the same file uploaded to another
    // engagement is a separate, isolated row.
    const existing = await findDocumentByHash(engagementId, contentHash)
    if (existing) {
      return NextResponse.json({ success: true, data: existing, deduplicated: true })
    }

    // Word documents are converted to PDF up front so every downstream agent
    // works from a uniform PDF document block. The stored artifact is the PDF.
    let storeBytes: Buffer | ArrayBuffer = buffer
    let storeMime = file.type
    let storeFilename = file.name
    if (isWordDocument(file.type)) {
      const pdf = await convertWordToPdf(Buffer.from(buffer), file.name, file.type)
      storeBytes = pdf
      storeMime = 'application/pdf'
      storeFilename = file.name.replace(/\.(docx?)$/i, '') + '.pdf'
    }

    // Upload the stored artifact to Vercel Blob for persistent cross-session storage.
    // BLOB_READ_WRITE_TOKEN must be set in .env.local (run `vercel env pull` after linking).
    const blob = await put(storeFilename, storeBytes, {
      access: 'private',
      contentType: storeMime,
    })

    const document = await insertDocument({
      engagementId,
      contentHash,
      filename: storeFilename,
      fileType: storeMime,
      blobUrl: blob.url,
      fileSizeBytes: storeBytes.byteLength,
    })

    // Keep the engagement's document_ids array in sync (idempotent)
    await addDocumentToEngagement(engagementId, document.id)

    return NextResponse.json({ success: true, data: document })
  } catch (error) {
    console.error('[upload] Error:', error)
    const message = error instanceof Error ? error.message : 'Upload failed.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
