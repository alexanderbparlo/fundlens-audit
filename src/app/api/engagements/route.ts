import { NextRequest, NextResponse } from 'next/server'
import { createEngagement, listEngagements } from '@/lib/db/engagements'
import type { FundType } from '@/types'

export const maxDuration = 30

export async function GET() {
  try {
    const engagements = await listEngagements()
    return NextResponse.json({ success: true, data: engagements })
  } catch (error) {
    console.error('[engagements] List error:', error)
    const message = error instanceof Error ? error.message : 'Failed to list engagements.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    const { name, fundName, fundType, description } = body

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'name is required.' }, { status: 400 })
    }
    if (typeof fundName !== 'string' || !fundName.trim()) {
      return NextResponse.json({ success: false, error: 'fundName is required.' }, { status: 400 })
    }
    const validFundTypes: FundType[] = ['PE', 'VC', 'HF', 'Credit', 'RealEstate']
    if (!validFundTypes.includes(fundType as FundType)) {
      return NextResponse.json(
        { success: false, error: `fundType must be one of: ${validFundTypes.join(', ')}.` },
        { status: 400 }
      )
    }

    const engagement = await createEngagement({
      name: name.trim(),
      fundName: fundName.trim(),
      fundType: fundType as FundType,
      description: typeof description === 'string' ? description.trim() || null : null,
    })

    return NextResponse.json({ success: true, data: engagement }, { status: 201 })
  } catch (error) {
    console.error('[engagements] Create error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create engagement.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
