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
    return NextResponse.json({ success: false, error: 'Failed to get engagement.' }, { status: 500 })
  }
}
