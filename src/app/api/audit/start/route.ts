import { NextRequest, NextResponse } from 'next/server'
import { getEngagement, addDocumentToEngagement, addAuditJobToEngagement } from '@/lib/db/engagements'
import { createAuditJob } from '@/lib/db/auditJobs'
import { enforceRateLimit } from '@/lib/rateLimit'
import type { AuditScope, FundType } from '@/types'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, 'audit')
  if (limited) return limited
  try {
    const body = await req.json() as Record<string, unknown>
    const { engagementId, documentIds, fundType, auditScope } = body

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

    // Add documents to the engagement (idempotent — no-op if already linked)
    for (const docId of documentIds as string[]) {
      await addDocumentToEngagement(engagementId, docId)
    }

    const job = await createAuditJob({
      engagementId,
      fundType: fundType as FundType,
      auditScope: resolvedScope,
      documentIds: documentIds as string[],
    })

    await addAuditJobToEngagement(engagementId, job.id)

    return NextResponse.json({ success: true, data: job }, { status: 201 })
  } catch (error) {
    console.error('[audit/start] Error:', error)
    const message = error instanceof Error ? error.message : 'Failed to start audit.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
