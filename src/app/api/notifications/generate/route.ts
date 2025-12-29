import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateNotifications, checkUnusualSpending } from '@/lib/notifications'

export async function POST() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Generate standard notifications
    const count = await generateNotifications(supabase, user.id)

    // Also check for unusual spending
    const unusualNotifs = await checkUnusualSpending(supabase, user.id)

    // Insert unusual spending notifications
    for (const notif of unusualNotifs) {
      // Check for duplicates
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', notif.type)
        .eq('title', notif.title)
        .gte('created_at', oneDayAgo)
        .limit(1)

      if (!existing || existing.length === 0) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          ...notif,
        })
      }
    }

    return NextResponse.json({
      success: true,
      notificationsGenerated: count + unusualNotifs.length,
    })
  } catch (error) {
    console.error('Failed to generate notifications:', error)
    return NextResponse.json(
      { error: 'Failed to generate notifications' },
      { status: 500 }
    )
  }
}
