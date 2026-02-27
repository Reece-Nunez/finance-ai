import { getRedis } from './redis'

export const CACHE_KEYS = {
  accounts: (userId: string) => `accounts:${userId}`,
  spending: (userId: string, period: string) => `spending:${userId}:${period}`,
  budgets: (userId: string) => `budgets:${userId}`,
  budgetAnalytics: (userId: string) => `budgets:analytics:${userId}`,
  subscription: (userId: string) => `subscription:${userId}`,
  recurringPatterns: (userId: string) => `recurring:${userId}`,
  aiSuggestions: (userId: string) => `ai:suggestions:${userId}`,
  aiSuggestionsContext: (userId: string) => `ai:suggestions:context:${userId}`,
  merchantCategory: (userId: string, merchantKey: string) => `merchant:cat:${userId}:${merchantKey}`,
  chatContext: (userId: string) => `chat:context:${userId}`,
  recurringDetection: (userId: string) => `recurring:detection:${userId}`,
} as const

export const CACHE_TTL = {
  accounts: 300,
  spending: 900,
  budgets: 600,
  budgetAnalytics: 600,
  subscription: 3600,
  recurringPatterns: 1800,
  aiSuggestions: 86400,
  aiSuggestionsContext: 86400,
  merchantCategory: 604800,
  chatContext: 900,
  recurringDetection: 86400,
} as const

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis()
  if (!redis) return null

  try {
    return await redis.get<T>(key)
  } catch (error) {
    console.error(`[Cache] Error getting ${key}:`, error)
    return null
  }
}

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
