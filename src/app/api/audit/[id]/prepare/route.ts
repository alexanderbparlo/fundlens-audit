import { NextRequest, NextResponse } from 'next/server'
import { getAuditJob, updateAuditJobStatus, savePreparerOutput, setAuditJobFailed } from '@/lib/db/auditJobs'
import { findDocumentsByIds } from '@/lib/db/documents'
import { handleAnthropicError } from '@/lib/anthropic/errorHandler'
import { buildPreparerSystemPrompt, AGENT_CONFIGS } from '@/lib/agentConfig'
import { preparerOutputSchema } from '@/lib/zod/schemas'
import { runAgent } from '@/lib/runAgent'
import { buildDocumentBlocks } from '@/lib/buildDocumentBlocks'
import { bufferToBase64 } from '@/lib/utils'
import { enforceRateLimit } from '@/lib/rateLimit'
import type { PreparerOutput } from '@/types'

export const maxDuration = 300

function buildPreparerUserMessage(
  documents: { filename: string; profile: NonNullable<import('@/types').FundDocument['profileJson']> }[],
  fundType: string,
): string {
  const docBlocks = documents.map((doc, i) => {
    const p = doc.profile
    return `=== DOCUMENT ${i + 1}: ${doc.filename} (${p.documentType}) ===
Fund Name: ${p.fundName ?? 'Unknown'}
Period End: ${p.periodEnd ?? 'Unknown'}
Estimated Pages: ${p.estimatedPageCount ?? 'Unknown'}

Key Facts:
${p.keyFacts.map(f => `  - ${f}`).join('\n')}

Section Index:
${p.sectionIndex.map(s => `  p.${s.page}: ${s.title}`).join('\n')}

Warning Flags:
${p.warningFlags.length > 0 ? p.warningFlags.map(w => `  ! ${w}`).join('\n') : '  None'}
===`
  }).join('\n\n')

  return `The complete document set for this ${fundType} fund audit is attached above. Profiler navigation summaries for each document follow — use them to orient, but extract all values directly from the attached source documents.

${docBlocks}

Extract the full PreparerOutput schema from the attached documents. Return valid JSON only.`
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await enforceRateLimit(req, 'agent')
  if (limited) return limited

  const { id } = await params

  try {
    const job = await getAuditJob(id)
    if (!job) {
      return NextResponse.json({ success: false, error: 'Audit job not found.' }, { status: 404 })
    }

    // Idempotent — return cached output if already prepared
    if (job.preparerOutput) {
      return NextResponse.json({ success: true, data: job, cached: true })
    }

    // Fetch all document profiles for this job
    const documents = await findDocumentsByIds(job.documentIds)
    const unprofiled = documents.filter(d => !d.profileJson).map(d => d.filename)
    if (unprofiled.length > 0) {
      return NextResponse.json(
        { success: false, error: `Documents must be profiled before preparing: ${unprofiled.join(', ')}` },
        { status: 422 }
      )
    }

    await updateAuditJobStatus(id, 'preparing')

    const profiledDocs = documents.map(d => ({
      filename: d.filename,
      profile: d.profileJson!,
    }))

    // Round-1 fix: the Preparer now reads the raw documents directly. The
    // profile-only funnel dropped holdings tables, stated performance metrics,
    // and valuation-methodology prose (fix-log items 4, 5, 12, 13, 14).
    const base64Files = await Promise.all(
      documents.map(async d => {
        const blobRes = await fetch(d.blobUrl, {
          headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
        })
        if (!blobRes.ok) {
          throw new Error(`Failed to fetch document blob for ${d.filename} (status ${blobRes.status}).`)
        }
        return {
          data: bufferToBase64(await blobRes.arrayBuffer()),
          name: d.filename,
          mimeType: d.fileType,
        }
      })
    )

    const userMessage = buildPreparerUserMessage(profiledDocs, job.fundType)
    const systemPrompt = buildPreparerSystemPrompt(job.fundType, job.auditScope)

    const output = await runAgent(
      AGENT_CONFIGS.preparer,
      systemPrompt,
      [
        ...buildDocumentBlocks(base64Files),
        { type: 'text', text: userMessage },
      ],
      preparerOutputSchema,
    )

    await savePreparerOutput(id, output as PreparerOutput)
    const updated = await getAuditJob(id)

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    await setAuditJobFailed(id, error instanceof Error ? error.message : 'Prepare phase failed.').catch(() => {})
    return handleAnthropicError(error)
  }
}
