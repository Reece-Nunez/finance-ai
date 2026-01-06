import { NextRequest, NextResponse } from 'next/server'
import { log } from './logger'

// In-memory store for rate limiting
// In production, replace with Redis/Upstash for distributed rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Clean up every minute

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
 * Check rate limit for a request
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): RateLimitResult {
  const clientId = getClientIdentifier(request)
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
export function rateLimit(
  request: NextRequest,
  config: RateLimitConfig = RATE_LIMITS.api
): NextResponse | null {
  const result = checkRateLimit(request, config)
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
    const rateLimitResponse = rateLimit(request, config)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const response = await handler(request)

    // Add rate limit headers to successful responses too
    const result = checkRateLimit(request, config)
    const headers = createRateLimitHeaders(result)
    headers.forEach((value, key) => {
      response.headers.set(key, value)
    })

    return response
  }
}
