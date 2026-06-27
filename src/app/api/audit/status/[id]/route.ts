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
    return NextResponse.json({ success: false, error: 'Failed to get audit status.' }, { status: 500 })
  }
}
