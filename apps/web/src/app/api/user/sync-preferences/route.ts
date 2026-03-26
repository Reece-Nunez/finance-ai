import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserSubscription } from '@/lib/subscription'
import { SyncFrequency } from '@/lib/sync-service'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('subscription_tier')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching sync preferences:', error)
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
    }

    const isPro = profile?.subscription_tier === 'pro'

    // sync_frequency columns not yet in DB — return defaults
    return NextResponse.json({
      sync_frequency: 'daily',
      last_auto_sync: null,
      next_sync_due: null,
      isPro,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sync_frequency } = body as { sync_frequency: SyncFrequency }

    // Validate sync_frequency
    if (!['manual', 'daily', 'frequent'].includes(sync_frequency)) {
      return NextResponse.json(
        { error: 'Invalid sync frequency. Must be manual, daily, or frequent.' },
        { status: 400 }
      )
    }

    // Check subscription for 'frequent' option
    const subscription = await getUserSubscription(user.id, supabase)

    // If user selects 'frequent' but isn't Pro, downgrade to daily
    let effectiveFrequency = sync_frequency
    if (sync_frequency === 'frequent' && !subscription.isPro) {
      effectiveFrequency = 'daily'
    }

    // sync_frequency columns not yet in DB — return the selection without persisting
    return NextResponse.json({
      sync_frequency: effectiveFrequency,
      last_auto_sync: null,
      next_sync_due: null,
      isPro: subscription.isPro,
      downgraded: sync_frequency !== effectiveFrequency,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
