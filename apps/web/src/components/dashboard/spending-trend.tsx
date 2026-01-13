'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown } from 'lucide-react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts'

interface Transaction {
  id: string
  amount: number
  date: string
  is_income?: boolean
  ignore_type?: string
}

interface SpendingTrendProps {
  transactions: Transaction[]
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return 'th'
  switch (day % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

export function SpendingTrend({ transactions }: SpendingTrendProps) {
  const { chartData, currentMonthSpend, lastMonthSpend, percentChange } = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear

    // Get days in each month
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const daysInLastMonth = new Date(lastMonthYear, lastMonth + 1, 0).getDate()

    // Group spending by day of month for current and last month
    const currentMonthDaily: Record<number, number> = {}
    const lastMonthDaily: Record<number, number> = {}
    let currentMonthTotal = 0
    let lastMonthTotal = 0

    transactions.forEach((tx) => {
      // Skip income (negative amounts or is_income flag)
      if (tx.amount <= 0) return
      if (tx.is_income) return

      const txDate = new Date(tx.date)
      const txMonth = txDate.getMonth()
      const txYear = txDate.getFullYear()
      const dayOfMonth = txDate.getDate()

      if (txMonth === currentMonth && txYear === currentYear) {
        currentMonthDaily[dayOfMonth] = (currentMonthDaily[dayOfMonth] || 0) + tx.amount
        currentMonthTotal += tx.amount
      } else if (txMonth === lastMonth && txYear === lastMonthYear) {
        lastMonthDaily[dayOfMonth] = (lastMonthDaily[dayOfMonth] || 0) + tx.amount
        lastMonthTotal += tx.amount
      }
    })

    // Create cumulative data for each day of the month
    const maxDays = Math.max(daysInCurrentMonth, daysInLastMonth)
    const data: { day: number; dayLabel: string; thisMonth: number | null; lastMonth: number }[] = []
    let currentCumulative = 0
    let lastCumulative = 0
    const todayDay = now.getDate()

    for (let day = 1; day <= maxDays; day++) {
      currentCumulative += currentMonthDaily[day] || 0
      lastCumulative += lastMonthDaily[day] || 0

      data.push({
        day,
        dayLabel: `${day}${getOrdinalSuffix(day)}`,
        // Only show current month data up to today
        thisMonth: day <= todayDay ? currentCumulative : null,
        lastMonth: day <= daysInLastMonth ? lastCumulative : lastCumulative,
      })
    }

    // Calculate percent change
    const change = lastMonthTotal > 0
      ? ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
      : 0

    return {
      chartData: data,
      currentMonthSpend: currentMonthTotal,
      lastMonthSpend: lastMonthTotal,
      percentChange: change,
    }
  }, [transactions])

  // Spending more = bad (red), spending less = good (green)
  const isSpendingMore = percentChange > 0
  const amountDifference = Math.abs(currentMonthSpend - lastMonthSpend)

  // Get month names for legend
  const now = new Date()
  const currentMonthName = now.toLocaleDateString('en-US', { month: 'short' })
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthName = lastMonthDate.toLocaleDateString('en-US', { month: 'short' })

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Current Spend</CardTitle>
          <div
            className={`flex items-center gap-1 text-sm ${
              isSpendingMore ? 'text-red-600' : 'text-green-600'
            }`}
          >
            {isSpendingMore ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>
              {Math.abs(percentChange).toFixed(1)}% ({formatCurrency(amountDifference)}) {isSpendingMore ? 'more' : 'less'}
            </span>
          </div>
        </div>
        <p className="text-3xl font-bold">{formatCurrency(currentMonthSpend)}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="colorLastMonth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid
                horizontal={true}
                vertical={false}
                strokeDasharray="3 3"
                stroke="#e5e7eb"
              />
              <XAxis
                dataKey="dayLabel"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                ticks={['1st', '9th', '16th', '24th', '31st']}
                interval="preserveStartEnd"
              />
              <YAxis
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                width={40}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg bg-background border p-2 shadow-lg">
                        <p className="text-xs font-medium mb-1">{label}</p>
                        {payload.map((entry, index) => (
                          <p key={index} className="text-sm" style={{ color: entry.color }}>
                            {entry.name}: {formatCurrency(entry.value as number)}
                          </p>
                        ))}
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={30}
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
              {/* Last month - filled area */}
              <Area
                type="monotone"
                dataKey="lastMonth"
                name={lastMonthName}
                stroke="#94a3b8"
                strokeWidth={1}
                fill="url(#colorLastMonth)"
                connectNulls
              />
              {/* This month - line only */}
              <Line
                type="monotone"
                dataKey="thisMonth"
                name={currentMonthName}
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
