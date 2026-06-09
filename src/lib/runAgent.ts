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

// A `max_tokens` stop reason means the model ran out of budget mid-response, so
// the JSON is truncated. Detect it explicitly — otherwise it surfaces downstream
// as an opaque "invalid JSON" parse error that hides the real cause (raise the
// agent's max_tokens in agentConfig). Note: adaptive thinking tokens draw from
// the same budget, so truncation can happen even when the text looks short.
function assertNotTruncated(stopReason: string | null, phase: string): void {
  if (stopReason === 'max_tokens') {
    throw new Error(
      `${phase} response was truncated at max_tokens (stop_reason=max_tokens). ` +
      `The output JSON is incomplete — increase this agent's max_tokens in agentConfig.ts.`,
    )
  }
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

  assertNotTruncated(response.stop_reason, 'Agent')
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

  assertNotTruncated(retryResponse.stop_reason, 'Agent retry')
  const retryRaw = extractText(retryResponse.content)
  const retryParsed = parseAgentJson<unknown>(retryRaw)

  const retryResult = schema.safeParse(retryParsed)
  if (retryResult.success) return retryResult.data

  const finalIssues = retryResult.error.issues
    .map(i => `${i.path.map(String).join('.')}: ${i.message}`)
    .join('; ')
  throw new Error(`Agent output invalid after retry: ${finalIssues}`)
}
