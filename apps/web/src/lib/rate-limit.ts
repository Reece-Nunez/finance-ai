import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { log } from './logger'
import { getRedis, isRedisConfigured } from './redis'

// ============================================================================
// In-memory fallback for development (when Redis not configured)
// ============================================================================
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Clean up expired entries periodically (only used when Redis not available)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetTime < now) {
        rateLimitStore.delete(key)
      }
    }
  }, 60000) // Clean up every minute
}

// ============================================================================
// Redis-based rate limiters (used in production)
// ============================================================================
let redisRateLimiters: Map<string, Ratelimit> | null = null

function getRedisRateLimiters(): Map<string, Ratelimit> | null {
  if (!isRedisConfigured()) return null

  if (redisRateLimiters) return redisRateLimiters

  const redis = getRedis()
  if (!redis) return null

  redisRateLimiters = new Map([
    ['api', new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '60 s'), prefix: 'rl:api' })],
    ['auth', new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '60 s'), prefix: 'rl:auth' })],
    ['ai', new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '60 s'), prefix: 'rl:ai' })],
    ['plaid', new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '60 s'), prefix: 'rl:plaid' })],
    ['stripe', new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '60 s'), prefix: 'rl:stripe' })],
    ['webhook', new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '60 s'), prefix: 'rl:webhook' })],
    ['strict', new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '60 s'), prefix: 'rl:strict' })],
  ])

  return redisRateLimiters
}

export interface RateLimitConfig {
  // Maximum number of requests
  limit: number
  // Time window in seconds
  windowSeconds: number
  // Identifier for the rate limit (e.g., 'api', 'auth', 'ai')
  identifier: string
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTime: number
}

// Default rate limit configurations
export const RATE_LIMITS = {
  // General API: 100 requests per minute
  api: { limit: 100, windowSeconds: 60, identifier: 'api' },
  // Authentication: 5 attempts per minute (prevent brute force)
  auth: { limit: 5, windowSeconds: 60, identifier: 'auth' },
  // AI/Chat: 20 requests per minute (expensive operations)
  ai: { limit: 20, windowSeconds: 60, identifier: 'ai' },
  // Plaid operations: 10 per minute
  plaid: { limit: 10, windowSeconds: 60, identifier: 'plaid' },
  // Stripe operations: 30 per minute
  stripe: { limit: 30, windowSeconds: 60, identifier: 'stripe' },
  // Webhooks: 100 per minute
  webhook: { limit: 100, windowSeconds: 60, identifier: 'webhook' },
  // Strict: 10 requests per minute (for sensitive operations)
  strict: { limit: 10, windowSeconds: 60, identifier: 'strict' },
} as const

/**
 * Get the client identifier for rate limiting
 * Uses IP address or forwarded IP from proxy
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get real IP from common proxy headers
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    // Take the first IP if multiple are present
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback to a generic identifier
  return 'unknown'
}

/**
 * Check rate limit for a request (in-memory fallback)
 */
function checkRateLimitInMemory(
  clientId: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = `${config.identifier}:${clientId}`
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000

  const existing = rateLimitStore.get(key)

  if (!existing || existing.resetTime < now) {
    // First request or window expired
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    })

    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetTime: now + windowMs,
    }
  }

  // Increment count
  existing.count++
  rateLimitStore.set(key, existing)

  const remaining = Math.max(0, config.limit - existing.count)
  const success = existing.count <= config.limit

  if (!success) {
    log.warn('Rate limit exceeded', {
      clientId,
      identifier: config.identifier,
      count: existing.count,
      limit: config.limit,
    })
  }

  return {
    success,
    limit: config.limit,
    remaining,
    resetTime: existing.resetTime,
  }
}

/**
 * Check rate limit for a request using Redis (if available) or in-memory fallback
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const clientId = getClientIdentifier(request)

  // Try Redis first
  const redisLimiters = getRedisRateLimiters()
  if (redisLimiters) {
    const limiter = redisLimiters.get(config.identifier)
    if (limiter) {
      try {
        const result = await limiter.limit(clientId)

        if (!result.success) {
          log.warn('Rate limit exceeded (Redis)', {
            clientId,
            identifier: config.identifier,
            limit: result.limit,
            remaining: result.remaining,
          })
        }

        return {
          success: result.success,
          limit: result.limit,
          remaining: result.remaining,
          resetTime: result.reset,
        }
      } catch (error) {
        // Redis error - fall back to in-memory
        log.error('Redis rate limit error, falling back to in-memory', { error })
      }
    }
  }

  // Fallback to in-memory
  return checkRateLimitInMemory(clientId, config)
}

/**
 * Synchronous version for backwards compatibility (uses in-memory only)
 * @deprecated Use checkRateLimit instead
 */
export function checkRateLimitSync(
  request: NextRequest,
  config: RateLimitConfig
): RateLimitResult {
  const clientId = getClientIdentifier(request)
  return checkRateLimitInMemory(clientId, config)
}

/**
 * Create rate limit headers for response
 */
export function createRateLimitHeaders(result: RateLimitResult): Headers {
  const headers = new Headers()
  headers.set('X-RateLimit-Limit', result.limit.toString())
  headers.set('X-RateLimit-Remaining', result.remaining.toString())
  headers.set('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString())
  return headers
}

/**
 * Rate limit middleware for API routes
 * Returns null if allowed, or a Response if rate limited
 */
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig = RATE_LIMITS.api
): Promise<NextResponse | null> {
  const result = await checkRateLimit(request, config)
  const headers = createRateLimitHeaders(result)

  if (!result.success) {
    return NextResponse.json(
      {
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again in ${Math.ceil((result.resetTime - Date.now()) / 1000)} seconds.`,
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      },
      {
        status: 429,
        headers,
      }
    )
  }

  return null
}

/**
 * Higher-order function to wrap API handlers with rate limiting
 */
export function withRateLimit<T extends NextRequest>(
  handler: (request: T) => Promise<NextResponse>,
  config: RateLimitConfig = RATE_LIMITS.api
) {
  return async (request: T): Promise<NextResponse> => {
    const rateLimitResponse = await rateLimit(request, config)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const response = await handler(request)

    // Add rate limit headers to successful responses too
    const result = await checkRateLimit(request, config)
    const headers = createRateLimitHeaders(result)
    headers.forEach((value, key) => {
      response.headers.set(key, value)
    })

    return response
  }
}
