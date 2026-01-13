import { cacheDelete, cacheDeletePattern, CACHE_KEYS } from './cache'
import { isRedisConfigured } from './redis'

/**
 * Cache invalidation triggers by entity type
 * Call these when data changes to ensure cache consistency
 */
export const invalidateCache = {
  /**
   * Invalidate when transactions are synced or modified
   */
  async onTransactionUpdate(userId: string): Promise<void> {
    if (!isRedisConfigured()) return

    await Promise.all([
      cacheDeletePattern(`spending:${userId}:*`),
      cacheDelete(CACHE_KEYS.budgetAnalytics(userId)),
      cacheDeletePattern(`recurring:${userId}`),
    ])
  },

  /**
   * Invalidate when accounts are synced or modified
   */
  async onAccountUpdate(userId: string): Promise<void> {
    if (!isRedisConfigured()) return

    await Promise.all([
      cacheDelete(CACHE_KEYS.accounts(userId)),
      cacheDeletePattern(`spending:${userId}:*`),
    ])
  },

  /**
   * Invalidate when budgets are created/updated/deleted
   */
  async onBudgetUpdate(userId: string): Promise<void> {
    if (!isRedisConfigured()) return

    await Promise.all([
      cacheDelete(CACHE_KEYS.budgets(userId)),
      cacheDelete(CACHE_KEYS.budgetAnalytics(userId)),
    ])
  },

  /**
   * Invalidate when subscription changes (upgrade, downgrade, cancel)
   */
  async onSubscriptionUpdate(userId: string): Promise<void> {
    if (!isRedisConfigured()) return

    await cacheDelete(CACHE_KEYS.subscription(userId))
  },

  /**
   * Invalidate all user data (e.g., on logout or account deletion)
   */
  async onUserLogout(userId: string): Promise<void> {
    if (!isRedisConfigured()) return

    await Promise.all([
      cacheDeletePattern(`*:${userId}`),
      cacheDeletePattern(`*:${userId}:*`),
    ])
  },

  /**
   * Invalidate recurring patterns cache
   */
  async onRecurringUpdate(userId: string): Promise<void> {
    if (!isRedisConfigured()) return

    await cacheDelete(CACHE_KEYS.recurringPatterns(userId))
  },
}

/**
 * Helper to wrap mutation handlers with automatic cache invalidation
 */
export function withCacheInvalidation<T extends (...args: unknown[]) => Promise<unknown>>(
  invalidationType: keyof typeof invalidateCache,
  getUserId: (...args: Parameters<T>) => string,
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    const result = await handler(...args)
    const userId = getUserId(...args)
    await invalidateCache[invalidationType](userId)
    return result
  }) as T
}
