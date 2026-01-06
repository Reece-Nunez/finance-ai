import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export type SubscriptionTier = 'free' | 'pro'
export type SubscriptionStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'canceled'

export interface UserSubscription {
  tier: SubscriptionTier
  status: SubscriptionStatus
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  trialEndsAt: Date | null
  currentPeriodEnd: Date | null
  isTrialing: boolean
  isPro: boolean
}

const PRO_FEATURES = [
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

// Pass supabaseClient for mobile auth, omit for web cookie auth
export async function getUserSubscription(userId: string, supabaseClient?: SupabaseClient): Promise<UserSubscription> {
  const supabase = supabaseClient || await createClient()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select(
      'subscription_tier, subscription_status, stripe_customer_id, stripe_subscription_id, trial_ends_at, current_period_end'
    )
    .eq('user_id', userId)
    .single()

  if (!profile) {
    return {
      tier: 'free',
      status: 'none',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      isTrialing: false,
      isPro: false,
    }
  }

  const tier = (profile.subscription_tier as SubscriptionTier) || 'free'
  const status = (profile.subscription_status as SubscriptionStatus) || 'none'
  const isTrialing = status === 'trialing'
  const isPro = tier === 'pro' && (status === 'active' || status === 'trialing')

  return {
    tier,
    status,
    stripeCustomerId: profile.stripe_customer_id,
    stripeSubscriptionId: profile.stripe_subscription_id,
    trialEndsAt: profile.trial_ends_at ? new Date(profile.trial_ends_at) : null,
    currentPeriodEnd: profile.current_period_end ? new Date(profile.current_period_end) : null,
    isTrialing,
    isPro,
  }
}

export function canAccessFeature(subscription: UserSubscription, feature: ProFeature): boolean {
  if (subscription.isPro) return true
  return !PRO_FEATURES.includes(feature)
}

export function getAccountLimit(subscription: UserSubscription): number {
  return subscription.isPro ? Infinity : 1
}

export async function updateSubscription(
  userId: string,
  updates: {
    tier?: SubscriptionTier
    status?: SubscriptionStatus
    stripeCustomerId?: string
    stripeSubscriptionId?: string
    trialEndsAt?: Date | null
    currentPeriodEnd?: Date | null
  }
): Promise<void> {
  const supabase = await createClient()

  const dbUpdates: Record<string, unknown> = {}

  if (updates.tier !== undefined) dbUpdates.subscription_tier = updates.tier
  if (updates.status !== undefined) dbUpdates.subscription_status = updates.status
  if (updates.stripeCustomerId !== undefined) dbUpdates.stripe_customer_id = updates.stripeCustomerId
  if (updates.stripeSubscriptionId !== undefined)
    dbUpdates.stripe_subscription_id = updates.stripeSubscriptionId
  if (updates.trialEndsAt !== undefined)
    dbUpdates.trial_ends_at = updates.trialEndsAt?.toISOString() || null
  if (updates.currentPeriodEnd !== undefined)
    dbUpdates.current_period_end = updates.currentPeriodEnd?.toISOString() || null

  await supabase.from('user_profiles').update(dbUpdates).eq('user_id', userId)
}
