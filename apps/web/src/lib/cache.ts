import { getRedis, isRedisConfigured } from './redis'

// Cache key prefixes for different data types
export const CACHE_KEYS = {
  accounts: (userId: string) => `accounts:${userId}`,
  spending: (userId: string, period: string) => `spending:${userId}:${period}`,
  budgets: (userId: string) => `budgets:${userId}`,
  budgetAnalytics: (userId: string) => `budgets:analytics:${userId}`,
  subscription: (userId: string) => `subscription:${userId}`,
  recurringPatterns: (userId: string) => `recurring:${userId}`,
  // AI optimization caches
  aiSuggestions: (userId: string) => `ai:suggestions:${userId}`,
  aiSuggestionsContext: (userId: string) => `ai:suggestions:context:${userId}`,
  merchantCategory: (userId: string, merchantKey: string) => `merchant:cat:${userId}:${merchantKey}`,
  chatContext: (userId: string) => `chat:context:${userId}`,
  recurringDetection: (userId: string) => `recurring:detection:${userId}`,
} as const

// Default TTLs in seconds
export const CACHE_TTL = {
  accounts: 300, // 5 minutes
  spending: 900, // 15 minutes
  budgets: 600, // 10 minutes
  budgetAnalytics: 600, // 10 minutes
  subscription: 3600, // 1 hour
  recurringPatterns: 1800, // 30 minutes
  // AI optimization TTLs
  aiSuggestions: 86400, // 24 hours (1 day) - users can manually refresh
  aiSuggestionsContext: 86400, // 24 hours
  merchantCategory: 604800, // 7 days - merchant categories rarely change
  chatContext: 900, // 15 minutes - balance between freshness and cost
  recurringDetection: 86400, // 24 hours - only refresh on new transactions or manual
} as const

/**
 * Get a value from cache
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis()
  if (!redis) return null

  try {
    const value = await redis.get<T>(key)
    return value
  } catch (error) {
    console.error(`[Cache] Error getting ${key}:`, error)
    return null
  }
}

/**
 * Set a value in cache with TTL
 */
export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<boolean> {
  const redis = getRedis()
  if (!redis) return false

  try {
    await redis.set(key, value, { ex: ttlSeconds })
    return true
  } catch (error) {
    console.error(`[Cache] Error setting ${key}:`, error)
    return false
  }
}

/**
 * Delete a value from cache
 */
export async function cacheDelete(key: string): Promise<boolean> {
  const redis = getRedis()
  if (!redis) return false

  try {
    await redis.del(key)
    return true
  } catch (error) {
    console.error(`[Cache] Error deleting ${key}:`, error)
    return false
  }
}

/**
 * Delete multiple keys matching a pattern
 * Note: This uses SCAN for safety (no KEYS command)
 */
export async function cacheDeletePattern(pattern: string): Promise<number> {
  const redis = getRedis()
  if (!redis) return 0

  try {
    let cursor = '0'
    let deletedCount = 0

    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 }) as [string, string[]]
      cursor = nextCursor

      if (keys.length > 0) {
        await redis.del(...keys)
        deletedCount += keys.length
      }
    } while (cursor !== '0')

    return deletedCount
  } catch (error) {
    console.error(`[Cache] Error deleting pattern ${pattern}:`, error)
    return 0
  }
}

/**
 * Get or set pattern - fetch from cache or compute and cache
 */
export async function cacheGetOrSet<T>(
  key: string,
  ttlSeconds: number,
  computeFn: () => Promise<T>
): Promise<T> {
  // Try cache first
  const cached = await cacheGet<T>(key)
  if (cached !== null) {
    return cached
  }

  // Compute the value
  const value = await computeFn()

  // Cache it (fire and forget)
  cacheSet(key, value, ttlSeconds).catch(() => {
    // Ignore cache set errors
  })

  return value
}

/**
 * Wrapper for adding caching to API responses
 * Returns cached data if available, otherwise executes fetchFn and caches result
 */
export async function withCache<T>(
  userId: string,
  cacheKey: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>
): Promise<{ data: T; fromCache: boolean }> {
  // Skip cache if not configured
  if (!isRedisConfigured()) {
    return { data: await fetchFn(), fromCache: false }
  }

  const fullKey = `${cacheKey}:${userId}`

  // Try cache
  const cached = await cacheGet<T>(fullKey)
  if (cached !== null) {
    return { data: cached, fromCache: true }
  }

  // Fetch and cache
  const data = await fetchFn()
  await cacheSet(fullKey, data, ttlSeconds)

  return { data, fromCache: false }
}
