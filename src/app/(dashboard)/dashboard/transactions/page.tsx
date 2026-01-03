'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  ChevronDown,
  X,
  Loader2,
  ChevronRight,
} from 'lucide-react'
import { formatCategory, formatCurrency } from '@/lib/format'
import { TransactionDetail } from '@/components/dashboard/transaction-detail'
import { MerchantLogo } from '@/components/ui/merchant-logo'
import { NLTransactionSearch } from '@/components/dashboard/nl-transaction-search'
import { SearchTransaction } from '@/types/search'

interface Transaction {
  id: string
  name: string
  display_name: string | null
  merchant_name: string | null
  amount: number
  date: string
  category: string | null
  ai_category: string | null
  pending: boolean
  is_income: boolean
  plaid_account_id: string
}

interface Account {
  plaid_account_id: string
  name: string
  official_name: string | null
  mask: string | null
}

export default function TransactionsPage() {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'income' | 'expenses'>('all')
  const [dateFilter, setDateFilter] = useState('This Month')
  const [visibleCount, setVisibleCount] = useState(50)

  useEffect(() => {
    async function loadData() {
      setLoading(true)

      const [txRes, accRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .order('date', { ascending: false })
          .limit(500),
        supabase
          .from('accounts')
          .select('plaid_account_id, name, official_name, mask'),
      ])

      if (txRes.data) setTransactions(txRes.data)
      if (accRes.data) setAccounts(accRes.data)

      setLoading(false)
    }

    loadData()
  }, [supabase])

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(tx =>
        (tx.display_name || tx.merchant_name || tx.name).toLowerCase().includes(query) ||
        formatCategory(tx.category || tx.ai_category).toLowerCase().includes(query)
      )
    }

    // Date filter
    const now = new Date()
    switch (dateFilter) {
      case 'Today':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        filtered = filtered.filter(tx => new Date(tx.date) >= today)
        break
      case 'This Week':
        const weekAgo = new Date(now)
        weekAgo.setDate(weekAgo.getDate() - 7)
        filtered = filtered.filter(tx => new Date(tx.date) >= weekAgo)
        break
      case 'This Month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        filtered = filtered.filter(tx => new Date(tx.date) >= monthStart)
        break
      case 'Last 3 Months':
        const threeMonthsAgo = new Date(now)
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
        filtered = filtered.filter(tx => new Date(tx.date) >= threeMonthsAgo)
        break
      case 'This Year':
        const yearStart = new Date(now.getFullYear(), 0, 1)
        filtered = filtered.filter(tx => new Date(tx.date) >= yearStart)
        break
      // 'All Time' - no filter
    }

    // Type filter
    if (activeTab === 'income') {
      filtered = filtered.filter(tx => tx.amount < 0 || tx.is_income)
    } else if (activeTab === 'expenses') {
      filtered = filtered.filter(tx => tx.amount > 0 && !tx.is_income)
    }

    return filtered
  }, [transactions, searchQuery, dateFilter, activeTab])

  // Calculate totals
  const totals = useMemo(() => {
    const income = filteredTransactions
      .filter(tx => tx.amount < 0 || tx.is_income)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
    const expenses = filteredTransactions
      .filter(tx => tx.amount > 0 && !tx.is_income)
      .reduce((sum, tx) => sum + tx.amount, 0)
    return { income, expenses }
  }, [filteredTransactions])

  // Group by date
  const groupedTransactions = useMemo(() => {
    const visible = filteredTransactions.slice(0, visibleCount)
    const groups: Record<string, Transaction[]> = {}

    visible.forEach(tx => {
      if (!groups[tx.date]) groups[tx.date] = []
      groups[tx.date].push(tx)
    })

    return Object.entries(groups).sort(([a], [b]) =>
      new Date(b).getTime() - new Date(a).getTime()
    )
  }, [filteredTransactions, visibleCount])

  const handleTransactionUpdate = async (id: string, updates: Partial<Transaction>) => {
    const response = await fetch('/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    })
    if (response.ok) {
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
      if (selectedTransaction?.id === id) {
        setSelectedTransaction(prev => prev ? { ...prev, ...updates } : prev)
      }
    }
  }

  const handleSearchTransactionClick = (tx: SearchTransaction) => {
    // Find the full transaction from our loaded list, or use the search result
    const fullTransaction = transactions.find(t => t.id === tx.id)
    if (fullTransaction) {
      setSelectedTransaction(fullTransaction)
    } else {
      // Use the search result data
      setSelectedTransaction({
        id: tx.id,
        name: tx.name,
        display_name: tx.display_name,
        merchant_name: tx.merchant_name,
        amount: tx.amount,
        date: tx.date,
        category: tx.category,
        ai_category: tx.ai_category,
        pending: tx.pending,
        is_income: tx.is_income,
        plaid_account_id: tx.plaid_account_id,
      })
    }
  }

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'

    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
      </div>

      {/* AI-Powered Natural Language Search */}
      <NLTransactionSearch onTransactionClick={handleSearchTransactionClick} />

      {/* Regular Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search transactions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-12 pl-12 pr-10 text-base rounded-xl border-0 bg-muted/50 focus-visible:ring-1"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex bg-muted/50 rounded-xl p-1">
          {(['all', 'income', 'expenses'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-white dark:bg-slate-800 shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'all' ? 'All' : tab === 'income' ? 'Income' : 'Expenses'}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 rounded-xl">
              {dateFilter}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {['Today', 'This Week', 'This Month', 'Last 3 Months', 'This Year', 'All Time'].map((option) => (
              <DropdownMenuItem
                key={option}
                onClick={() => setDateFilter(option)}
                className={dateFilter === option ? 'bg-muted' : ''}
              >
                {option}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Summary Bar */}
      <div className="flex items-center justify-between py-4 px-1 mb-2">
        <div>
          <p className="text-sm text-muted-foreground">
            {filteredTransactions.length} transactions
          </p>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="text-right">
            <p className="text-muted-foreground">Income</p>
            <p className="font-semibold text-emerald-600">+{formatCurrency(totals.income)}</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">Expenses</p>
            <p className="font-semibold">-{formatCurrency(totals.expenses)}</p>
          </div>
        </div>
      </div>

      {/* Transaction List */}
      {groupedTransactions.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium">No transactions found</p>
          <p className="text-muted-foreground mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="space-y-1">
          {groupedTransactions.map(([date, txs]) => (
            <div key={date}>
              {/* Date Header */}
              <div className="sticky top-0 z-10 py-3 bg-background/95 backdrop-blur-sm">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {formatDateHeader(date)}
                </p>
              </div>

              {/* Transactions */}
              <div className="space-y-1">
                {txs.map((tx) => {
                  const category = tx.category || tx.ai_category
                  const isIncome = tx.amount < 0 || tx.is_income

                  return (
                    <button
                      key={tx.id}
                      onClick={() => setSelectedTransaction(tx)}
                      className="w-full flex items-center gap-4 p-3 -mx-3 rounded-2xl transition-colors hover:bg-muted/50 group"
                    >
                      {/* Merchant Logo */}
                      <MerchantLogo
                        merchantName={tx.merchant_name || tx.name}
                        category={category}
                        size="lg"
                      />

                      {/* Details */}
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">
                            {tx.display_name || tx.merchant_name || tx.name}
                          </p>
                          {tx.pending && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                              Pending
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {formatCategory(category)}
                        </p>
                      </div>

                      {/* Amount */}
                      <div className="text-right shrink-0">
                        <p className={`text-base font-semibold tabular-nums ${
                          isIncome ? 'text-emerald-600' : ''
                        }`}>
                          {isIncome ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                        </p>
                      </div>

                      {/* Chevron */}
                      <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-muted-foreground shrink-0" />
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Load More */}
          {visibleCount < filteredTransactions.length && (
            <div className="pt-6 pb-4 text-center">
              <Button
                variant="outline"
                onClick={() => setVisibleCount(prev => prev + 50)}
                className="rounded-xl px-8"
              >
                Load More
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Showing {visibleCount} of {filteredTransactions.length}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Transaction Detail */}
      <TransactionDetail
        transaction={selectedTransaction}
        allTransactions={transactions}
        open={!!selectedTransaction}
        onOpenChange={(open) => !open && setSelectedTransaction(null)}
        onUpdate={handleTransactionUpdate}
      />
    </div>
  )
}
