import { createClient as createServerClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

// Create a Supabase client that can authenticate via Bearer token (for mobile)
// or fall back to the service role for server-side operations
export async function createApiClient(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)

    // Create a client with the user's access token
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    )

    return supabase
  }

  // No Bearer token - this shouldn't happen for API routes called from mobile
  // Return a client that will fail auth checks
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Helper to get user from either Bearer token or cookies
export async function getApiUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  // For Bearer token auth (mobile), pass the token directly to getUser()
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    )

    // Pass the JWT directly to getUser() for validation
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return { user: null, supabase, error: error || new Error('No user found') }
    }

    return { user, supabase, error: null }
  }

  // No Bearer token - use standard client
  const supabase = await createApiClient(request)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { user: null, supabase, error: error || new Error('No user found') }
  }

  return { user, supabase, error: null }
}
