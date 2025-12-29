'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PiggyBank,
  MessageSquare,
  Settings,
  TrendingUp,
  BarChart3,
  Repeat,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Spending', href: '/dashboard/spending', icon: ArrowLeftRight },
  { name: 'Recurring', href: '/dashboard/recurring', icon: Repeat },
  { name: 'Budgets', href: '/dashboard/budgets', icon: PiggyBank },
  { name: 'AI Chat', href: '/dashboard/chat', icon: MessageSquare },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
          FinanceAI
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t p-4 space-y-3">
        <Link
          href="/dashboard/accounts"
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 px-4 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
        >
          <Wallet className="h-4 w-4" />
          Manage Accounts
        </Link>
        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4 dark:from-emerald-950/50 dark:to-teal-950/50">
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
            AI Insights Ready
          </p>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
            Your AI is learning from your financial patterns
          </p>
        </div>
      </div>
    </aside>
  )
}
