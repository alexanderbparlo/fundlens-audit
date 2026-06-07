import type Anthropic from '@anthropic-ai/sdk'

type DocumentBlock = Anthropic.Messages.DocumentBlockParam

/**
 * Convert an array of base64-encoded PDFs into Anthropic document blocks.
 * When the same PDF is sent to multiple agents in one request cycle, the first
 * agent pays full token cost; subsequent agents hit the prompt cache.
 */
export function buildDocumentBlocks(
  base64Files: { data: string; name: string; mimeType?: string }[],
  cache = true
): DocumentBlock[] {
  return base64Files.map((file, index) => {
    const block: DocumentBlock = {
      type: 'document',
      source: {
        type: 'base64',
        media_type: (file.mimeType ?? 'application/pdf') as 'application/pdf',
        data: file.data,
      },
      title: file.name,
    }
    // Only cache when the same document will be read by multiple agents.
    // Cache the first document in the set — it's the highest-cost input.
    if (cache && index === 0) {
      ;(block as DocumentBlock & { cache_control?: { type: 'ephemeral' } }).cache_control = {
        type: 'ephemeral',
      }
    }
    return block
  })
}

/** Extract the text block from an Anthropic response (thinking blocks may appear first). */
export function extractText(
  content: Anthropic.Messages.ContentBlock[]
): string {
  const textBlock = content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Agent response contained no text block')
  }
  return textBlock.text
}

/**
 * Strip markdown fences from a string and parse as JSON.
 * Defensive parsing for agent outputs that occasionally wrap JSON in fences.
 */
export function parseAgentJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    return JSON.parse(cleaned) as T
  } catch {
    throw new Error(`Agent returned invalid JSON.\n\nRaw output (first 500 chars):\n${raw.slice(0, 500)}`)
  }
}
