import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
    if (set_as_income) updates.is_income = true
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
  }

  return NextResponse.json({ rule })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
