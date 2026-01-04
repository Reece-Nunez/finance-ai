'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCategory } from '@/lib/format'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Calendar,
} from 'lucide-react'
import { TransactionDetail } from '@/components/dashboard/transaction-detail'
import { MerchantLogo } from '@/components/ui/merchant-logo'

interface Transaction {
  id: string
  name: string
  merchant_name: string | null
  display_name: string | null
  amount: number
  date: string
  category: string | null
  pending: boolean
  is_income: boolean
  plaid_account_id: string
}

interface MonthlyData {
  month: string
  year: number
  amount: number
}

interface CategorySpendingData {
  category: string
  totalSpend: number
  change: number
  monthlyData: MonthlyData[]
  transactions: Transaction[]
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Math.abs(amount))
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Category Bar Chart
function CategoryBarChart({ data }: { data: MonthlyData[] }) {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null)
  const maxValue = Math.max(...data.map(d => d.amount)) * 1.1

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between px-4">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div className="flex flex-1 items-end justify-around gap-2 h-[180px] relative">
            {data.map((month, idx) => {
              const height = maxValue > 0 ? (month.amount / maxValue) * 100 : 0
              const isHovered = idx === hoveredMonth

              return (
                <div key={idx} className="flex flex-col items-center gap-2 flex-1">
                  {isHovered && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 bg-white dark:bg-slate-800 rounded-lg shadow-lg border p-3 min-w-[140px]">
                      <p className="font-semibold mb-1">{month.month} {month.year}</p>
                      <p className="text-sm">
                        Spent: <span className="font-medium">{formatCurrency(month.amount)}</span>
                      </p>
                    </div>
                  )}

                  <button
                    className="w-full max-w-[60px] flex flex-col cursor-pointer"
                    onMouseEnter={() => setHoveredMonth(idx)}
                    onMouseLeave={() => setHoveredMonth(null)}
                  >
                    <div className="flex flex-col w-full" style={{ height: '140px' }}>
                      <div className="flex-1" />
                      <div
                        className="w-full bg-blue-500 rounded-t transition-all"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                  </button>

                  <span className="text-sm text-muted-foreground">{month.month}</span>
                </div>
              )
            })}
          </div>

          <Button variant="ghost" size="icon">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CategoryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const category = decodeURIComponent(params.category as string)

  const [data, setData] = useState<CategorySpendingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('this_month')
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/spending?period=${dateFilter}&category=${encodeURIComponent(category)}`)
        if (response.ok) {
          const result = await response.json()

          // Build monthly data for just this category
          const monthlyData: MonthlyData[] = []
          const now = new Date()
          for (let i = 5; i >= 0; i--) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
            const monthTxs = (result.transactions || []).filter((t: Transaction) => {
              const txDate = new Date(t.date)
              return txDate.getMonth() === monthDate.getMonth() && txDate.getFullYear() === monthDate.getFullYear()
            })
            const amount = monthTxs
              .filter((t: Transaction) => t.amount > 0)
              .reduce((sum: number, t: Transaction) => sum + t.amount, 0)

            monthlyData.push({
              month: monthDate.toLocaleDateString('en-US', { month: 'short' }),
              year: monthDate.getFullYear(),
              amount,
            })
          }

          setData({
            category,
            totalSpend: result.summary?.spending || 0,
            change: result.summary?.spendingChange || 0,
            monthlyData,
            transactions: result.transactions || [],
          })
        }
      } catch (error) {
        console.error('Error fetching category data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [category, dateFilter])

  const handleTransactionUpdate = async (id: string, updates: Partial<Transaction>) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      })

      if (response.ok) {
        // Update local state
        setData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            transactions: prev.transactions.map(t =>
              t.id === id ? { ...t, ...updates } : t
            ),
          }
        })
        // Update selected transaction if it's the one being edited
        if (selectedTransaction?.id === id) {
          setSelectedTransaction(prev => prev ? { ...prev, ...updates } : prev)
        }
      }
    } catch (error) {
      console.error('Error updating transaction:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="text-muted-foreground">Loading category data...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Failed to load category data</p>
      </div>
    )
  }

  // Filter transactions based on dateFilter
  const filteredTransactions = data.transactions.filter(tx => {
    const txDate = new Date(tx.date)
    const now = new Date()

    switch (dateFilter) {
      case 'last_7_days':
        const sevenDaysAgo = new Date(now)
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        return txDate >= sevenDaysAgo
      case 'last_30_days':
        const thirtyDaysAgo = new Date(now)
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        return txDate >= thirtyDaysAgo
      case 'last_90_days':
        const ninetyDaysAgo = new Date(now)
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
        return txDate >= ninetyDaysAgo
      case 'this_year':
        return txDate.getFullYear() === now.getFullYear()
      case 'all':
        return true
      default: // this_month
        return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear()
    }
  })

  const currentTotal = filteredTransactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{formatCategory(category)}</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-xl font-semibold text-foreground">{formatCurrency(currentTotal)}</span>
            <span
              className={`flex items-center text-sm ${
                data.change > 0 ? 'text-red-500' : 'text-green-500'
              }`}
            >
              {data.change > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {Math.abs(data.change)}% from last period
            </span>
          </div>
        </div>
      </div>

      {/* Bar Chart */}
      <CategoryBarChart data={data.monthlyData} />

      {/* Transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Transactions</CardTitle>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                <SelectItem value="last_90_days">Last 90 Days</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
                <SelectItem value="all">All Dates</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">No transactions found for this period</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTransactions.map((tx) => (
                <button
                  key={tx.id}
                  onClick={() => setSelectedTransaction(tx)}
                  className="flex w-full items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <MerchantLogo
                      merchantName={tx.merchant_name || tx.name}
                      category={tx.category}
                      size="md"
                    />
                    <div className="text-left">
                      <p className="font-medium">
                        {tx.display_name || tx.merchant_name || tx.name}
                        {tx.pending && (
                          <Badge variant="outline" className="ml-2">
                            Pending
                          </Badge>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">{formatDate(tx.date)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        tx.amount < 0 ? 'text-green-600' : 'text-foreground'
                      }`}
                    >
                      {tx.amount < 0 ? '+' : '-'}{formatCurrency(tx.amount)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Detail Modal */}
      <TransactionDetail
        transaction={selectedTransaction}
        allTransactions={data.transactions}
        open={!!selectedTransaction}
        onOpenChange={(open) => !open && setSelectedTransaction(null)}
        onUpdate={handleTransactionUpdate}
      />
    </div>
  )
}
