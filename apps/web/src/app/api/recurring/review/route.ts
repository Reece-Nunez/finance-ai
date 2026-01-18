import { createClient } from '@/lib/supabase/server'
import { getApiUser } from '@/lib/supabase/api'
import { NextRequest, NextResponse } from 'next/server'

interface RecurringSuggestion {
  id: string
  user_id: string
  name: string
  display_name: string | null
  merchant_pattern: string
  frequency: string | null
  amount: number | null
  average_amount: number | null
  is_income: boolean
  typical_day: number | null
  next_expected_date: string | null
  last_seen_date: string | null
  category: string | null
  confidence: string
  occurrences: number
  bill_type: string | null
  detection_reason: string | null
  transaction_ids: string[]
  status: string
  reviewed_at: string | null
  created_at: string
}

// GET - Fetch pending suggestions for review
export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'pending'

  const { data: suggestions, error } = await supabase
    .from('recurring_suggestions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', status)
    .order('confidence', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get count of pending for badge
  const { count } = await supabase
    .from('recurring_suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'pending')

  return NextResponse.json({
    suggestions: suggestions || [],
    pendingCount: count || 0,
  })
}

// POST - Bulk confirm or deny suggestions
export async function POST(request: NextRequest) {
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

  const body = await request.json()
  const { ids, action, denial_reason } = body

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array is required' }, { status: 400 })
  }

  if (!action || !['confirm', 'deny'].includes(action)) {
    return NextResponse.json({ error: 'action must be "confirm" or "deny"' }, { status: 400 })
  }

  // Get the suggestions being processed
  const { data: suggestions, error: fetchError } = await supabase
    .from('recurring_suggestions')
    .select('*')
    .eq('user_id', user.id)
    .in('id', ids)

  if (fetchError || !suggestions) {
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 })
  }

  const now = new Date().toISOString()
  let confirmed = 0
  let denied = 0

  if (action === 'confirm') {
    // Move confirmed suggestions to recurring_patterns
    for (const suggestion of suggestions) {
      // Remove from dismissals if previously dismissed
      await supabase
        .from('recurring_dismissals')
        .delete()
        .eq('user_id', user.id)
        .eq('merchant_pattern', suggestion.merchant_pattern)

      // Upsert to recurring_patterns
      const { error: insertError } = await supabase.from('recurring_patterns').upsert({
        user_id: user.id,
        name: suggestion.name,
        display_name: suggestion.display_name || suggestion.name,
        merchant_pattern: suggestion.merchant_pattern,
        frequency: suggestion.frequency || 'monthly',
        amount: suggestion.amount || 0,
        average_amount: suggestion.average_amount || suggestion.amount || 0,
        is_income: suggestion.is_income,
        typical_day: suggestion.typical_day,
        next_expected_date: suggestion.next_expected_date,
        last_seen_date: suggestion.last_seen_date,
        category: suggestion.category,
        confidence: suggestion.confidence,
        occurrences: suggestion.occurrences,
        bill_type: suggestion.bill_type,
        ai_detected: true,
        last_ai_analysis: now,
        transaction_ids: suggestion.transaction_ids,
      }, { onConflict: 'user_id,merchant_pattern' })

      if (!insertError) {
        confirmed++
      }
    }

    // Update suggestions status
    await supabase
      .from('recurring_suggestions')
      .update({ status: 'confirmed', reviewed_at: now })
      .eq('user_id', user.id)
      .in('id', ids)

  } else {
    // Deny - add to dismissals and update status
    for (const suggestion of suggestions) {
      // Extract keywords from merchant name for AI learning
      const keywords = suggestion.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w: string) => w.length > 2)
        .slice(0, 5)

      // Add to dismissals with denial reason
      await supabase.from('recurring_dismissals').upsert({
        user_id: user.id,
        merchant_pattern: suggestion.merchant_pattern,
        original_name: suggestion.name,
        reason: denial_reason || 'denied',
        denial_reason: denial_reason || null,
        merchant_keywords: keywords,
        dismissed_at: now,
      }, { onConflict: 'user_id,merchant_pattern' })

      denied++
    }

    // Update suggestions status
    await supabase
      .from('recurring_suggestions')
      .update({ status: 'denied', reviewed_at: now })
      .eq('user_id', user.id)
      .in('id', ids)
  }

  // Get updated pending count
  const { count } = await supabase
    .from('recurring_suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'pending')

  return NextResponse.json({
    success: true,
    confirmed,
    denied,
    pendingCount: count || 0,
    message: action === 'confirm'
      ? `Confirmed ${confirmed} recurring transaction${confirmed !== 1 ? 's' : ''}`
      : `Denied ${denied} suggestion${denied !== 1 ? 's' : ''}`,
  })
}

// DELETE - Clear all pending suggestions (optional admin action)
export async function DELETE(request: NextRequest) {
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

  // Delete all pending suggestions for this user
  const { error } = await supabase
    .from('recurring_suggestions')
    .delete()
    .eq('user_id', user.id)
    .eq('status', 'pending')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
