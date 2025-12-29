'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import { TransactionDetail } from './transaction-detail'

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

interface RecentTransactionsProps {
  transactions: Transaction[]
  allTransactions?: Transaction[]
  onTransactionUpdate?: (id: string, updates: Partial<Transaction>) => void
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function formatCategory(category: string | null): string {
  if (!category) return 'Uncategorized'
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function RecentTransactions({
  transactions,
  allTransactions,
  onTransactionUpdate,
}: RecentTransactionsProps) {
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const handleTransactionClick = (tx: Transaction) => {
    setSelectedTransaction(tx)
    setDetailOpen(true)
  }

  const handleUpdate = async (id: string, updates: Partial<Transaction>) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      })
      if (response.ok && onTransactionUpdate) {
        onTransactionUpdate(id, updates)
      }
    } catch (error) {
      console.error('Error updating transaction:', error)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/transactions">See All Transactions</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No transactions found. Try syncing your accounts.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  onClick={() => handleTransactionClick(tx)}
                  className="flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        tx.amount < 0
                          ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      }`}
                    >
                      {tx.amount < 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {tx.display_name || tx.merchant_name || tx.name}
                        {tx.pending && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (Pending)
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatCategory(tx.category)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        tx.amount < 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {tx.amount < 0 ? '+' : '-'}
                      {formatCurrency(Math.abs(tx.amount))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionDetail
        transaction={selectedTransaction}
        allTransactions={allTransactions || transactions}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdate={handleUpdate}
      />
    </>
  )
}
