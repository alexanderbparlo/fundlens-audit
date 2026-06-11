import { NextRequest, NextResponse } from 'next/server'
import { getEngagement, addAuditJobToEngagement } from '@/lib/db/engagements'
import { findDocumentsByIds } from '@/lib/db/documents'
import { createAuditJob, savePreparerOutput } from '@/lib/db/auditJobs'
import { preparerOutputSchema } from '@/lib/zod/schemas'
import { enforceRateLimit } from '@/lib/rateLimit'
import type { AuditScope, FundType, PreparerOutput } from '@/types'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, 'audit')
  if (limited) return limited
  try {
    const body = await req.json() as Record<string, unknown>
    const { engagementId, documentIds, fundType, auditScope, controlPreparerOutput } = body

    // Track C control-run mode: a known-good structured extraction bypasses the
    // profiler/preparer entirely, isolating agent reasoning from profiler quality.
    let controlExtraction: PreparerOutput | null = null
    if (controlPreparerOutput != null) {
      const parsed = preparerOutputSchema.safeParse(controlPreparerOutput)
      if (!parsed.success) {
        const issues = parsed.error.issues.slice(0, 5)
          .map(i => `${i.path.map(String).join('.')}: ${i.message}`).join('; ')
        return NextResponse.json(
          { success: false, error: `controlPreparerOutput failed schema validation: ${issues}` },
          { status: 400 }
        )
      }
      controlExtraction = parsed.data as PreparerOutput
    }

    if (typeof engagementId !== 'string' || !engagementId) {
      return NextResponse.json({ success: false, error: 'engagementId is required.' }, { status: 400 })
    }
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ success: false, error: 'documentIds must be a non-empty array.' }, { status: 400 })
    }
    const validFundTypes: FundType[] = ['PE', 'VC', 'HF', 'Credit', 'RealEstate']
    if (!validFundTypes.includes(fundType as FundType)) {
      return NextResponse.json(
        { success: false, error: `fundType must be one of: ${validFundTypes.join(', ')}.` },
        { status: 400 }
      )
    }
    const resolvedScope: AuditScope = auditScope === 'partial' ? 'partial' : 'full'

    const engagement = await getEngagement(engagementId)
    if (!engagement) {
      return NextResponse.json({ success: false, error: 'Engagement not found.' }, { status: 404 })
    }

    // Isolation enforcement (fix-log item 11): every document in the run must
    // belong to THIS engagement. Documents from other engagements — or unknown
    // IDs — are rejected, never silently linked.
    const docs = await findDocumentsByIds(documentIds as string[])
    const foundIds = new Set(docs.map(d => d.id))
    const missing = (documentIds as string[]).filter(id => !foundIds.has(id))
    if (missing.length > 0) {
      return NextResponse.json(
        { success: false, error: `Documents not found: ${missing.join(', ')}` },
        { status: 404 }
      )
    }
    const foreign = docs.filter(d => d.engagementId !== engagementId)
    if (foreign.length > 0) {
      return NextResponse.json(
        { success: false, error: `Documents do not belong to this engagement: ${foreign.map(d => d.filename).join(', ')}` },
        { status: 403 }
      )
    }

    const job = await createAuditJob({
      engagementId,
      fundType: fundType as FundType,
      auditScope: resolvedScope,
      documentIds: documentIds as string[],
      controlRun: controlExtraction != null,
    })

    if (controlExtraction) {
      // The prepare route detects an existing extraction, skips the LLM, and
      // runs only the deterministic verification layer over it.
      await savePreparerOutput(job.id, controlExtraction)
    }

    await addAuditJobToEngagement(engagementId, job.id)

    return NextResponse.json({ success: true, data: job }, { status: 201 })
  } catch (error) {
    console.error('[audit/start] Error:', error)
    const message = error instanceof Error ? error.message : 'Failed to start audit.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
