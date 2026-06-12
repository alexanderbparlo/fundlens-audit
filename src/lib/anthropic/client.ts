import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_KEY_HEADER } from '@/lib/apiKey'

// BYOK: there is no server-owned Anthropic key. Each request carries the
// caller's own key in the ANTHROPIC_KEY_HEADER, and we build a short-lived
// client from it per request. The key is never logged or persisted.

/** Thrown when an Anthropic-backed route is reached without a caller key. */
export class MissingApiKeyError extends Error {
  constructor() {
    super('No Anthropic API key provided. Enter your own key to run the audit.')
    this.name = 'MissingApiKeyError'
  }
}

/** Build a per-request Anthropic client from the caller's API key. */
export function anthropicFromRequest(req: Request): Anthropic {
  const key = req.headers.get(ANTHROPIC_KEY_HEADER)?.trim()
  if (!key) throw new MissingApiKeyError()
  return new Anthropic({ apiKey: key })
}
