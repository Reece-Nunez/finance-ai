'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { AccountsOverview } from './accounts-overview'
import { UpcomingBills } from './upcoming-bills'
import { SpendingTrend } from './spending-trend'
import { BudgetSummary } from './budget-summary'
import { RecentTransactions } from './recent-transactions'
import { AISuggestions } from './ai-suggestions'
import { CashFlowForecast } from './cash-flow-forecast'
import { AnomalyAlerts } from './anomaly-alerts'

interface Account {
  id: string
  name: string
  type: string
  subtype: string | null
  current_balance: number | null
  available_balance: number | null
  mask: string | null
}

interface Transaction {
  id: string
  name: string
  display_name: string | null
  merchant_name: string | null
  amount: number
  date: string
  category: string | null
  pending: boolean
  is_income?: boolean
}

interface DashboardClientProps {
  accounts: Account[]
  transactions: Transaction[]
  allTransactions: Transaction[]
  earnings: number
  spending: number
  lastSynced: string | null
  hasAccounts: boolean
  isPro: boolean
}

export function DashboardClient({
  accounts,
  transactions,
  allTransactions,
  earnings,
  spending,
  lastSynced,
  hasAccounts,
  isPro,
}: DashboardClientProps) {
  const [syncing, setSyncing] = useState(false)

  const handleSync = async () => {
    setSyncing(true)

    // Show loading toast
    const toastId = toast.loading('Syncing your accounts...', {
      description: 'This may take a moment, especially for first-time syncs.',
    })

    try {
      const response = await fetch('/api/plaid/sync-transactions', {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        const isFirstSync = data.isFirstSync

        toast.success('Sync complete!', {
          id: toastId,
          description: isFirstSync
            ? `Added ${data.added} transactions. Run sync again for AI categorization.`
            : `Added ${data.added}, updated ${data.modified}, removed ${data.removed} transactions.`,
        })

        // Brief delay to let user see the success message
        setTimeout(() => window.location.reload(), 1000)
      } else {
        const error = await response.json().catch(() => ({}))
        toast.error('Sync failed', {
          id: toastId,
          description: error.error || 'Please try again later.',
        })
      }
    } catch (error) {
      console.error('Sync failed:', error)
      toast.error('Sync failed', {
        id: toastId,
        description: 'Network error. Please check your connection.',
      })
    } finally {
      setSyncing(false)
    }
  }

  if (!hasAccounts) {
    return null // Will be handled by parent
  }

  return (
    <div className="space-y-6">
      {/* Top Row: Spending Trend + Accounts Overview */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SpendingTrend transactions={allTransactions} />
        <AccountsOverview
          accounts={accounts}
          lastSynced={lastSynced}
          onSync={handleSync}
          syncing={syncing}
        />
      </div>

      {/* Pro Features */}
      {isPro && (
        <>
          {/* AI Suggestions */}
          <AISuggestions />

          {/* Anomaly Detection */}
          <AnomalyAlerts />

          {/* Cash Flow Forecast */}
          <CashFlowForecast />
        </>
      )}

      {/* Middle Row: Recent Transactions + Upcoming Bills */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentTransactions
          transactions={transactions}
          allTransactions={allTransactions}
        />
        <UpcomingBills transactions={allTransactions} isPro={isPro} />
      </div>

      {/* Bottom Row: Budget Summary */}
      <BudgetSummary earnings={earnings} spending={spending} />
    </div>
  )
}
