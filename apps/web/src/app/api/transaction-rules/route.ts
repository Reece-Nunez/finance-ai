import { createClient } from '@/lib/supabase/server'
import { getApiUser } from '@/lib/supabase/api'
import { NextRequest, NextResponse } from 'next/server'

// Normalize merchant name for pattern matching (same as recurring/route.ts)
function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .slice(0, 3)
    .join(' ')
    .trim()
}

export async function GET(request: NextRequest) {
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

  const { data: rules, error } = await supabase
    .from('transaction_rules')
    .select('*')
    .eq('user_id', user.id)
    .order('priority', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rules })
}

export async function POST(request: NextRequest) {
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

  const body = await request.json()
  const {
    match_field = 'name',
    match_pattern,
    display_name,
    set_category,
    set_as_income,
    set_ignore_type,
    description,
    apply_to_existing = true,
  } = body

  if (!match_pattern) {
    return NextResponse.json({ error: 'Match pattern is required' }, { status: 400 })
  }

  // Create the rule
  const { data: rule, error } = await supabase
    .from('transaction_rules')
    .insert({
      user_id: user.id,
      match_field,
      match_pattern,
      display_name,
      set_category,
      set_as_income: set_as_income || false,
      set_ignore_type: set_ignore_type || null,
      description,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Apply rule to existing transactions if requested
  if (apply_to_existing) {
    const updates: Record<string, unknown> = {}
    if (display_name) updates.display_name = display_name
    if (set_category) updates.category = set_category
    // Handle is_income: set to true if enabled, false if explicitly disabled
    if (set_as_income === true) {
      updates.is_income = true
    } else if (set_as_income === false && body.unset_income) {
      // Only unset if explicitly requested (to avoid breaking existing behavior)
      updates.is_income = false
    }
    if (set_ignore_type) updates.ignore_type = set_ignore_type

    if (Object.keys(updates).length > 0) {
      // Build the query based on match_field
      let query = supabase
        .from('transactions')
        .update(updates)
        .eq('user_id', user.id)

      if (match_field === 'name') {
        query = query.ilike('name', `%${match_pattern}%`)
      } else if (match_field === 'merchant_name') {
        query = query.ilike('merchant_name', `%${match_pattern}%`)
      } else {
        // 'any' - match either field
        // Supabase doesn't support OR in update, so we do two updates
        await supabase
          .from('transactions')
          .update(updates)
          .eq('user_id', user.id)
          .ilike('name', `%${match_pattern}%`)

        await supabase
          .from('transactions')
          .update(updates)
          .eq('user_id', user.id)
          .ilike('merchant_name', `%${match_pattern}%`)
      }

      if (match_field !== 'any') {
        await query
      }
    }

    // If unsetting income, also remove from recurring patterns
    if (body.unset_income) {
      // Get all recurring patterns for this user
      const { data: patterns } = await supabase
        .from('recurring_patterns')
        .select('id, merchant_pattern, name, display_name')
        .eq('user_id', user.id)
        .eq('is_income', true)

      // Find patterns that match the rule pattern
      const rulePatternLower = match_pattern.toLowerCase()
      const patternsToDelete = (patterns || []).filter(p => {
        const patternName = (p.name || '').toLowerCase()
        const patternDisplay = (p.display_name || '').toLowerCase()
        const merchantPattern = (p.merchant_pattern || '').toLowerCase()

        // Check if any of the pattern's identifiers contain the rule pattern
        return patternName.includes(rulePatternLower) ||
               patternDisplay.includes(rulePatternLower) ||
               merchantPattern.includes(rulePatternLower) ||
               rulePatternLower.includes(patternName) ||
               rulePatternLower.includes(merchantPattern)
      })

      // Delete matching patterns and add to dismissals
      for (const pattern of patternsToDelete) {
        await supabase
          .from('recurring_patterns')
          .delete()
          .eq('id', pattern.id)

        // Add to dismissals so it doesn't get re-detected
        await supabase.from('recurring_dismissals').upsert({
          user_id: user.id,
          merchant_pattern: pattern.merchant_pattern,
          original_name: pattern.name,
          reason: 'Removed via transaction rule',
          dismissed_at: new Date().toISOString(),
        }, { onConflict: 'user_id,merchant_pattern' })
      }

      console.log(`[transaction-rules] Deleted ${patternsToDelete.length} recurring patterns matching "${match_pattern}"`)
    }
  }

  return NextResponse.json({ rule })
}

export async function PATCH(request: NextRequest) {
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

  const body = await request.json()
  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 })
  }

  // Only allow certain fields to be updated
  const allowedUpdates: Record<string, unknown> = {}
  if (typeof updates.match_pattern === 'string') allowedUpdates.match_pattern = updates.match_pattern
  if (typeof updates.match_field === 'string') allowedUpdates.match_field = updates.match_field
  if (typeof updates.display_name === 'string') allowedUpdates.display_name = updates.display_name
  if (typeof updates.set_category === 'string') allowedUpdates.set_category = updates.set_category
  if (typeof updates.set_as_income === 'boolean') allowedUpdates.set_as_income = updates.set_as_income
  if (typeof updates.set_ignore_type === 'string') allowedUpdates.set_ignore_type = updates.set_ignore_type
  if (typeof updates.description === 'string') allowedUpdates.description = updates.description
  if (typeof updates.is_active === 'boolean') allowedUpdates.is_active = updates.is_active
  if (typeof updates.priority === 'number') allowedUpdates.priority = updates.priority

  const { data: rule, error } = await supabase
    .from('transaction_rules')
    .update(allowedUpdates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rule })
}

