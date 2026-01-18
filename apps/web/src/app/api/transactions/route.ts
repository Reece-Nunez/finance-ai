import { createClient } from '@/lib/supabase/server'
import { getApiUser } from '@/lib/supabase/api'
import { NextRequest, NextResponse } from 'next/server'

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

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')
  const filter = searchParams.get('filter') || 'all'
  const period = searchParams.get('period')
  const search = searchParams.get('search')
  const includeIgnored = searchParams.get('include_ignored') === 'true'

  let query = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  // Exclude ignored transactions by default (ignore_type = 'all' means fully hidden)
  if (!includeIgnored) {
    query = query.or('ignore_type.is.null,ignore_type.neq.all')
  }

  // Apply filter
  if (filter === 'income') {
    query = query.eq('is_income', true)
  } else if (filter === 'expense') {
    query = query.eq('is_income', false)
  }

  // Apply period filter
  if (period) {
    const now = new Date()
    let startDate: Date

    switch (period) {
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
        query = query.lte('date', endOfLastMonth.toISOString().split('T')[0])
        break
      case 'this_year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      case 'last_30_days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case 'last_90_days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }
    query = query.gte('date', startDate.toISOString().split('T')[0])
  }

  // Apply search
  if (search) {
    query = query.or(`name.ilike.%${search}%,merchant_name.ilike.%${search}%,display_name.ilike.%${search}%`)
  }

  // Apply pagination
  query = query.range(offset, offset + limit - 1)

  const { data: transactions, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    transactions: transactions || [],
    total: count || 0,
    hasMore: (count || 0) > offset + limit,
  })
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
  const { id, category, is_income, ignore_type, notes, display_name, date, is_exceptional, amount } = body

  if (!id) {
    return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 })
  }

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {}
  if (typeof category === 'string' || category === null) updates.category = category
  if (typeof is_income === 'boolean') updates.is_income = is_income
  if (typeof ignore_type === 'string' && ['none', 'budget', 'all'].includes(ignore_type)) {
    updates.ignore_type = ignore_type
  }
  if (typeof notes === 'string') updates.notes = notes
  if (typeof display_name === 'string') updates.display_name = display_name
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    updates.date = date
  }
  if (typeof is_exceptional === 'boolean') updates.is_exceptional = is_exceptional
  if (typeof amount === 'number') updates.amount = amount

  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ transaction: data })
}
