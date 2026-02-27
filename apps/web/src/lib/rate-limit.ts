import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { log } from './logger'
import { getRedis, isRedisConfigured } from './redis'

const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetTime < now) {
        rateLimitStore.delete(key)
      }
    }
  }, 60000)
}

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
  limit: number
  windowSeconds: number
  identifier: string
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTime: number
}

export const RATE_LIMITS = {
  api: { limit: 100, windowSeconds: 60, identifier: 'api' },
  auth: { limit: 5, windowSeconds: 60, identifier: 'auth' },
  ai: { limit: 20, windowSeconds: 60, identifier: 'ai' },
  plaid: { limit: 10, windowSeconds: 60, identifier: 'plaid' },
  stripe: { limit: 30, windowSeconds: 60, identifier: 'stripe' },
  webhook: { limit: 100, windowSeconds: 60, identifier: 'webhook' },
  strict: { limit: 10, windowSeconds: 60, identifier: 'strict' },
} as const

function getClientIdentifier(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp

  return 'unknown'
}

function checkRateLimitInMemory(clientId: string, config: RateLimitConfig): RateLimitResult {
  const key = `${config.identifier}:${clientId}`
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000
  const existing = rateLimitStore.get(key)

  if (!existing || existing.resetTime < now) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return { success: true, limit: config.limit, remaining: config.limit - 1, resetTime: now + windowMs }
  }

  existing.count++
  rateLimitStore.set(key, existing)

  const remaining = Math.max(0, config.limit - existing.count)
  const success = existing.count <= config.limit

  if (!success) {
    log.warn('Rate limit exceeded', { clientId, identifier: config.identifier, count: existing.count, limit: config.limit })
  }

  return { success, limit: config.limit, remaining, resetTime: existing.resetTime }
}

export async function checkRateLimit(request: NextRequest, config: RateLimitConfig): Promise<RateLimitResult> {
  const clientId = getClientIdentifier(request)

  const redisLimiters = getRedisRateLimiters()
  if (redisLimiters) {
    const limiter = redisLimiters.get(config.identifier)
    if (limiter) {
      try {
        const result = await limiter.limit(clientId)

        if (!result.success) {
          log.warn('Rate limit exceeded (Redis)', { clientId, identifier: config.identifier, limit: result.limit, remaining: result.remaining })
        }

        return { success: result.success, limit: result.limit, remaining: result.remaining, resetTime: result.reset }
      } catch (error) {
        log.error('Redis rate limit error, falling back to in-memory', { error })
      }
    }
  }

  return checkRateLimitInMemory(clientId, config)
}

function createRateLimitHeaders(result: RateLimitResult): Headers {
  const headers = new Headers()
  headers.set('X-RateLimit-Limit', result.limit.toString())
  headers.set('X-RateLimit-Remaining', result.remaining.toString())
  headers.set('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString())
  return headers
}

export async function rateLimit(request: NextRequest, config: RateLimitConfig = RATE_LIMITS.api): Promise<NextResponse | null> {
  const result = await checkRateLimit(request, config)
  const headers = createRateLimitHeaders(result)

  if (!result.success) {
    return NextResponse.json(
      {
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again in ${Math.ceil((result.resetTime - Date.now()) / 1000)} seconds.`,
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      },
      { status: 429, headers }
    )
  }

  return null
}
