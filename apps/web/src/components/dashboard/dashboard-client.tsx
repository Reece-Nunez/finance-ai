'use client'

import { useState } from 'react'
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
    try {
      // Get plaid items and sync each one
      const response = await fetch('/api/plaid/sync-transactions', {
        method: 'POST',
      })
      if (response.ok) {
        // Refresh the page to get new data
        window.location.reload()
      }
    } catch (error) {
      console.error('Sync failed:', error)
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
        <UpcomingBills transactions={allTransactions} />
      </div>

      {/* Bottom Row: Budget Summary */}
      <BudgetSummary earnings={earnings} spending={spending} />
    </div>
  )
}
