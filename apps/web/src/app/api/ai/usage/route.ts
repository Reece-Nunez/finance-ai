import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AI_LIMITS, AIFeature } from '@/lib/ai-usage'
import { getUserSubscription } from '@/lib/subscription'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is pro using the same function as the subscription API
  const subscription = await getUserSubscription(user.id)
  const isPro = subscription.isPro

  // Get today's usage
  const today = new Date().toISOString().split('T')[0]
  const { data: usage } = await supabase
    .from('ai_usage')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today)
    .single()

  // Build usage stats for each feature
  const features: AIFeature[] = ['categorization', 'chat', 'recurring_detection', 'insights', 'search']
  const limits = isPro ? AI_LIMITS.pro : AI_LIMITS.free

  const stats = features.map(feature => {
    const featureKey = `${feature}_requests` as string
    const used = usage?.[featureKey] ?? 0
    const limit = limits[feature]

    return {
      feature,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      percentage: Math.round((used / limit) * 100),
    }
  })

  // Get token usage
  const inputTokens = usage?.input_tokens ?? 0
  const outputTokens = usage?.output_tokens ?? 0

  return NextResponse.json({
    isPro,
    date: today,
    stats,
    tokens: {
      input: inputTokens,
      output: outputTokens,
      total: inputTokens + outputTokens,
    },
  })
}
