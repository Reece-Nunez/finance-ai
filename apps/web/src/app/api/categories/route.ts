import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Transportation',
  'Gas & Fuel',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Health & Medical',
  'Travel',
  'Education',
  'Personal Care',
  'Home & Garden',
  'Gifts & Donations',
  'Subscriptions',
  'Income',
  'Transfer',
  'Other',
]

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's categories
  const result = await supabase
    .from('categories')
    .select('*')
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })
  let categories = result.data
  const error = result.error

  // If no categories exist, seed defaults
  if (!categories || categories.length === 0) {
    const defaultCategories = DEFAULT_CATEGORIES.map(name => ({
      user_id: user.id,
      name,
      is_default: true,
    }))

    const { data: seeded, error: seedError } = await supabase
      .from('categories')
      .insert(defaultCategories)
      .select()

    if (seedError) {
      console.error('Error seeding categories:', seedError)
      // Return default categories even if seeding fails
      return NextResponse.json({
        categories: DEFAULT_CATEGORIES.map(name => ({ name, is_default: true })),
      })
    }

    categories = seeded
  }

  return NextResponse.json({ categories })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, icon, color } = await request.json()

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  // Check if category already exists
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', user.id)
    .eq('name', name.trim())
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Category already exists' }, { status: 400 })
  }

  const { data: category, error } = await supabase
    .from('categories')
    .insert({
      user_id: user.id,
      name: name.trim(),
      icon,
      color,
      is_default: false,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ category })
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
    return NextResponse.json({ error: 'ID is required' }, { status: 400 })
  }

  // Don't allow deleting default categories
  const { data: category } = await supabase
    .from('categories')
    .select('is_default')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (category?.is_default) {
    return NextResponse.json({ error: 'Cannot delete default categories' }, { status: 400 })
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
