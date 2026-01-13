'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LogOut, User } from 'lucide-react'
import { NotificationsDropdown } from './notifications-dropdown'
import { MobileNav } from './mobile-nav'
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

    // Use server-side signout to properly clear httpOnly cookies
    try {
      await fetch('/api/auth/signout', { method: 'POST' })
    } catch {
      // Fallback to client-side signout
      await supabase.auth.signOut()
    }

    router.push('/login?message=logged_out')
    router.refresh()
  }

  const greeting = getGreeting()
  const displayName = userName || user.email?.split('@')[0] || 'there'

  return (
    <header className="flex h-14 md:h-16 items-center justify-between border-b bg-card px-3 md:px-6">
      {/* Mobile: Hamburger + Logo, Desktop: Greeting */}
      <div className="flex items-center gap-2">
        <MobileNav />
        {/* Mobile logo */}
        <div className="flex md:hidden items-center gap-2">
          <Image
            src="/logo.png"
            alt="Sterling"
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
          />
          <span className="text-lg font-semibold font-[family-name:var(--font-serif)]">
            Sterling
          </span>
        </div>
        {/* Desktop greeting */}
        <h1 className="hidden md:block text-lg font-semibold">
          Good {greeting}, {displayName}!
        </h1>
      </div>
      <div className="flex items-center gap-1 md:gap-2">
        <NotificationsDropdown />
        <Button variant="ghost" size="icon" asChild className="h-9 w-9 md:h-10 md:w-10" aria-label="Account settings">
          <Link href="/dashboard/settings">
            <User className="h-5 w-5" aria-hidden="true" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-9 w-9 md:h-10 md:w-10" aria-label="Sign out">
          <LogOut className="h-5 w-5" aria-hidden="true" />
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
