export type SubscriptionTier = 'free' | 'pro'

export type SubscriptionStatus =
  | 'none'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'

export interface UserSubscription {
  tier: SubscriptionTier
  status: SubscriptionStatus
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  trialEndsAt: Date | string | null
  currentPeriodEnd: Date | string | null
  isTrialing: boolean
  isPro: boolean
}

export const PRO_FEATURES = [
  'ai_chat',
  'nl_search',
  'ai_categorization',
  'ai_suggestions',
  'anomaly_detection',
  'cash_flow',
  'health_score',
  'unlimited_accounts',
] as const

export type ProFeature = (typeof PRO_FEATURES)[number]

export function canAccessFeature(
  subscription: Pick<UserSubscription, 'isPro'>,
  feature: ProFeature
): boolean {
  if (subscription.isPro) return true
  return !PRO_FEATURES.includes(feature)
}

export function getAccountLimit(
  subscription: Pick<UserSubscription, 'isPro'>
): number {
  return subscription.isPro ? Infinity : 1
}