// PUT - Apply all active rules to existing transactions
export async function PUT(request: NextRequest) {
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

  // Get all active rules
  const { data: rules, error: rulesError } = await supabase
    .from('transaction_rules')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('priority', { ascending: false })

  if (rulesError) {
    return NextResponse.json({ error: rulesError.message }, { status: 500 })
  }

  if (!rules || rules.length === 0) {
    return NextResponse.json({ applied: 0, message: 'No active rules found' })
  }

  let totalUpdated = 0

  // Apply each rule to matching transactions
  for (const rule of rules) {
    const updates: Record<string, unknown> = {}
    if (rule.display_name) updates.display_name = rule.display_name
    if (rule.set_category) updates.category = rule.set_category
    if (rule.set_as_income) updates.is_income = true
    if (rule.set_ignore_type) updates.ignore_type = rule.set_ignore_type

    if (Object.keys(updates).length === 0) continue

    const pattern = `%${rule.match_pattern}%`

    if (rule.match_field === 'name') {
      // First count matching transactions
      const { count } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .ilike('name', pattern)

      // Then update them
      await supabase
        .from('transactions')
        .update(updates)
        .eq('user_id', user.id)
        .ilike('name', pattern)

      totalUpdated += count || 0
    } else if (rule.match_field === 'merchant_name') {
      const { count } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .ilike('merchant_name', pattern)

      await supabase
        .from('transactions')
        .update(updates)
        .eq('user_id', user.id)
        .ilike('merchant_name', pattern)

      totalUpdated += count || 0
    } else {
      // 'any' - match either field
      const { count: nameCount } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .ilike('name', pattern)

      await supabase
        .from('transactions')
        .update(updates)
        .eq('user_id', user.id)
        .ilike('name', pattern)

      const { count: merchantCount } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .ilike('merchant_name', pattern)

      await supabase
        .from('transactions')
        .update(updates)
        .eq('user_id', user.id)
        .ilike('merchant_name', pattern)

      totalUpdated += (nameCount || 0) + (merchantCount || 0)
    }
  }

  return NextResponse.json({
    applied: rules.length,
    updated: totalUpdated,
    message: `Applied ${rules.length} rules to ${totalUpdated} transactions`
  })
}

export async function DELETE(request: NextRequest) {
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

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('transaction_rules')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
