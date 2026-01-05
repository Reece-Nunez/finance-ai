'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react'
import { SterlingIcon } from '@/components/ui/sterling-icon'
import { CategorySelector } from '@/components/dashboard/category-selector'
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

export default function UncategorizedPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [categorizedCount, setCategorizedCount] = useState(0)

  useEffect(() => {
    const fetchUncategorized = async () => {
      try {
        const response = await fetch('/api/spending?period=this_month')
        if (response.ok) {
          const data = await response.json()
          const uncategorized = (data.transactions || []).filter(
            (t: Transaction) => !t.category || t.category.toLowerCase() === 'uncategorized'
          )
          setTransactions(uncategorized)
        }
      } catch (error) {
        console.error('Error fetching uncategorized:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUncategorized()
  }, [])

  const handleCategoryChange = async (txId: string, category: string) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: txId, category }),
      })

      if (response.ok) {
        // Update local state
        setTransactions(prev =>
          prev.map(t => (t.id === txId ? { ...t, category } : t))
        )
        setCategorizedCount(prev => prev + 1)
      }
    } catch (error) {
      console.error('Error updating category:', error)
    }
  }

  const remainingCount = transactions.filter(
    t => !t.category || t.category.toLowerCase() === 'uncategorized'
  ).length
  const totalCount = transactions.length
  const progress = totalCount > 0 ? ((totalCount - remainingCount) / totalCount) * 100 : 100

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="text-muted-foreground">Loading transactions...</p>
        </div>
      </div>
    )
  }

  // All done!
  if (remainingCount === 0 && totalCount > 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="max-w-md text-center">
          <CardContent className="pt-8 pb-6">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30">
                <CheckCircle2 className="h-8 w-8" />
              </div>
            </div>
            <h2 className="text-xl font-bold mb-2">All Done!</h2>
            <p className="text-muted-foreground mb-6">
              You&apos;ve categorized all {totalCount} transactions. Great job keeping your finances organized!
            </p>
            <Button onClick={() => router.push('/dashboard/spending')}>
              Back to Spending
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // No uncategorized transactions
  if (totalCount === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="max-w-md text-center">
          <CardContent className="pt-8 pb-6">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30">
                <SterlingIcon size="lg" />
              </div>
            </div>
            <h2 className="text-xl font-bold mb-2">All Categorized!</h2>
            <p className="text-muted-foreground mb-6">
              All your transactions are already categorized. Keep up the great work!
            </p>
            <Button onClick={() => router.push('/dashboard/spending')}>
              Back to Spending
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Categorize Transactions</h1>
          <p className="text-muted-foreground">
            {remainingCount} transaction{remainingCount !== 1 ? 's' : ''} need categorization
          </p>
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Progress</span>
            <span className="text-sm font-medium">
              {totalCount - remainingCount} of {totalCount} categorized
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Uncategorized Transactions</CardTitle>
          <CardDescription>
            Select a category for each transaction to keep your spending organized
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transactions
              .filter(tx => !tx.category || tx.category.toLowerCase() === 'uncategorized')
              .map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <MerchantLogo
                      merchantName={tx.merchant_name || tx.name}
                      category={tx.category}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {tx.display_name || tx.merchant_name || tx.name}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{formatDate(tx.date)}</span>
                        <span>•</span>
                        <span
                          className={tx.amount < 0 ? 'text-green-600' : 'text-red-600'}
                        >
                          {tx.amount < 0 ? '+' : '-'}{formatCurrency(tx.amount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="ml-4 w-[200px]">
                    <CategorySelector
                      value={tx.category}
                      onChange={(category) => handleCategoryChange(tx.id, category)}
                    />
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
