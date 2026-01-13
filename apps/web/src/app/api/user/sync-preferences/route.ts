import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getApiUser } from '@/lib/supabase/api'
import { getUserSubscription } from '@/lib/subscription'
import { SyncFrequency, calculateNextSyncDue } from '@/lib/sync-service'

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

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('sync_frequency, last_auto_sync, next_sync_due, subscription_tier')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching sync preferences:', error)
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
    }

    const isPro = profile?.subscription_tier === 'pro'

    return NextResponse.json({
      sync_frequency: profile?.sync_frequency || 'daily',
      last_auto_sync: profile?.last_auto_sync || null,
      next_sync_due: profile?.next_sync_due || null,
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

    // Calculate next sync due time
    const nextSyncDue = calculateNextSyncDue(effectiveFrequency, subscription.isPro)

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .update({
        sync_frequency: effectiveFrequency,
        next_sync_due: nextSyncDue?.toISOString() || null,
      })
      .eq('user_id', user.id)
      .select('sync_frequency, last_auto_sync, next_sync_due')
      .single()

    if (error) {
      console.error('Error updating sync preferences:', error)
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
    }

    return NextResponse.json({
      sync_frequency: profile.sync_frequency,
      last_auto_sync: profile.last_auto_sync,
      next_sync_due: profile.next_sync_due,
      isPro: subscription.isPro,
      // Inform user if they were downgraded
      downgraded: sync_frequency !== effectiveFrequency,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
