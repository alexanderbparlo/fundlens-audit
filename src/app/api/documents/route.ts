import { NextRequest, NextResponse } from 'next/server'
import { listDocuments } from '@/lib/db/documents'

export const maxDuration = 30

// Documents are scoped to an engagement — there is no global listing.
export async function GET(req: NextRequest) {
  try {
    const engagementId = req.nextUrl.searchParams.get('engagementId')
    if (!engagementId) {
      return NextResponse.json(
        { success: false, error: 'engagementId query parameter is required.' },
        { status: 400 }
      )
    }
    const documents = await listDocuments(engagementId)
    return NextResponse.json({ success: true, data: documents })
  } catch (error) {
    console.error('[documents] List error:', error)
    const message = error instanceof Error ? error.message : 'Failed to list documents.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
