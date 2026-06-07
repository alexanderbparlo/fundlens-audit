import { NextResponse } from 'next/server'
import { listDocuments } from '@/lib/db/documents'

export const maxDuration = 30

export async function GET() {
  try {
    const documents = await listDocuments()
    return NextResponse.json({ success: true, data: documents })
  } catch (error) {
    console.error('[documents] List error:', error)
    const message = error instanceof Error ? error.message : 'Failed to list documents.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
