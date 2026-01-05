'use client'

import { useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  X,
  Loader2,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Crown,
} from 'lucide-react'
import { SterlingIcon } from '@/components/ui/sterling-icon'
import { formatCurrency, formatCategory, formatDate } from '@/lib/format'
import { MerchantLogo } from '@/components/ui/merchant-logo'
import {
  SearchResponse,
  SearchTransaction,
  SearchSummary,
  SearchComparison,
  CategoryBreakdown,
} from '@/types/search'
import { useSubscription } from '@/hooks/useSubscription'
import { UpgradeModal } from '@/components/subscription/upgrade-modal'

interface NLTransactionSearchProps {
  onTransactionClick?: (transaction: SearchTransaction) => void
}

const EXAMPLE_QUERIES = [
  'How much did I spend on food last month?',
  'Show transactions over $100 this year',
  'What is my average grocery spending?',
  'Compare my spending this month vs last month',
]

export function NLTransactionSearch({ onTransactionClick }: NLTransactionSearchProps) {
  const { isPro, isLoading: subscriptionLoading } = useSubscription()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<SearchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const executeSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to search transactions')
        return
      }

      setResult(data)
    } catch {
      setError('Failed to connect to search service')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    executeSearch(query)
  }

  const handleExampleClick = (example: string) => {
    setQuery(example)
    executeSearch(example)
  }

  const clearSearch = () => {
    setQuery('')
    setResult(null)
    setError(null)
  }

  // Show upgrade prompt for free users
  if (!subscriptionLoading && !isPro) {
    return (
      <>
        <div className="mb-6">
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="w-full relative group"
          >
            <div className="h-12 pl-12 pr-24 text-base rounded-xl border border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50/50 to-slate-100/50 dark:from-slate-900/20 dark:to-slate-800/20 flex items-center">
              <span className="absolute left-4 top-1/2 -translate-y-1/2"><SterlingIcon size="md" /></span>
              <span className="text-muted-foreground text-sm">Ask about your transactions using AI...</span>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <Badge className="bg-gradient-to-r from-slate-500 to-slate-700 text-white text-[10px]">
                  <Crown className="h-3 w-3 mr-1" />
                  PRO
                </Badge>
              </div>
            </div>
          </button>
        </div>
        <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />
      </>
    )
  }

  return (
    <div className="mb-6">
      {/* Search Input */}
      <form onSubmit={handleSubmit} className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2"><SterlingIcon size="md" /></span>
        <Input
          placeholder="Ask about your transactions... (e.g., 'How much did I spend on Amazon?')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 pl-12 pr-24 text-base rounded-xl border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50/50 to-slate-100/50 dark:from-slate-950/20 dark:to-slate-900/20 focus-visible:ring-slate-500"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && !isLoading && (
            <button
              type="button"
              onClick={clearSearch}
              className="p-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={!query.trim() || isLoading}
            className="h-8 px-3 rounded-lg bg-slate-600 hover:bg-slate-700"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>

      {/* Example Queries - only show when no result */}
      {!result && !isLoading && !error && (
        <div className="flex flex-wrap gap-2 mt-3">
          {EXAMPLE_QUERIES.map((example) => (
            <button
              key={example}
              onClick={() => handleExampleClick(example)}
              className="text-xs px-3 py-1.5 rounded-full bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="mt-4 p-6 rounded-xl bg-muted/30 border">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
            <p className="text-sm text-muted-foreground">Analyzing your transactions...</p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !isLoading && (
        <div className="mt-4">
          {/* Interpretation Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <SterlingIcon size="sm" />
              <p className="text-sm font-medium">{result.interpretation.summary}</p>
            </div>
            <button
              onClick={clearSearch}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>

          {/* Summary Result */}
          {result.resultType === 'summary' && result.summary && (
            <SummaryResult summary={result.summary} />
          )}

          {/* Comparison Result */}
          {result.resultType === 'comparison' && result.comparison && (
            <ComparisonResult comparison={result.comparison} />
          )}

          {/* Transaction List Result */}
          {result.resultType === 'transactions' && result.transactions && (
            <TransactionListResult
              transactions={result.transactions.items}
              total={result.transactions.total}
              hasMore={result.transactions.hasMore}
              onTransactionClick={onTransactionClick}
            />
          )}
        </div>
      )}
    </div>
  )
}

function SummaryResult({ summary }: { summary: SearchSummary }) {
  return (
    <div className="p-5 rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 border border-violet-100 dark:border-violet-800">
      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{formatCurrency(summary.total)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Transactions</p>
          <p className="text-2xl font-bold">{summary.count}</p>
        </div>
      </div>

      {summary.average !== undefined && summary.count > 1 && (
        <div className="pt-3 border-t border-violet-200 dark:border-violet-700">
          <p className="text-sm text-muted-foreground">
            Average: <span className="font-medium text-foreground">{formatCurrency(summary.average)}</span> per transaction
          </p>
        </div>
      )}

      {/* Category Breakdown */}
      {summary.breakdown && summary.breakdown.length > 0 && (
        <div className="mt-4 pt-4 border-t border-violet-200 dark:border-violet-700">
          <p className="text-sm font-medium mb-3">Breakdown by Category</p>
          <div className="space-y-2">
            {summary.breakdown.slice(0, 5).map((cat: CategoryBreakdown) => (
              <div key={cat.category} className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{formatCategory(cat.category)}</span>
                    <span className="font-medium">{formatCurrency(cat.total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-violet-200 dark:bg-violet-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-500"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground w-10 text-right">
                  {cat.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ComparisonResult({ comparison }: { comparison: SearchComparison }) {
  const isIncrease = comparison.difference > 0
  const isDecrease = comparison.difference < 0

  return (
    <div className="p-5 rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 border border-violet-100 dark:border-violet-800">
      {/* Period Comparison */}
      <div className="grid grid-cols-2 gap-6 mb-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{comparison.period1.label}</p>
          <p className="text-2xl font-bold">{formatCurrency(comparison.period1.total)}</p>
          <p className="text-xs text-muted-foreground">{comparison.period1.count} transactions</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">{comparison.period2.label}</p>
          <p className="text-2xl font-bold">{formatCurrency(comparison.period2.total)}</p>
          <p className="text-xs text-muted-foreground">{comparison.period2.count} transactions</p>
        </div>
      </div>

      {/* Change Summary */}
      <div className="pt-4 border-t border-violet-200 dark:border-violet-700">
        <div className="flex items-center gap-2">
          {isIncrease ? (
            <div className="flex items-center gap-1 text-red-600">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">+{comparison.percentageChange}%</span>
            </div>
          ) : isDecrease ? (
            <div className="flex items-center gap-1 text-emerald-600">
              <TrendingDown className="h-4 w-4" />
              <span className="text-sm font-medium">{comparison.percentageChange}%</span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">No change</span>
          )}
          <span className="text-sm text-muted-foreground">
            ({isIncrease ? '+' : ''}{formatCurrency(comparison.difference)})
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {isDecrease
            ? `You spent ${formatCurrency(Math.abs(comparison.difference))} less in ${comparison.period1.label}`
            : isIncrease
            ? `You spent ${formatCurrency(comparison.difference)} more in ${comparison.period1.label}`
            : `Spending was the same in both periods`}
        </p>
      </div>
    </div>
  )
}

function TransactionListResult({
  transactions,
  total,
  hasMore,
  onTransactionClick,
}: {
  transactions: SearchTransaction[]
  total: number
  hasMore: boolean
  onTransactionClick?: (transaction: SearchTransaction) => void
}) {
  if (transactions.length === 0) {
    return (
      <div className="p-6 rounded-xl bg-muted/30 border text-center">
        <p className="text-muted-foreground">No transactions found matching your query</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden">
      {/* Results Header */}
      <div className="px-4 py-3 bg-muted/30 border-b">
        <p className="text-sm text-muted-foreground">
          {total} transaction{total !== 1 ? 's' : ''} found
          {hasMore && ' (showing first 50)'}
        </p>
      </div>

      {/* Transaction List */}
      <div className="divide-y">
        {transactions.slice(0, 10).map((tx) => {
          const category = tx.category || tx.ai_category
          const isIncome = tx.amount < 0 || tx.is_income

          return (
            <button
              key={tx.id}
              onClick={() => onTransactionClick?.(tx)}
              className="w-full flex items-center gap-4 p-4 transition-colors hover:bg-muted/50 text-left"
            >
              <MerchantLogo
                merchantName={tx.merchant_name || tx.name}
                category={category}
                size="md"
              />
              <div className="flex-1 min-w-0">
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
                <p className="text-sm text-muted-foreground">
                  {formatCategory(category)} · {formatDate(tx.date)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-semibold tabular-nums ${isIncome ? 'text-emerald-600' : ''}`}>
                  {isIncome ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
            </button>
          )
        })}
      </div>

      {/* Show More */}
      {transactions.length > 10 && (
        <div className="px-4 py-3 bg-muted/30 border-t text-center">
          <p className="text-sm text-muted-foreground">
            + {transactions.length - 10} more transactions
          </p>
        </div>
      )}
    </div>
  )
}
