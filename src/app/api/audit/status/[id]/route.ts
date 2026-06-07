import { NextRequest, NextResponse } from 'next/server'
import { getAuditJob } from '@/lib/db/auditJobs'

export const maxDuration = 30

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const job = await getAuditJob(id)
    if (!job) {
      return NextResponse.json({ success: false, error: 'Audit job not found.' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: job })
  } catch (error) {
    console.error('[audit/status] Error:', error)
    const message = error instanceof Error ? error.message : 'Failed to get audit status.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
