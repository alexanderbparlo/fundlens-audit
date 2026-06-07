import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

export function handleAnthropicError(error: unknown): NextResponse {
  if (error instanceof Anthropic.APIConnectionError) {
    console.error('[Anthropic] Connection error:', error.message)
    return NextResponse.json(
      { success: false, error: 'Connection to AI service failed. Please try again.' },
      { status: 503 }
    )
  }

  if (error instanceof Anthropic.RateLimitError) {
    console.error('[Anthropic] Rate limit:', error.message)
    return NextResponse.json(
      { success: false, error: 'AI service rate limit reached. Please wait a moment.' },
      { status: 429 }
    )
  }

  if (error instanceof Anthropic.APIError) {
    console.error('[Anthropic] API error:', error.status, error.message)
    return NextResponse.json(
      { success: false, error: `AI service error: ${error.message}` },
      { status: error.status ?? 500 }
    )
  }

  const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
  console.error('[Anthropic] Unexpected error:', error)
  return NextResponse.json(
    { success: false, error: message },
    { status: 500 }
  )
}

// Exponential backoff retry for rate limit errors on parallel agent calls.
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000
): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError && attempt < retries - 1) {
        await new Promise(resolve =>
          setTimeout(resolve, delayMs * Math.pow(2, attempt))
        )
        continue
      }
      throw error
    }
  }
  throw new Error('Max retries exceeded')
}
