'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  ChevronUp,
  Wallet,
  CreditCard,
  PiggyBank,
  TrendingUp,
  RefreshCw,
  Info,
  Landmark,
  Banknote,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface Account {
  id: string
  name: string
  type: string
  subtype: string | null
  current_balance: number | null
  available_balance: number | null
  mask: string | null
}

interface AccountsOverviewProps {
  accounts: Account[]
  lastSynced: string | null
  onSync: () => void
  syncing: boolean
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function AccountCategory({
  title,
  icon: Icon,
  total,
  accounts,
  iconBgColor,
  iconColor,
}: {
  title: string
  icon: React.ElementType
  total: number
  accounts: Account[]
  iconBgColor: string
  iconColor: string
}) {
  const [expanded, setExpanded] = useState(false)

  if (accounts.length === 0) return null

  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`rounded-full p-2 ${iconBgColor}`}>
            <Icon className={`h-4 w-4 ${iconColor}`} />
          </div>
          <span className="font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{formatCurrency(total)}</span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="bg-muted/30 px-4 pb-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className="text-muted-foreground">
                {account.name}
                {account.mask && <span className="ml-1">••{account.mask}</span>}
              </span>
              <span>{formatCurrency(account.current_balance || 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AccountsOverview({
  accounts,
  lastSynced,
  onSync,
  syncing,
}: AccountsOverviewProps) {
  // Use state for relative time to avoid hydration mismatch
  const [syncedText, setSyncedText] = useState<string>('')

  useEffect(() => {
    const formatLastSynced = () => {
      if (!lastSynced) return 'Never'
      const date = new Date(lastSynced)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)

      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24) return `${diffHours}h ago`
      return `${diffDays}d ago`
    }

    setSyncedText(formatLastSynced())
    // Update every minute
    const interval = setInterval(() => {
      setSyncedText(formatLastSynced())
    }, 60000)
    return () => clearInterval(interval)
  }, [lastSynced])

  // Categorize accounts
  const checkingAccounts = accounts.filter(
    (a) => a.type === 'depository' && a.subtype === 'checking'
  )
  const savingsAccounts = accounts.filter(
    (a) => a.type === 'depository' && (a.subtype === 'savings' || a.subtype === 'money market' || a.subtype === 'cd')
  )
  const creditAccounts = accounts.filter((a) => a.type === 'credit')
  const loanAccounts = accounts.filter((a) => a.type === 'loan')
  const investmentAccounts = accounts.filter((a) => a.type === 'investment' || a.type === 'brokerage')

  // Other accounts that don't fit the above categories
  const categorizedIds = new Set([
    ...checkingAccounts.map(a => a.id),
    ...savingsAccounts.map(a => a.id),
    ...creditAccounts.map(a => a.id),
    ...loanAccounts.map(a => a.id),
    ...investmentAccounts.map(a => a.id),
  ])
  const otherAccounts = accounts.filter((a) => !categorizedIds.has(a.id))

  // Calculate totals
  const checkingTotal = checkingAccounts.reduce(
    (sum, a) => sum + (a.current_balance || 0),
    0
  )
  const savingsTotal = savingsAccounts.reduce(
    (sum, a) => sum + (a.current_balance || 0),
    0
  )
  const creditTotal = creditAccounts.reduce(
    (sum, a) => sum + Math.abs(a.current_balance || 0),
    0
  )
  const loanTotal = loanAccounts.reduce(
    (sum, a) => sum + Math.abs(a.current_balance || 0),
    0
  )
  const investmentTotal = investmentAccounts.reduce(
    (sum, a) => sum + (a.current_balance || 0),
    0
  )
  const otherTotal = otherAccounts.reduce(
    (sum, a) => sum + (a.current_balance || 0),
    0
  )

  // Net cash = checking + savings - credit card balances (loans excluded as they're long-term debt)
  const netCash = checkingTotal + savingsTotal - creditTotal

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Accounts</CardTitle>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {syncedText && <span>Synced {syncedText}</span>}
          <Button
            variant="ghost"
            size="sm"
            onClick={onSync}
            disabled={syncing}
            className="h-8 px-2"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <AccountCategory
          title="Checking"
          icon={Wallet}
          total={checkingTotal}
          accounts={checkingAccounts}
          iconBgColor="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600 dark:text-blue-400"
        />
        <AccountCategory
          title="Card Balance"
          icon={CreditCard}
          total={-creditTotal}
          accounts={creditAccounts.map(a => ({ ...a, current_balance: -Math.abs(a.current_balance || 0) }))}
          iconBgColor="bg-orange-100 dark:bg-orange-900/30"
          iconColor="text-orange-600 dark:text-orange-400"
        />
        <AccountCategory
          title="Loans"
          icon={Banknote}
          total={-loanTotal}
          accounts={loanAccounts.map(a => ({ ...a, current_balance: -Math.abs(a.current_balance || 0) }))}
          iconBgColor="bg-red-100 dark:bg-red-900/30"
          iconColor="text-red-600 dark:text-red-400"
        />

        {/* Net Cash with tooltip */}
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-900/30">
              <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">Net Cash</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-sm">
                      Net Cash = Checking + Savings - Credit Card Balances.
                      This shows your liquid cash position.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <span className={`font-semibold ${netCash < 0 ? 'text-red-600' : ''}`}>
            {formatCurrency(netCash)}
          </span>
        </div>

        <AccountCategory
          title="Savings"
          icon={PiggyBank}
          total={savingsTotal}
          accounts={savingsAccounts}
          iconBgColor="bg-green-100 dark:bg-green-900/30"
          iconColor="text-green-600 dark:text-green-400"
        />
        <AccountCategory
          title="Investments"
          icon={TrendingUp}
          total={investmentTotal}
          accounts={investmentAccounts}
          iconBgColor="bg-emerald-100 dark:bg-emerald-900/30"
          iconColor="text-emerald-600 dark:text-emerald-400"
        />
        <AccountCategory
          title="Other"
          icon={Landmark}
          total={otherTotal}
          accounts={otherAccounts}
          iconBgColor="bg-slate-100 dark:bg-slate-800"
          iconColor="text-slate-600 dark:text-slate-400"
        />
      </CardContent>
    </Card>
  )
}
