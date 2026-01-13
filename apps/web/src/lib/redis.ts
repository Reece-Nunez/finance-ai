import { Redis } from '@upstash/redis'

// Singleton Redis client
// Uses HTTP-based connection (perfect for serverless/Vercel)
let redis: Redis | null = null

/**
 * Get the Redis client instance
 * Returns null if Redis is not configured (for development without Redis)
 */
export function getRedis(): Redis | null {
  if (redis) return redis

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    // Redis not configured - return null to allow fallback
    console.warn('[Redis] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not configured')
    return null
  }

  redis = new Redis({
    url,
    token,
  })

  return redis
}

/**
 * Check if Redis is available
 */
export function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

/**
 * Health check for Redis connection
 */
export async function checkRedisHealth(): Promise<{ healthy: boolean; latency?: number }> {
  const client = getRedis()
  if (!client) {
    return { healthy: false }
  }

  const start = Date.now()
  try {
    await client.ping()
    return { healthy: true, latency: Date.now() - start }
  } catch (error) {
    console.error('[Redis] Health check failed:', error)
    return { healthy: false }
  }
}
