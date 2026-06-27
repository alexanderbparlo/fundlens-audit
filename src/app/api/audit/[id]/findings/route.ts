import { NextRequest, NextResponse } from 'next/server'
import { getFindingStatuses, upsertFindingStatus } from '@/lib/db/findingStatuses'
import type { FindingStatus } from '@/types'

export const maxDuration = 30

const VALID_STATUSES: FindingStatus[] = ['open', 'reviewed', 'accepted_risk', 'resolved']

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const statuses = await getFindingStatuses(id)
    return NextResponse.json({ success: true, data: statuses })
  } catch (error) {
    console.error('[audit/findings] List error:', error)
    return NextResponse.json({ success: false, error: 'Failed to list finding statuses.' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await req.json() as Record<string, unknown>
    const { findingId, status, note } = body

    if (typeof findingId !== 'string' || !findingId.trim()) {
      return NextResponse.json({ success: false, error: 'findingId is required.' }, { status: 400 })
    }
    if (!VALID_STATUSES.includes(status as FindingStatus)) {
      return NextResponse.json(
        { success: false, error: `status must be one of: ${VALID_STATUSES.join(', ')}.` },
        { status: 400 }
      )
    }

    const record = await upsertFindingStatus({
      jobId: id,
      findingId: findingId.trim(),
      status: status as FindingStatus,
      note: typeof note === 'string' ? note.trim() || null : null,
    })

    return NextResponse.json({ success: true, data: record })
  } catch (error) {
    console.error('[audit/findings] Update error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update finding status.' }, { status: 500 })
  }
}
