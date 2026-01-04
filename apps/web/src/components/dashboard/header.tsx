'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LogOut, User } from 'lucide-react'
import { NotificationsDropdown } from './notifications-dropdown'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { SESSION_CONFIG } from '@/lib/security/session-config'

interface HeaderProps {
  user: SupabaseUser
  userName: string | null
}

export function Header({ user, userName }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    // Clear session tracking data
    try {
      Object.values(SESSION_CONFIG.STORAGE_KEYS).forEach((key) => {
        localStorage.removeItem(key)
      })
      // Broadcast logout to other tabs
      localStorage.setItem(
        SESSION_CONFIG.STORAGE_KEYS.LOGOUT_EVENT,
        JSON.stringify({ timestamp: Date.now(), reason: 'manual' })
      )
    } catch {
      // Ignore localStorage errors
    }
    await supabase.auth.signOut()
    router.push('/login?message=logged_out')
    router.refresh()
  }

  const greeting = getGreeting()
  const displayName = userName || user.email?.split('@')[0] || 'there'

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div>
        <h1 className="text-lg font-semibold">
          Good {greeting}, {displayName}!
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <NotificationsDropdown />
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/settings">
            <User className="h-5 w-5" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" onClick={handleSignOut}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}
