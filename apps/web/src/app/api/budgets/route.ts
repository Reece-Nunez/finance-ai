import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getApiUser } from '@/lib/supabase/api'

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

    const { data: budgets, error } = await supabase
      .from('budgets')
      .select('*')
      .order('category')

    if (error) {
      throw error
    }

    return NextResponse.json({ budgets })
  } catch (error) {
    console.error('Error fetching budgets:', error)
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    const { category, amount } = await request.json()

    const { data: budget, error } = await supabase
      .from('budgets')
      .upsert(
        { user_id: user.id, category, amount, period: 'monthly' },
        { onConflict: 'user_id,category' }
      )
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ budget })
  } catch (error) {
    console.error('Error creating budget:', error)
    return NextResponse.json({ error: 'Failed to create budget' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Budget ID required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting budget:', error)
    return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 })
  }
}
