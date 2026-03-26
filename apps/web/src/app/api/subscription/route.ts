import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Query subscription directly using the authenticated supabase client
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('subscription_tier, subscription_status, trial_ends_at, current_period_end')
      .eq('user_id', user.id)
      .single()

    const tier = profile?.subscription_tier || 'free'
    const status = profile?.subscription_status || 'none'
    const isTrialing = status === 'trialing'
    const isPro = tier === 'pro' && (status === 'active' || status === 'trialing')

    return NextResponse.json({
      tier,
      status,
      isPro,
      isTrialing,
      trialEndsAt: profile?.trial_ends_at || null,
      currentPeriodEnd: profile?.current_period_end || null,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 })
  }
}
