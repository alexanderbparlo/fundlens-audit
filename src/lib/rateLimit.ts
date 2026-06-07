import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Per-route limits. Audit runs and document conversions are the expensive paths.
// 'agent' covers the four per-phase compute routes (prepare/review/challenge/
// synthesize), each of which fires an Anthropic call. A full run uses 4 of these,
// so 40/h tracks the 10 audit starts/h limit while blocking direct-loop abuse.
export type LimitKey = 'upload' | 'profile' | 'audit' | 'agent'

const LIMITS: Record<LimitKey, { tokens: number; window: `${number} ${'s' | 'm' | 'h'}` }> = {
  upload:  { tokens: 30, window: '1 h' },
  profile: { tokens: 30, window: '1 h' },
  audit:   { tokens: 10, window: '1 h' },
  agent:   { tokens: 40, window: '1 h' },
}

const hasUpstash = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
)

// ── Upstash-backed limiters (production) ──────────────────────────────────────
const upstashLimiters: Partial<Record<LimitKey, Ratelimit>> = {}

function upstashLimiter(key: LimitKey): Ratelimit {
  if (!upstashLimiters[key]) {
    const { tokens, window } = LIMITS[key]
    upstashLimiters[key] = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(tokens, window),
      prefix: `fundlens-audit:${key}`,
      analytics: false,
    })
  }
  return upstashLimiters[key]!
}

// ── In-memory fallback (dev only — per-instance, not shared) ───────────────────
const memoryBuckets = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS: Record<LimitKey, number> = { upload: 3_600_000, profile: 3_600_000, audit: 3_600_000, agent: 3_600_000 }

function memoryCheck(key: LimitKey, id: string) {
  const now = Date.now()
  const bucketKey = `${key}:${id}`
  const limit = LIMITS[key].tokens
  const existing = memoryBuckets.get(bucketKey)
  if (!existing || existing.resetAt < now) {
    const resetAt = now + WINDOW_MS[key]
    memoryBuckets.set(bucketKey, { count: 1, resetAt })
    return { success: true, limit, remaining: limit - 1, reset: resetAt }
  }
  existing.count += 1
  return {
    success: existing.count <= limit,
    limit,
    remaining: Math.max(0, limit - existing.count),
    reset: existing.resetAt,
  }
}

export interface RateResult {
  success: boolean
  limit: number
  remaining: number
  reset: number   // epoch ms
}

/** Derive a stable client identifier from request headers (open-access app). */
export function clientId(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'anonymous'
}

/** Check the rate limit for a route. Falls back to an in-memory limiter in dev. */
export async function checkRateLimit(key: LimitKey, id: string): Promise<RateResult> {
  if (!hasUpstash) return memoryCheck(key, id)
  const { success, limit, remaining, reset } = await upstashLimiter(key).limit(id)
  return { success, limit, remaining, reset }
}

/**
 * Guard a route handler. Returns a 429 NextResponse when the caller is over the
 * limit, or null when the request may proceed.
 */
export async function enforceRateLimit(req: NextRequest, key: LimitKey): Promise<NextResponse | null> {
  const result = await checkRateLimit(key, clientId(req))
  if (result.success) return null
  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
  return NextResponse.json(
    { success: false, error: 'Rate limit exceeded. Please wait before trying again.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
      },
    },
  )
}
