'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { SESSION_CONFIG } from '@/lib/security/session-config'
import { toast } from 'sonner'

// Session message configurations for toasts
const SESSION_MESSAGES: Record<string, { text: string; title: string; type: 'warning' | 'info' | 'success' }> = {
  session_timeout: {
    title: 'Session Expired',
    text: 'Your session has expired due to inactivity. Please sign in again.',
    type: 'warning',
  },
  session_expired: {
    title: 'Session Expired',
    text: 'Your session has expired. Please sign in again to continue.',
    type: 'warning',
  },
  session_required: {
    title: 'Authentication Required',
    text: 'Please sign in to access that page.',
    type: 'info',
  },
  logged_out: {
    title: 'Signed Out',
    text: 'You have been successfully logged out.',
    type: 'success',
  },
  logged_out_other_tab: {
    title: 'Signed Out',
    text: 'You were logged out from another tab or device.',
    type: 'info',
  },
  session_error: {
    title: 'Session Error',
    text: 'A session error occurred. Please sign in again.',
    type: 'warning',
  },
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const toastShownRef = useRef(false)

  // Clear stale session data and show appropriate message on load
  useEffect(() => {
    // Clear any stale session tracking data
    try {
      Object.values(SESSION_CONFIG.STORAGE_KEYS).forEach((key) => {
        localStorage.removeItem(key)
      })
    } catch {
      // Ignore localStorage errors
    }

    // Show session message toast if present (only once)
    const message = searchParams.get('message')
    if (message && SESSION_MESSAGES[message] && !toastShownRef.current) {
      toastShownRef.current = true
      const { title, text, type } = SESSION_MESSAGES[message]

      if (type === 'warning') {
        toast.warning(title, { description: text, duration: 5000 })
      } else if (type === 'success') {
        toast.success(title, { description: text, duration: 4000 })
      } else {
        toast.info(title, { description: text, duration: 4000 })
      }

      // Clean up URL without causing a navigation
      const url = new URL(window.location.href)
      url.searchParams.delete('message')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      toast.error('Sign In Failed', { description: error.message })
      setLoading(false)
      return
    }

    // Initialize session tracking on successful login
    try {
      const now = Date.now()
      localStorage.setItem(SESSION_CONFIG.STORAGE_KEYS.LAST_ACTIVITY, now.toString())
      localStorage.setItem(SESSION_CONFIG.STORAGE_KEYS.SESSION_START, now.toString())
    } catch {
      // Ignore localStorage errors
    }

    toast.success('Welcome Back!', { description: 'You have successfully signed in.' })
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-background to-slate-100 px-4 dark:from-slate-950/20 dark:via-background dark:to-slate-900/20">
      <Card className="w-full max-w-md border-none shadow-2xl shadow-slate-500/10">
        <CardHeader className="text-center">
          <Link href="/" className="mx-auto mb-4 block">
            <span className="text-4xl font-semibold text-slate-800 dark:text-white font-[family-name:var(--font-serif)]">Sterling</span>
          </Link>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="h-11 w-full bg-gradient-to-r from-slate-500 to-slate-700 hover:from-slate-600 hover:to-slate-800 shadow-lg shadow-slate-500/25"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium text-slate-600 hover:text-slate-700 dark:text-slate-400">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function LoginPageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-background to-slate-100 px-4 dark:from-slate-950/20 dark:via-background dark:to-slate-900/20">
      <Card className="w-full max-w-md border-none shadow-2xl shadow-slate-500/10">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <span className="text-4xl font-semibold text-slate-800 dark:text-white font-[family-name:var(--font-serif)]">Sterling</span>
          </div>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageLoading />}>
      <LoginForm />
    </Suspense>
  )
}
