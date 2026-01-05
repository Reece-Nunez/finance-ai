import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SECURITY_HEADERS } from '@/lib/security/session-config'

// Secure cookie options for auth cookies
// NOTE: Do NOT set httpOnly: true for Supabase auth cookies!
// The browser client needs to read these cookies to authenticate.
// Supabase handles security through short-lived JWTs and refresh tokens.
const SECURE_COOKIE_OPTIONS = {
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              ...SECURE_COOKIE_OPTIONS,
            })
          )
        },
      },
    }
  )

  // Add security headers to response
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    supabaseResponse.headers.set(key, value)
  })

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes - redirect to login if not authenticated
  const protectedPaths = ['/dashboard', '/accounts', '/transactions', '/budgets', '/chat']
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Clear any stale session storage keys via query param
    url.searchParams.set('message', 'session_required')
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  const authPaths = ['/login', '/signup']
  const isAuthPath = authPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isAuthPath && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
