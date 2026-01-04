'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PiggyBank,
  Settings,
  Repeat,
  Receipt,
  Smartphone,
  AlertCircle,
} from 'lucide-react'
import { SubscriptionBadge } from '@/components/subscription/subscription-badge'
import { useSubscription } from '@/hooks/useSubscription'

function PlanBadge() {
  const { isPro, isLoading } = useSubscription()

  if (isLoading) return null

  return (
    <span className="text-[10px] font-medium text-slate-400 mt-1">
      {isPro ? 'PRO' : 'FREE'}
    </span>
  )
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, pro: false },
  { name: 'Transactions', href: '/dashboard/transactions', icon: Receipt, pro: false },
  { name: 'Spending', href: '/dashboard/spending', icon: ArrowLeftRight, pro: false },
  { name: 'Recurring', href: '/dashboard/recurring', icon: Repeat, pro: false },
  { name: 'Budgets', href: '/dashboard/budgets', icon: PiggyBank, pro: false },
  { name: 'Sterling', href: '/dashboard/chat', icon: null, useLogo: true, pro: true },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings, pro: false },
]

export function Sidebar() {
  const pathname = usePathname()
  const { isPro, isLoading } = useSubscription()

  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3 bg-slate-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Sterling"
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
          />
          <div className="flex items-start gap-1">
            <span className="text-2xl font-semibold text-white font-[family-name:var(--font-serif)]">
              Sterling
            </span>
            <PlanBadge />
          </div>
        </div>
        <SubscriptionBadge />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const showProBadge = item.pro && !isPro && !isLoading
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-gradient-to-r from-slate-500 to-slate-700 text-white shadow-lg shadow-slate-500/25'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              {item.useLogo ? (
                <Image
                  src="/logo.png"
                  alt="Sterling"
                  width={20}
                  height={20}
                  className="h-5 w-5 object-contain"
                />
              ) : (
                item.icon && <item.icon className="h-5 w-5" />
              )}
              <span className="flex-1">{item.name}</span>
              {showProBadge && (
                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  PRO
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t p-4 space-y-3">
        <Link
          href="/dashboard/accounts"
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800/50"
        >
          <Wallet className="h-4 w-4" />
          Manage Accounts
        </Link>

        {/* Mobile app notice */}
        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 p-3 dark:from-blue-900/20 dark:to-indigo-900/20">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <p className="text-xs font-medium text-blue-900 dark:text-blue-100">
              Mobile Apps Coming Soon
            </p>
          </div>
          <p className="mt-1 text-[10px] text-blue-700 dark:text-blue-300">
            iOS & Android apps in development
          </p>
        </div>

        {/* Limited bank access notice */}
        <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 p-3 dark:from-amber-900/20 dark:to-orange-900/20">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
              Bank Access Expanding
            </p>
          </div>
          <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">
            Chase, BofA, Wells Fargo coming soon
          </p>
        </div>
      </div>
    </aside>
  )
}
