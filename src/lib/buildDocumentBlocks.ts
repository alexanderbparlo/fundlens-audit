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
    // Prompt caching is prefix-based: a breakpoint on the LAST document block
    // caches every block before it. This pays off on the runAgent correction
    // retry, which re-sends the identical document prefix.
    if (cache && index === base64Files.length - 1) {
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
  // Trim FIRST — a leading newline before a ```json fence otherwise defeats
  // the ^-anchored strips (observed in prod on the Synthesizer, 2026-06-09).
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()

  try {
    return JSON.parse(cleaned) as T
  } catch {
    // Fallback: extract the outermost JSON object. Tolerates preamble text
    // before the JSON and commentary after the closing brace/fence.
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T
      } catch {
        // fall through to the diagnostic error
      }
    }
    throw new Error(
      `Agent returned invalid JSON.\n\nRaw output (first 500 chars):\n${raw.slice(0, 500)}` +
      `\n\nRaw output (last 300 chars):\n${raw.slice(-300)}`,
    )
  }
}
