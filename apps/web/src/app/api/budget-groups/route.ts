import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_GROUPS = [
  { name: 'Fixed & Committed', sort_order: 0, color: '#6366f1', icon: 'lock' },
  { name: 'Flexible Essentials', sort_order: 1, color: '#10b981', icon: 'shopping-cart' },
  { name: 'Lifestyle', sort_order: 2, color: '#f59e0b', icon: 'sparkles' },
  { name: 'Debt Payments', sort_order: 3, color: '#ef4444', icon: 'credit-card' },
  { name: 'Savings & Goals', sort_order: 4, color: '#3b82f6', icon: 'piggy-bank' },
]

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let { data: groups, error } = await supabase
      .from('budget_groups')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order')

    if (error) throw error

    // Auto-create default groups on first access
    if (!groups || groups.length === 0) {
      const toInsert = DEFAULT_GROUPS.map((g) => ({
        ...g,
        user_id: user.id,
      }))

      const { data: newGroups, error: insertError } = await supabase
        .from('budget_groups')
        .insert(toInsert)
        .select()

      if (insertError) throw insertError
      groups = newGroups
    }

    return NextResponse.json({ groups })
  } catch (error) {
    console.error('Error fetching budget groups:', error)
    return NextResponse.json({ error: 'Failed to fetch budget groups' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, color, icon, sort_order } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
    }

    const { data: group, error } = await supabase
      .from('budget_groups')
      .insert({ user_id: user.id, name, color: color || '#6366f1', icon, sort_order: sort_order ?? 99 })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ group })
  } catch (error) {
    console.error('Error creating budget group:', error)
    return NextResponse.json({ error: 'Failed to create budget group' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, name, color, icon, sort_order } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Group ID is required' }, { status: 400 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof name === 'string') updates.name = name
    if (typeof color === 'string') updates.color = color
    if (typeof icon === 'string') updates.icon = icon
    if (typeof sort_order === 'number') updates.sort_order = sort_order

    const { data: group, error } = await supabase
      .from('budget_groups')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ group })
  } catch (error) {
    console.error('Error updating budget group:', error)
    return NextResponse.json({ error: 'Failed to update budget group' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Group ID is required' }, { status: 400 })
    }

    // Budgets in this group get group_id set to null (ON DELETE SET NULL)
    const { error } = await supabase
      .from('budget_groups')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting budget group:', error)
    return NextResponse.json({ error: 'Failed to delete budget group' }, { status: 500 })
  }
}
