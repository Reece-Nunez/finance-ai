import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getApiUser } from '@/lib/supabase/api'
import { getUserSubscription } from '@/lib/subscription'

export async function GET(request: NextRequest) {
  try {
    // Check for Bearer token first (mobile), then fall back to cookies (web)
    const authHeader = request.headers.get('authorization')

    let user

    if (authHeader?.startsWith('Bearer ')) {
      const result = await getApiUser(request)
      if (result.error || !result.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = result.user
    } else {
      const supabase = await createClient()
      const { data: { user: cookieUser }, error: authError } = await supabase.auth.getUser()
      if (authError || !cookieUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = cookieUser
    }

    const subscription = await getUserSubscription(user.id)

    return NextResponse.json({
      tier: subscription.tier,
      status: subscription.status,
      isPro: subscription.isPro,
      isTrialing: subscription.isTrialing,
      trialEndsAt: subscription.trialEndsAt?.toISOString() || null,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || null,
    })
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 })
  }
}
