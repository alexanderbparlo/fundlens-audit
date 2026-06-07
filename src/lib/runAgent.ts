import client from './anthropic/client'
import { extractText, parseAgentJson } from './buildDocumentBlocks'

// Structural type compatible with every entry in AGENT_CONFIGS
type AgentConfig = {
  readonly model: string
  readonly max_tokens: number
  readonly thinking: { readonly type: 'adaptive' }
  readonly output_config: { readonly effort: 'low' | 'medium' | 'high' | 'xhigh' }
}

// Minimal Zod-compatible schema interface — avoids importing Zod types here.
// path uses PropertyKey[] (Zod v4) to include symbol; we map to String() before joining.
type Schema<T> = {
  safeParse(data: unknown):
    | { success: true; data: T }
    | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } }
}

/**
 * Call an agent with a text-only user message, validate the JSON output against
 * a Zod schema, and retry once with a correction prompt if validation fails.
 * Used by Preparer, Reviewer, Challenger, and Synthesizer (not Profiler —
 * Profiler sends document blocks and is handled directly in its route).
 */
export async function runAgent<T>(
  config: AgentConfig,
  systemPrompt: string,
  userMessage: string,
  schema: Schema<T>,
): Promise<T> {
  const response = await client.messages.create({
    model:         config.model,
    max_tokens:    config.max_tokens,
    thinking:      config.thinking,
    output_config: config.output_config,
    system:        systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  const rawText = extractText(response.content)
  const parsed = parseAgentJson<unknown>(rawText)

  const result = schema.safeParse(parsed)
  if (result.success) return result.data

  // Retry once with schema error injected into the conversation
  const issues = result.error.issues
    .map(i => `${i.path.map(String).join('.')}: ${i.message}`)
    .join('; ')

  const retryResponse = await client.messages.create({
    model:         config.model,
    max_tokens:    config.max_tokens,
    thinking:      config.thinking,
    output_config: config.output_config,
    system:        systemPrompt,
    messages: [
      { role: 'user',      content: userMessage },
      { role: 'assistant', content: rawText },
      { role: 'user',      content: `Schema validation failed: ${issues}. Return corrected JSON only.` },
    ],
  })

  const retryRaw = extractText(retryResponse.content)
  const retryParsed = parseAgentJson<unknown>(retryRaw)

  const retryResult = schema.safeParse(retryParsed)
  if (retryResult.success) return retryResult.data

  const finalIssues = retryResult.error.issues
    .map(i => `${i.path.map(String).join('.')}: ${i.message}`)
    .join('; ')
  throw new Error(`Agent output invalid after retry: ${finalIssues}`)
}
