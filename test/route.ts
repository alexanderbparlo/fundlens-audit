import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 300

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MODEL = 'claude-opus-4-7'
const THINKING = { type: 'adaptive' } as const
const OUTPUT_CONFIG = { effort: 'high' } as const
const MAX_TOKENS = 8096

// ── Agent system prompts ────────────────────────────────────────────────────

const PREPARER_SYSTEM = `You are the Preparer agent in a fund document audit. Read and structure the document exhaustively. Extract:
- Fund name, type, vintage year, strategy, and legal domicile
- Key financial metrics: AUM, NAV, commitment sizes, drawdown schedule
- Performance figures: gross/net IRR, TVPI, DPI, RVPI vs benchmark
- Fee structure: management fee, carry, hurdle rate, fee offsets
- Portfolio composition, sector and geographic allocation
- Manager background, team stability, track record across prior vehicles
- Material risks, regulatory disclosures, side letters, key-person provisions

Return a structured, factual summary. Do not editorialize — the Reviewer and Challenger agents will assess quality.`

const REVIEWER_SYSTEM = `You are the Reviewer agent in a fund document audit. Critically assess the fund document for accuracy, completeness, and transparency. Examine:
- Internal consistency of reported metrics (gross vs net returns, fee maths)
- Completeness of required disclosures (ILPA standards, regulatory filings)
- Clarity of fee structures — identify hidden economics or ambiguous terms
- Alignment between stated strategy and reported holdings/activity
- Quality and independence of valuation methodology
- Adequacy of risk disclosures relative to actual exposures

Flag concrete findings with document references where possible. Distinguish definitive issues from areas needing clarification.`

const CHALLENGER_SYSTEM = `You are the Challenger agent in a fund document audit. Your role is adversarial: stress-test claims and surface weaknesses a motivated investor or regulator might raise. Challenge:
- Return attribution — what drove performance and is it repeatable?
- Benchmark and peer selection — are comparisons favourable but misleading?
- Valuation of unrealised assets — methodology, timing, independence
- Conflicts of interest and related-party transactions
- Key-person and team concentration risk
- Macro sensitivity and scenario robustness of the strategy
- Any pattern of selective disclosure or narrative framing

Be direct and specific. If a claim is unverifiable from the document alone, say so.`

const SYNTHESIS_SYSTEM = `You are the Synthesis agent in a fund document audit. You receive structured outputs from three specialist agents — Preparer, Reviewer, and Challenger — and produce the final audit report.

Your report must:
1. Open with an executive summary (3–5 sentences)
2. Integrate the Preparer's structured data into a factual fund overview
3. Consolidate the Reviewer's findings into a prioritised list (Critical / Significant / Minor)
4. Address each Challenger concern and rate likelihood and severity
5. Provide an overall Document Quality Score (1–10) with explicit justification
6. Close with a ranked action list for the investor (what to follow up before committing)

Write in clear, professional prose suitable for an investment committee.`

// ── Types ───────────────────────────────────────────────────────────────────

type CachedDocBlock = {
  type: 'document'
  source: { type: 'base64'; media_type: 'application/pdf'; data: string }
  title: string
  cache_control: { type: 'ephemeral' }
}

type TextBlock = { type: 'text'; text: string }

type AuditResponse = {
  preparer: string
  reviewer: string
  challenger: string
  synthesis: string
}

// ── Agent runner ────────────────────────────────────────────────────────────

async function runAgent(
  systemPrompt: string,
  userContent: (CachedDocBlock | TextBlock)[],
): Promise<string> {
  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: THINKING,
    output_config: OUTPUT_CONFIG,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent as Anthropic.Messages.ContentBlockParam[] }],
  })
  const msg = await stream.finalMessage()
  const textBlock = msg.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Agent returned no text block')
  }
  return textBlock.text
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Size guard — base64 of a 10 MB PDF ≈ 13.3 M chars; 20 MB body gives comfortable headroom
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const bytes = Number.parseInt(contentLength, 10)
    if (Number.isFinite(bytes) && bytes > 20 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'Request body exceeds 20 MB limit.' },
        { status: 413 }
      )
    }
  }

  // Parse body
  let body: { document?: { name?: unknown; data?: unknown } }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const doc = body?.document
  if (!doc || typeof doc.name !== 'string' || typeof doc.data !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Body must include document: { name: string, data: string } (base64 PDF).' },
      { status: 400 }
    )
  }

  if (doc.data.length < 100) {
    return NextResponse.json(
      { success: false, error: 'Document appears empty or corrupt.' },
      { status: 400 }
    )
  }

  // base64 of 10 MB binary ≈ 13.3 M chars
  if (doc.data.length > 14_000_000) {
    return NextResponse.json(
      { success: false, error: `Document "${doc.name}" exceeds the 10 MB size limit.` },
      { status: 400 }
    )
  }

  // Cached PDF block — identical across all three parallel calls so only the
  // first agent pays full input-token cost; agents 2 and 3 hit the cache.
  const cachedDoc: CachedDocBlock = {
    type: 'document',
    source: { type: 'base64', media_type: 'application/pdf', data: doc.data },
    title: doc.name,
    cache_control: { type: 'ephemeral' },
  }

  const instruction: TextBlock = {
    type: 'text',
    text: 'Analyze this fund document according to your assigned role.',
  }

  const userContent: (CachedDocBlock | TextBlock)[] = [cachedDoc, instruction]

  // ── Three agents in parallel ─────────────────────────────────────────────
  let preparerOutput: string
  let reviewerOutput: string
  let challengerOutput: string

  try {
    ;[preparerOutput, reviewerOutput, challengerOutput] = await Promise.all([
      runAgent(PREPARER_SYSTEM, userContent),
      runAgent(REVIEWER_SYSTEM, userContent),
      runAgent(CHALLENGER_SYSTEM, userContent),
    ])
  } catch (err) {
    console.error('[/api/audit] Parallel agent error:', err)
    return NextResponse.json(
      { success: false, error: 'One or more audit agents failed. Please try again.' },
      { status: 502 }
    )
  }

  // ── Sequential synthesis ─────────────────────────────────────────────────
  const synthesisPrompt = `## Preparer Report\n${preparerOutput}\n\n## Reviewer Report\n${reviewerOutput}\n\n## Challenger Report\n${challengerOutput}\n\nPlease synthesize these into the final audit report.`

  let synthesisOutput: string
  try {
    synthesisOutput = await runAgent(SYNTHESIS_SYSTEM, [
      { type: 'text', text: synthesisPrompt },
    ])
  } catch (err) {
    console.error('[/api/audit] Synthesis error:', err)
    return NextResponse.json(
      { success: false, error: 'Synthesis step failed. Please try again.' },
      { status: 502 }
    )
  }

  const data: AuditResponse = {
    preparer: preparerOutput,
    reviewer: reviewerOutput,
    challenger: challengerOutput,
    synthesis: synthesisOutput,
  }

  return NextResponse.json({ success: true, data }, { status: 200 })
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed. Use POST.' }, { status: 405 })
}
