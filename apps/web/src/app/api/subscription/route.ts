import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getApiUser } from '@/lib/supabase/api'

export async function GET(request: NextRequest) {
  try {
    // Check for Bearer token first (mobile), then fall back to cookies (web)
    const authHeader = request.headers.get('authorization')

    let supabase
    let user

    if (authHeader?.startsWith('Bearer ')) {
      const result = await getApiUser(request)
      if (result.error || !result.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      supabase = result.supabase
      user = result.user
    } else {
      supabase = await createClient()
      const { data: { user: cookieUser }, error: authError } = await supabase.auth.getUser()
      if (authError || !cookieUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = cookieUser
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
    })
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 })
  }
}
