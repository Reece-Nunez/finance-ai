'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
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
  ArrowLeftRight,
  EyeOff,
  CheckSquare,
  Square,
  XCircle,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { formatCategory, formatCurrency } from '@/lib/format'
import { TransactionDetail } from '@/components/dashboard/transaction-detail'
import { MerchantLogo } from '@/components/ui/merchant-logo'
import { NLTransactionSearch } from '@/components/dashboard/nl-transaction-search'
import { TransferReviewModal } from '@/components/dashboard/transfer-review-modal'
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
  ignore_type?: 'none' | 'budget' | 'all'
}

interface Account {
  plaid_account_id: string
  name: string
  official_name: string | null
  mask: string | null
}

const PAGE_SIZE = 100

export default function TransactionsPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [transferModalOpen, setTransferModalOpen] = useState(false)

  // Multi-select state
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkProcessing, setBulkProcessing] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Transaction[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'income' | 'expenses'>('all')
  const [dateFilter, setDateFilter] = useState('This Month')
  const [visibleCount, setVisibleCount] = useState(50)

  // Check for query params (review_transfers, search, id)
  useEffect(() => {
    if (searchParams.get('review_transfers') === 'true') {
      setTransferModalOpen(true)
      // Clear the query param from URL without page reload
      window.history.replaceState({}, '', '/dashboard/transactions')
    }

    // Handle search param from dashboard navigation
    const searchParam = searchParams.get('search')
    if (searchParam) {
      setSearchQuery(searchParam)
      setDateFilter('All Time') // Show all time when searching from dashboard
      // Clear the query param from URL without page reload
      window.history.replaceState({}, '', '/dashboard/transactions')
    }

    // Handle direct transaction link (from notifications)
    const transactionId = searchParams.get('id')
    if (transactionId) {
      // Try to find in loaded transactions first
      const found = transactions.find(t => t.id === transactionId)
      if (found) {
        setSelectedTransaction(found)
        // Clear the query param from URL without page reload
        window.history.replaceState({}, '', '/dashboard/transactions')
      } else if (!loading) {
        // Fetch the specific transaction
        supabase
          .from('transactions')
          .select('*')
          .eq('id', transactionId)
          .single()
          .then(({ data, error }) => {
            if (data && !error) {
              setSelectedTransaction(data)
            }
            // Clear URL after fetch attempt (whether successful or not)
            window.history.replaceState({}, '', '/dashboard/transactions')
          })
      }
      // If still loading, don't clear URL - let it re-run when loading completes
    }
  }, [searchParams, transactions, loading, supabase])

  useEffect(() => {
    async function loadData() {
      setLoading(true)

      // Get total count
      const { count, error: countError } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })

      if (countError) {
        console.error('Error fetching transaction count:', countError)
      }
      setTotalCount(count)

      const [txRes, accRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .or('ignore_type.is.null,ignore_type.neq.all')
          .order('date', { ascending: false })
          .range(0, PAGE_SIZE - 1),
        supabase
          .from('accounts')
          .select('plaid_account_id, name, official_name, mask'),
      ])

      if (txRes.error) {
        console.error('Error fetching transactions:', txRes.error)
      }

      if (txRes.data) {
        setTransactions(txRes.data)
        setHasMore(txRes.data.length === PAGE_SIZE)
      }
      if (accRes.data) setAccounts(accRes.data)

      setLoading(false)
    }

    loadData()
  }, [supabase])

  const loadMoreTransactions = async () => {
    if (loadingMore || !hasMore) return

    setLoadingMore(true)
    const offset = transactions.length

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .or('ignore_type.is.null,ignore_type.neq.all')
      .order('date', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (data && !error) {
      setTransactions(prev => [...prev, ...data])
      setHasMore(data.length === PAGE_SIZE)
    }

    setLoadingMore(false)
  }

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Server-side search when query changes
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null)
      return
    }

    setSearching(true)
    try {
      const searchLower = `%${query.toLowerCase()}%`
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`name.ilike.${searchLower},display_name.ilike.${searchLower},merchant_name.ilike.${searchLower}`)
        .order('date', { ascending: false })
        .limit(200)

      if (!error && data) {
        setSearchResults(data)
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setSearching(false)
    }
  }, [supabase])

  useEffect(() => {
    performSearch(debouncedSearch)
  }, [debouncedSearch, performSearch])

  // Filter transactions - use server search results when available
  const filteredTransactions = useMemo(() => {
    // When searching, use server-side search results
    let filtered = searchResults !== null ? [...searchResults] : [...transactions]

    // Only apply local search filter if not using server results (fallback)
    if (searchQuery && searchResults === null) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(tx =>
        (tx.display_name || tx.merchant_name || tx.name).toLowerCase().includes(query) ||
        formatCategory(tx.category || tx.ai_category).toLowerCase().includes(query)
      )
    }

    // Date filter - skip when searching (user wants to find a specific transaction)
    if (!searchQuery) {
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
    }

    // Type filter
    if (activeTab === 'income') {
      filtered = filtered.filter(tx => tx.amount < 0 || tx.is_income)
    } else if (activeTab === 'expenses') {
      filtered = filtered.filter(tx => tx.amount > 0 && !tx.is_income)
    }

    return filtered
  }, [transactions, searchQuery, searchResults, dateFilter, activeTab])

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
      // If ignoring from all, remove from list and close detail sheet
      if (updates.ignore_type === 'all') {
        setTransactions(prev => prev.filter(t => t.id !== id))
        setSelectedTransaction(null)
      } else {
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
        if (selectedTransaction?.id === id) {
          setSelectedTransaction(prev => prev ? { ...prev, ...updates } : prev)
        }
      }
    }
  }

  // Multi-select functions
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const selectAll = () => {
    const allIds = filteredTransactions.slice(0, visibleCount).map(t => t.id)
    setSelectedIds(new Set(allIds))
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    setSelectionMode(false)
  }

  const handleBulkIgnore = async () => {
    if (selectedIds.size === 0) return
    setBulkProcessing(true)

    try {
      // Update all selected transactions to ignore_type = 'all'
      const promises = Array.from(selectedIds).map(id =>
        fetch('/api/transactions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ignore_type: 'all' }),
        })
      )

      await Promise.all(promises)

      // Remove all selected transactions from list
      setTransactions(prev => prev.filter(t => !selectedIds.has(t.id)))
      toast.success(`Ignored ${selectedIds.size} transactions`)
      clearSelection()
    } catch (error) {
      console.error('Bulk ignore error:', error)
      toast.error('Failed to ignore some transactions')
    } finally {
      setBulkProcessing(false)
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
    <div className="max-w-3xl mx-auto py-2 md:py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Transactions</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={selectionMode ? "default" : "outline"}
            size="sm"
            onClick={() => {
              if (selectionMode) {
                clearSelection()
              } else {
                setSelectionMode(true)
              }
            }}
            className="gap-2"
          >
            {selectionMode ? <XCircle className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
            <span className="hidden sm:inline">{selectionMode ? 'Cancel' : 'Select'}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTransferModalOpen(true)}
            className="gap-2"
          >
            <ArrowLeftRight className="h-4 w-4" />
            <span className="hidden sm:inline">Review Transfers</span>
          </Button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-muted/50 border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkIgnore}
            disabled={bulkProcessing}
            className="gap-2"
          >
            {bulkProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
            Ignore All
          </Button>
        </div>
      )}

      {/* AI-Powered Natural Language Search */}
      <NLTransactionSearch onTransactionClick={handleSearchTransactionClick} />

      {/* Regular Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search all transactions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-12 pl-12 pr-10 text-base rounded-xl border-0 bg-muted/50 focus-visible:ring-1"
        />
        {searching ? (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground" />
        ) : searchQuery ? (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 md:mb-6">
        <div className="flex bg-muted/50 rounded-xl p-1 w-full sm:w-auto">
          {(['all', 'income', 'expenses'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-white dark:bg-slate-800 shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'all' ? 'All' : tab === 'income' ? 'Income' : 'Expenses'}
            </button>
          ))}
        </div>

        <div className="hidden sm:block flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 rounded-xl w-full sm:w-auto justify-between sm:justify-center">
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
          <p className="text-muted-foreground mt-1">
            {searching
              ? 'Searching...'
              : searchQuery
                ? `No matches found for "${searchQuery}"`
                : 'Try adjusting your search or filters'}
          </p>
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
                  const isSelected = selectedIds.has(tx.id)

                  return (
                    <button
                      key={tx.id}
                      onClick={() => {
                        if (selectionMode) {
                          toggleSelection(tx.id)
                        } else {
                          setSelectedTransaction(tx)
                        }
                      }}
                      className={`w-full flex items-center gap-4 p-3 -mx-3 rounded-2xl transition-colors hover:bg-muted/50 group ${
                        isSelected ? 'bg-primary/10 hover:bg-primary/15' : ''
                      }`}
                    >
                      {/* Checkbox in selection mode */}
                      {selectionMode && (
                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelection(tx.id)}
                          />
                        </div>
                      )}

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

                      {/* Chevron - hide in selection mode */}
                      {!selectionMode && (
                        <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-muted-foreground shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Show More Activity - single button like Chase.com */}
          {(visibleCount < filteredTransactions.length || hasMore) && (
            <div className="pt-6 pb-4 text-center">
              <Button
                variant="outline"
                onClick={async () => {
                  // If we have more loaded transactions to show, reveal them
                  if (visibleCount < filteredTransactions.length) {
                    setVisibleCount(prev => prev + 50)
                  }
                  // If we're near the end of loaded transactions and there's more in DB, fetch more
                  if (visibleCount + 50 >= filteredTransactions.length && hasMore && !loadingMore) {
                    await loadMoreTransactions()
                  }
                }}
                disabled={loadingMore}
                className="rounded-xl px-8"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Show More Activity'
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Showing {Math.min(visibleCount, filteredTransactions.length)} of {totalCount || transactions.length} transactions
              </p>
            </div>
          )}

          {/* All loaded message */}
          {visibleCount >= filteredTransactions.length && !hasMore && transactions.length > 0 && (
            <div className="pt-6 pb-4 text-center">
              <p className="text-xs text-muted-foreground">
                All {transactions.length} transactions loaded
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

      {/* Transfer Review Modal */}
      <TransferReviewModal
        open={transferModalOpen}
        onOpenChange={setTransferModalOpen}
        onComplete={() => {
          // Refresh transactions to update ignored status
          window.location.reload()
        }}
      />
    </div>
  )
}
