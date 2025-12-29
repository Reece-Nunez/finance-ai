'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Calendar, DollarSign, AlertCircle } from 'lucide-react'
import { RecurringTransaction, formatFrequency, calculateYearlyCost } from '@/lib/recurring'
import { formatCategory } from '@/lib/format'
import { MerchantLogo } from '@/components/ui/merchant-logo'

interface RecurringTransactionsProps {
  recurring: RecurringTransaction[]
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function isUpcoming(dateStr: string): boolean {
  const date = new Date(dateStr)
  const now = new Date()
  const daysUntil = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return daysUntil >= 0 && daysUntil <= 7
}

function isPastDue(dateStr: string): boolean {
  return new Date(dateStr) < new Date()
}

export function RecurringTransactions({ recurring }: RecurringTransactionsProps) {
  if (recurring.length === 0) {
    return null
  }

  const totalMonthly = recurring.reduce((sum, r) => {
    const yearly = calculateYearlyCost(r)
    return sum + yearly / 12
  }, 0)

  const totalYearly = recurring.reduce((sum, r) => sum + calculateYearlyCost(r), 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <div className="rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 p-2">
          <RefreshCw className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <CardTitle>Recurring & Subscriptions</CardTitle>
          <CardDescription>
            Detected {recurring.length} recurring payment{recurring.length !== 1 ? 's' : ''}
          </CardDescription>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Est. Monthly</p>
          <p className="text-lg font-bold text-purple-600">{formatCurrency(totalMonthly)}</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recurring.map((r, idx) => {
            const upcoming = isUpcoming(r.nextExpectedDate)
            const pastDue = isPastDue(r.nextExpectedDate)

            return (
              <div
                key={idx}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <MerchantLogo
                    merchantName={r.merchantName}
                    category={r.category}
                    size="md"
                  />
                  <div>
                    <p className="font-medium capitalize">{r.merchantName}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {formatFrequency(r.frequency)}
                      </Badge>
                      {r.category && (
                        <span className="text-xs">{formatCategory(r.category)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Next: {formatDate(r.nextExpectedDate)}
                    </div>
                    {upcoming && (
                      <Badge className="mt-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Due soon
                      </Badge>
                    )}
                    {pastDue && (
                      <Badge className="mt-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        Expected
                      </Badge>
                    )}
                  </div>
                  <div className="text-right min-w-[80px]">
                    <p className="font-semibold text-purple-600">
                      {formatCurrency(r.averageAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(calculateYearlyCost(r))}/yr
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 rounded-lg bg-gradient-to-r from-purple-50 to-violet-50 p-3 dark:from-purple-950/30 dark:to-violet-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
                Total Annual Cost
              </span>
            </div>
            <span className="text-lg font-bold text-purple-600">
              {formatCurrency(totalYearly)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
