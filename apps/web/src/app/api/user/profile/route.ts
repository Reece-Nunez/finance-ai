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

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is fine for new users
      console.error('Error fetching profile:', error)
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    return NextResponse.json({
      profile: profile || null,
      email: user.email
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      first_name,
      last_name,
      phone,
      date_of_birth,
      currency,
      timezone,
      notification_preferences,
      ai_preferences,
      onboarding_completed
    } = body

    // Validate required fields
    if (!first_name || !last_name) {
      return NextResponse.json({ error: 'First name and last name are required' }, { status: 400 })
    }

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    let profile
    let error

    if (existingProfile) {
      // Update existing profile
      const result = await supabase
        .from('user_profiles')
        .update({
          first_name,
          last_name,
          phone: phone || null,
          date_of_birth: date_of_birth || null,
          currency: currency || 'USD',
          timezone: timezone || 'America/New_York',
          notification_preferences: notification_preferences || { email: true, push: true, sms: false },
          ai_preferences: ai_preferences || null,
          onboarding_completed: onboarding_completed ?? false,
        })
        .eq('user_id', user.id)
        .select()
        .single()

      profile = result.data
      error = result.error
    } else {
      // Create new profile
      const result = await supabase
        .from('user_profiles')
        .insert({
          user_id: user.id,
          first_name,
          last_name,
          phone: phone || null,
          date_of_birth: date_of_birth || null,
          currency: currency || 'USD',
          timezone: timezone || 'America/New_York',
          notification_preferences: notification_preferences || { email: true, push: true, sms: false },
          ai_preferences: ai_preferences || null,
          onboarding_completed: onboarding_completed ?? false,
        })
        .select()
        .single()

      profile = result.data
      error = result.error
    }

    if (error) {
      console.error('Error saving profile:', error)
      return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
    }

    return NextResponse.json({ profile })
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

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {}

    if (typeof body.first_name === 'string') updates.first_name = body.first_name
    if (typeof body.last_name === 'string') updates.last_name = body.last_name
    if (typeof body.phone === 'string') updates.phone = body.phone
    if (body.date_of_birth) updates.date_of_birth = body.date_of_birth
    if (typeof body.currency === 'string') updates.currency = body.currency
    if (typeof body.timezone === 'string') updates.timezone = body.timezone
    if (body.notification_preferences) updates.notification_preferences = body.notification_preferences
    if (body.ai_preferences) updates.ai_preferences = body.ai_preferences
    if (typeof body.onboarding_completed === 'boolean') updates.onboarding_completed = body.onboarding_completed

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating profile:', error)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
