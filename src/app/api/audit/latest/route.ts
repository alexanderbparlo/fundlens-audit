import { NextRequest, NextResponse } from 'next/server'
import { getLatestJobForEngagement } from '@/lib/db/auditJobs'

export const maxDuration = 30

// Track D surfacing: latest persisted run for an engagement (null when none).
export async function GET(req: NextRequest) {
  const engagementId = req.nextUrl.searchParams.get('engagementId')
  if (!engagementId) {
    return NextResponse.json({ success: false, error: 'engagementId is required.' }, { status: 400 })
  }
  try {
    const job = await getLatestJobForEngagement(engagementId)
    return NextResponse.json({ success: true, data: job })
  } catch (error) {
    console.error('[audit/latest] Error:', error)
    const message = error instanceof Error ? error.message : 'Failed to load the latest run.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
