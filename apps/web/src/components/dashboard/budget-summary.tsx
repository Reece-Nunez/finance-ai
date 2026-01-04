'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface BudgetSummaryProps {
  earnings: number
  spending: number
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function BudgetSummary({ earnings, spending }: BudgetSummaryProps) {
  const maxValue = Math.max(earnings, spending, 1)
  const earningsPercent = (earnings / maxValue) * 100
  const spendingPercent = (spending / maxValue) * 100
  const netSavings = earnings - spending
  const savingsRate = earnings > 0 ? ((netSavings / earnings) * 100).toFixed(0) : '0'

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Budget</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/budgets">See All Categories</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Earnings Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Earnings</span>
            <span className="font-semibold text-green-600">
              {formatCurrency(earnings)} earned
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-500"
              style={{ width: `${earningsPercent}%` }}
            />
          </div>
        </div>

        {/* Spending Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Spending</span>
            <span className="font-semibold text-red-600">
              {formatCurrency(spending)} spent
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-500 transition-all duration-500"
              style={{ width: `${spendingPercent}%` }}
            />
          </div>
        </div>

        {/* Net Savings */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
          <span className="text-sm font-medium">Net Savings</span>
          <div className="text-right">
            <span
              className={`text-lg font-bold ${
                netSavings >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {netSavings >= 0 ? '+' : ''}{formatCurrency(netSavings)}
            </span>
            <span className="ml-2 text-sm text-muted-foreground">
              ({savingsRate}% savings rate)
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
