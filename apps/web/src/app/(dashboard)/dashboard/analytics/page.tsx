import { createClient } from '@/lib/supabase/server'
import { formatCategory } from '@/lib/format'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SpendingByCategory } from '@/components/charts/spending-by-category'
import { SpendingOverTime } from '@/components/charts/spending-over-time'
import { MonthlyComparison } from '@/components/charts/monthly-comparison'
import { DailySpending } from '@/components/charts/daily-spending'
import { BarChart3, TrendingUp, PieChart, Calendar } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function AnalyticsPage() {
  const supabase = await createClient()

  // Fetch all transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: true })

  // Fetch budgets for reference
  const { data: budgets } = await supabase.from('budgets').select('*')

  const hasData = (transactions?.length || 0) > 0

  // Process data for charts
  const categoryData = processSpendingByCategory(transactions || [])
  const monthlyData = processMonthlyComparison(transactions || [])
  const timeSeriesData = processSpendingOverTime(transactions || [])
  const dailyData = processDailySpending(transactions || [])

  // Calculate current month's budget total if available
  const monthlyBudget = (budgets || []).reduce((sum, b) => sum + (b.amount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground">Visualize your spending patterns and trends</p>
        </div>
      </div>

      {!hasData ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium">No transaction data yet</h3>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Connect a bank account and sync your transactions to see analytics.
            </p>
            <Button asChild className="mt-4 bg-gradient-to-r from-emerald-500 to-teal-600">
              <Link href="/dashboard/accounts">Connect Account</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {/* Top row - Overview charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Spending by Category */}
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <div className="rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 p-2">
                  <PieChart className="h-4 w-4 text-white" />
                </div>
                <div>
                  <CardTitle>Spending by Category</CardTitle>
                  <CardDescription>Where your money goes</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <SpendingByCategory data={categoryData} />
              </CardContent>
            </Card>

            {/* Monthly Comparison */}
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <div className="rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 p-2">
                  <BarChart3 className="h-4 w-4 text-white" />
                </div>
                <div>
                  <CardTitle>Monthly Comparison</CardTitle>
                  <CardDescription>Income vs Expenses by month</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <MonthlyComparison data={monthlyData} />
              </CardContent>
            </Card>
          </div>

          {/* Full width - Spending over time */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <div className="rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 p-2">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle>Spending Over Time</CardTitle>
                <CardDescription>Track your income and expenses trends</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <SpendingOverTime data={timeSeriesData} />
            </CardContent>
          </Card>

          {/* Daily spending for current month */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <div className="rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 p-2">
                <Calendar className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle>This Month&apos;s Daily Spending</CardTitle>
                <CardDescription>
                  Cumulative spending throughout the month
                  {monthlyBudget > 0 && ` (Budget: $${monthlyBudget.toLocaleString()})`}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <DailySpending data={dailyData} budget={monthlyBudget > 0 ? monthlyBudget : undefined} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// Helper functions to process transaction data

function processSpendingByCategory(transactions: any[]) {
  const categoryMap: Record<string, number> = {}

  transactions.forEach((tx) => {
    // Only count expenses (positive amounts in Plaid)
    if (tx.amount > 0) {
      const category = formatCategory(tx.category || tx.ai_category)
      categoryMap[category] = (categoryMap[category] || 0) + tx.amount
    }
  })

  return Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value, color: '' }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10) // Top 10 categories
}

function processMonthlyComparison(transactions: any[]) {
  const monthlyMap: Record<string, { income: number; expenses: number }> = {}

  transactions.forEach((tx) => {
    const date = new Date(tx.date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const monthName = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })

    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = { income: 0, expenses: 0 }
    }

    if (tx.amount < 0) {
      // Income (negative in Plaid)
      monthlyMap[monthKey].income += Math.abs(tx.amount)
    } else {
      // Expense
      monthlyMap[monthKey].expenses += tx.amount
    }
  })

  return Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6) // Last 6 months
    .map(([key, data]) => {
      const [year, month] = key.split('-')
      const date = new Date(parseInt(year), parseInt(month) - 1)
      return {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        income: data.income,
        expenses: data.expenses,
        net: data.income - data.expenses,
      }
    })
}

function processSpendingOverTime(transactions: any[]) {
  const weeklyMap: Record<string, { income: number; expenses: number }> = {}

  transactions.forEach((tx) => {
    const date = new Date(tx.date)
    // Get start of week (Sunday)
    const startOfWeek = new Date(date)
    startOfWeek.setDate(date.getDate() - date.getDay())
    const weekKey = startOfWeek.toISOString().split('T')[0]

    if (!weeklyMap[weekKey]) {
      weeklyMap[weekKey] = { income: 0, expenses: 0 }
    }

    if (tx.amount < 0) {
      weeklyMap[weekKey].income += Math.abs(tx.amount)
    } else {
      weeklyMap[weekKey].expenses += tx.amount
    }
  })

  return Object.entries(weeklyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12) // Last 12 weeks
    .map(([date, data]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      income: data.income,
      expenses: data.expenses,
    }))
}

function processDailySpending(transactions: any[]) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // Filter to current month expenses only
  const monthTransactions = transactions.filter((tx) => {
    const txDate = new Date(tx.date)
    return txDate >= startOfMonth && tx.amount > 0
  })

  const dailyMap: Record<string, number> = {}

  monthTransactions.forEach((tx) => {
    const date = tx.date.split('T')[0]
    dailyMap[date] = (dailyMap[date] || 0) + tx.amount
  })

  // Generate all days of the month up to today
  const days: { date: string; amount: number; cumulative: number }[] = []
  let cumulative = 0

  for (let d = 1; d <= now.getDate(); d++) {
    const date = new Date(now.getFullYear(), now.getMonth(), d)
    const dateKey = date.toISOString().split('T')[0]
    const amount = dailyMap[dateKey] || 0
    cumulative += amount

    days.push({
      date: date.toLocaleDateString('en-US', { day: 'numeric' }),
      amount,
      cumulative,
    })
  }

  return days
}
