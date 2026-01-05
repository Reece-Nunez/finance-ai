import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const supabase = await createClient()

  // Sign out server-side
  await supabase.auth.signOut()

  // Clear all supabase-related cookies manually to ensure clean state
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

  const response = NextResponse.json({ success: true })

  // Delete any supabase auth cookies
  allCookies.forEach(cookie => {
    if (cookie.name.includes('sb-') || cookie.name.includes('supabase')) {
      response.cookies.delete(cookie.name)
    }
  })

  return response
}
