import { NextRequest, NextResponse } from 'next/server'
import { getEngagement } from '@/lib/db/engagements'

export const maxDuration = 30

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const engagement = await getEngagement(id)
    if (!engagement) {
      return NextResponse.json({ success: false, error: 'Engagement not found.' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: engagement })
  } catch (error) {
    console.error('[engagements] Get error:', error)
    const message = error instanceof Error ? error.message : 'Failed to get engagement.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
