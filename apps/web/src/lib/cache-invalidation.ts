import { cacheDelete, cacheDeletePattern, CACHE_KEYS } from './cache'
import { isRedisConfigured } from './redis'

export const invalidateCache = {
  async onTransactionUpdate(userId: string) {
    if (!isRedisConfigured()) return
    await Promise.all([
      cacheDeletePattern(`spending:${userId}:*`),
      cacheDelete(CACHE_KEYS.budgetAnalytics(userId)),
      cacheDeletePattern(`recurring:${userId}`),
    ])
  },

  async onAccountUpdate(userId: string) {
    if (!isRedisConfigured()) return
    await Promise.all([
      cacheDelete(CACHE_KEYS.accounts(userId)),
      cacheDeletePattern(`spending:${userId}:*`),
    ])
  },

  async onBudgetUpdate(userId: string) {
    if (!isRedisConfigured()) return
    await Promise.all([
      cacheDelete(CACHE_KEYS.budgets(userId)),
      cacheDelete(CACHE_KEYS.budgetAnalytics(userId)),
    ])
  },

  async onSubscriptionUpdate(userId: string) {
    if (!isRedisConfigured()) return
    await cacheDelete(CACHE_KEYS.subscription(userId))
  },

  async onUserLogout(userId: string) {
    if (!isRedisConfigured()) return
    await Promise.all([
      cacheDeletePattern(`*:${userId}`),
      cacheDeletePattern(`*:${userId}:*`),
    ])
  },

  async onRecurringUpdate(userId: string) {
    if (!isRedisConfigured()) return
    await cacheDelete(CACHE_KEYS.recurringPatterns(userId))
  },
}
