import { NextRequest, NextResponse } from 'next/server'
import { findDocumentById, updateDocumentProfile } from '@/lib/db/documents'
import { handleAnthropicError } from '@/lib/anthropic/errorHandler'
import { buildProfilerSystemPrompt, AGENT_CONFIGS, PROMPT_VERSION, MODEL_VERSION } from '@/lib/agentConfig'
import { extractText, parseAgentJson } from '@/lib/buildDocumentBlocks'
import { documentProfileSchema } from '@/lib/zod/schemas'
import { bufferToBase64 } from '@/lib/utils'
import { enforceRateLimit } from '@/lib/rateLimit'
import type { DocumentCategory, DocumentProfile } from '@/types'
import client from '@/lib/anthropic/client'

export const maxDuration = 60

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const limited = await enforceRateLimit(req, 'profile')
  if (limited) return limited

  try {
    const document = await findDocumentById(id)
    if (!document) {
      return NextResponse.json({ success: false, error: 'Document not found.' }, { status: 404 })
    }

    // Return cached profile unless force=true is passed
    const { searchParams } = new URL(req.url)
    const force = searchParams.get('force') === 'true'
    if (document.profileJson && !force) {
      return NextResponse.json({ success: true, data: document, cached: true })
    }

    // Fetch raw file from Vercel Blob and convert to base64 for the agent.
    // Private store requires the read/write token as a Bearer header.
    const blobRes = await fetch(document.blobUrl, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    })
    if (!blobRes.ok) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch document blob (status ${blobRes.status}).` },
        { status: 502 }
      )
    }
    const blobBuffer = await blobRes.arrayBuffer()
    const base64Data = bufferToBase64(blobBuffer)

    const systemPrompt = buildProfilerSystemPrompt()
    const config = AGENT_CONFIGS.profiler

    // First profiler call
    const response = await client.messages.create({
      model: config.model,
      max_tokens: config.max_tokens,
      thinking: config.thinking,
      output_config: config.output_config,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: document.fileType as 'application/pdf',
                data: base64Data,
              },
              title: document.filename,
            },
            {
              type: 'text',
              text: 'Profile this document. Return only valid JSON as specified.',
            },
          ],
        },
      ],
    })

    const rawText = extractText(response.content)
    let parsed: unknown

    try {
      parsed = parseAgentJson(rawText)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Profiler returned malformed JSON.' },
        { status: 502 }
      )
    }

    // Zod validation — retry once with correction prompt on failure
    let validationResult = documentProfileSchema.safeParse(parsed)

    if (!validationResult.success) {
      const issues = validationResult.error.issues
        .map(i => `${i.path.map(String).join('.')}: ${i.message}`)
        .join('; ')

      const retryResponse = await client.messages.create({
        model: config.model,
        max_tokens: config.max_tokens,
        thinking: config.thinking,
        output_config: config.output_config,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: document.fileType as 'application/pdf',
                  data: base64Data,
                },
                title: document.filename,
              },
              {
                type: 'text',
                text: 'Profile this document. Return only valid JSON as specified.',
              },
            ],
          },
          {
            role: 'assistant',
            content: rawText,
          },
          {
            role: 'user',
            content: `Your previous response failed schema validation: ${issues}. Return corrected JSON only.`,
          },
        ],
      })

      const retryRaw = extractText(retryResponse.content)
      try {
        parsed = parseAgentJson(retryRaw)
      } catch {
        return NextResponse.json(
          { success: false, error: 'Profiler returned malformed JSON on retry.' },
          { status: 502 }
        )
      }

      validationResult = documentProfileSchema.safeParse(parsed)
      if (!validationResult.success) {
        const finalIssues = validationResult.error.issues
          .map(i => `${i.path.map(String).join('.')}: ${i.message}`)
          .join('; ')
        return NextResponse.json(
          { success: false, error: `Profiler output invalid after retry: ${finalIssues}` },
          { status: 502 }
        )
      }
    }

    const profile = validationResult.data as DocumentProfile
    const detectedCategory = profile.documentType as DocumentCategory

    const updated = await updateDocumentProfile(id, profile, detectedCategory)

    return NextResponse.json({
      success: true,
      data: updated,
      meta: { promptVersion: PROMPT_VERSION, modelVersion: MODEL_VERSION },
    })
  } catch (error) {
    // Anthropic SDK errors get structured responses; others get 500
    if (
      error instanceof Error &&
      (error.constructor.name === 'APIConnectionError' ||
        error.constructor.name === 'RateLimitError' ||
        error.constructor.name === 'APIError')
    ) {
      return handleAnthropicError(error)
    }
    console.error('[profile] Error:', error)
    const message = error instanceof Error ? error.message : 'Profiling failed.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
