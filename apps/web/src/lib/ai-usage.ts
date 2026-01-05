import { SupabaseClient } from '@supabase/supabase-js'

// AI Usage limits per day
export const AI_LIMITS = {
  free: {
    categorization: 10,
    chat: 20,
    recurring_detection: 5,
    insights: 10,
    search: 20,
  },
  pro: {
    categorization: 1000,
    chat: 1000,
    recurring_detection: 1000,
    insights: 1000,
    search: 1000,
  },
} as const

export type AIFeature = 'categorization' | 'chat' | 'recurring_detection' | 'insights' | 'search'

interface UsageCheckResult {
  allowed: boolean
  used: number
  limit: number
  remaining: number
}

/**
 * Check if user can make an AI request for a given feature
 */
export async function checkAIUsage(
  supabase: SupabaseClient,
  userId: string,
  feature: AIFeature,
  isPro: boolean
): Promise<UsageCheckResult> {
  const limit = isPro ? AI_LIMITS.pro[feature] : AI_LIMITS.free[feature]

  // Get today's usage
  const today = new Date().toISOString().split('T')[0]
  const { data: usage } = await supabase
    .from('ai_usage')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  const featureKey = `${feature}_requests` as const
  const used = usage?.[featureKey] ?? 0

  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  }
}

/**
 * Increment AI usage count for a feature
 */
export async function incrementAIUsage(
  supabase: SupabaseClient,
  userId: string,
  feature: AIFeature,
  inputTokens: number = 0,
  outputTokens: number = 0
): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0]
  const featureKey = `${feature}_requests` as const

  // Upsert usage record
  const { data: existing } = await supabase
    .from('ai_usage')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  if (existing) {
    // Update existing record - increment the specific feature count
    const currentCount = (existing as Record<string, number>)[featureKey] ?? 0
    const currentInputTokens = (existing as Record<string, number>).input_tokens ?? 0
    const currentOutputTokens = (existing as Record<string, number>).output_tokens ?? 0

    const { error } = await supabase
      .from('ai_usage')
      .update({
        [featureKey]: currentCount + 1,
        input_tokens: currentInputTokens + inputTokens,
        output_tokens: currentOutputTokens + outputTokens,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    return !error
  } else {
    // Insert new record
    const { error } = await supabase
      .from('ai_usage')
      .insert({
        user_id: userId,
        date: today,
        [featureKey]: 1,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      })

    return !error
  }
}

/**
 * Check usage and increment if allowed - returns whether request can proceed
 */
export async function checkAndIncrementUsage(
  supabase: SupabaseClient,
  userId: string,
  feature: AIFeature,
  isPro: boolean
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const check = await checkAIUsage(supabase, userId, feature, isPro)

  if (!check.allowed) {
    return {
      allowed: false,
      remaining: 0,
      limit: check.limit,
    }
  }

  await incrementAIUsage(supabase, userId, feature)

  return {
    allowed: true,
    remaining: check.remaining - 1,
    limit: check.limit,
  }
}

/**
 * Get all usage stats for a user
 */
export async function getUsageStats(
  supabase: SupabaseClient,
  userId: string,
  isPro: boolean
): Promise<Record<AIFeature, UsageCheckResult>> {
  const features: AIFeature[] = ['categorization', 'chat', 'recurring_detection', 'insights', 'search']
  const results: Record<string, UsageCheckResult> = {}

  for (const feature of features) {
    results[feature] = await checkAIUsage(supabase, userId, feature, isPro)
  }

  return results as Record<AIFeature, UsageCheckResult>
}

/**
 * Rate limit error response helper
 */
export function rateLimitResponse(feature: string, limit: number, isPro: boolean) {
  return {
    error: 'rate_limit_exceeded',
    message: `Daily AI ${feature} limit reached (${limit} requests/day). ${
      isPro ? 'Limit resets at midnight.' : 'Upgrade to Pro for higher limits.'
    }`,
    limit,
    isPro,
  }
}
