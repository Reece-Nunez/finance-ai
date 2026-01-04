import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, category, is_income, ignore_type, notes, display_name, date, is_exceptional } = body

  if (!id) {
    return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 })
  }

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {}
  if (typeof category === 'string') updates.category = category
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
