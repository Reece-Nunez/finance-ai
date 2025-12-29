'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  DollarSign,
  ChevronRight,
  RefreshCw,
  ArrowDown,
  ArrowUp,
  Info,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from 'recharts'

interface DailyForecast {
  date: string
  projectedBalance: number
  isLowBalance: boolean
  isNegative: boolean
}

interface CashFlowAlert {
  type: 'low_balance' | 'negative_balance' | 'large_expense' | 'missed_income'
  date: string
  message: string
  severity: 'warning' | 'critical'
  amount?: number
}

interface UpcomingRecurring {
  id: string
  name: string
  amount: number
  nextDate: string
  isIncome: boolean
}

interface ForecastData {
  forecast: {
    currentBalance: number
    projectedEndBalance: number
    lowestBalance: number
    lowestBalanceDate: string
    totalIncome: number
    totalExpenses: number
    netCashFlow: number
    dailyForecasts: DailyForecast[]
    alerts: CashFlowAlert[]
    confidence: 'high' | 'medium' | 'low'
  }
  summary: string
  dailySpendingRate: number
  upcomingRecurring: UpcomingRecurring[]
}

export function CashFlowForecast() {
  const [data, setData] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchForecast = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/cash-flow/forecast?days=30')
      if (!response.ok) {
        throw new Error('Failed to fetch forecast')
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError('Unable to load forecast')
      console.error('Forecast error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchForecast()
  }, [])

  const handleRefresh = async () => {
    toast.info('Refreshing forecast...')
    await fetchForecast()
    toast.success('Forecast updated')
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Cash Flow Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{error || 'Unable to load forecast'}</p>
            <Button variant="outline" className="mt-4" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { forecast, summary, dailySpendingRate, upcomingRecurring } = data
  const balanceChange = forecast.projectedEndBalance - forecast.currentBalance
  const isPositiveChange = balanceChange >= 0

  // Prepare chart data
  const chartData = forecast.dailyForecasts
    .filter((_, i) => i % 2 === 0 || i === forecast.dailyForecasts.length - 1) // Sample every other day
    .map((day) => ({
      date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      balance: day.projectedBalance,
      isLow: day.isLowBalance || day.isNegative,
    }))

  const criticalAlerts = forecast.alerts.filter((a) => a.severity === 'critical')
  const warningAlerts = forecast.alerts.filter((a) => a.severity === 'warning')

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 p-2">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            Cash Flow Forecast
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <span
                    className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      forecast.confidence === 'high'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : forecast.confidence === 'medium'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    {forecast.confidence} confidence
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">
                    Confidence is based on the consistency and frequency of your recurring transactions.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <CardDescription className="mt-1">
            30-day projection based on your spending patterns
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Alerts */}
        {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
          <div className="space-y-2">
            {criticalAlerts.slice(0, 2).map((alert, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm dark:bg-red-950/30"
              >
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <span className="text-red-700 dark:text-red-300">{alert.message}</span>
              </div>
            ))}
            {warningAlerts.slice(0, 1).map((alert, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-950/30"
              >
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <span className="text-amber-700 dark:text-amber-300">{alert.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="text-lg font-semibold">${forecast.currentBalance.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Projected (30d)</p>
            <p className={`text-lg font-semibold ${forecast.projectedEndBalance < 0 ? 'text-red-600' : ''}`}>
              ${forecast.projectedEndBalance.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Change</p>
            <p className={`text-lg font-semibold flex items-center gap-1 ${isPositiveChange ? 'text-emerald-600' : 'text-red-600'}`}>
              {isPositiveChange ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
              ${Math.abs(balanceChange).toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Lowest Point</p>
            <p className={`text-lg font-semibold ${forecast.lowestBalance < 100 ? 'text-amber-600' : ''}`}>
              ${forecast.lowestBalance.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                className="text-muted-foreground"
                width={50}
              />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-md">
                        <p className="text-sm font-medium">{data.date}</p>
                        <p className={`text-sm ${data.isLow ? 'text-red-600' : 'text-blue-600'}`}>
                          ${data.balance.toLocaleString()}
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="5 5" />
              <ReferenceLine y={100} stroke="#f59e0b" strokeDasharray="3 3" opacity={0.5} />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#3b82f6"
                fill="url(#balanceGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Daily Spending Rate */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Average daily spending</span>
          </div>
          <span className="font-medium">${dailySpendingRate.toFixed(2)}/day</span>
        </div>

        {/* Upcoming Transactions */}
        {upcomingRecurring.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Coming up this week
            </h4>
            <div className="space-y-2">
              {upcomingRecurring.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 p-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        item.isIncome ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                    />
                    <span>{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">
                      {new Date(item.nextDate).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className={item.isIncome ? 'text-emerald-600' : 'text-red-600'}>
                      {item.isIncome ? '+' : '-'}${item.amount.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        <p className="text-sm text-muted-foreground border-t pt-4">{summary}</p>
      </CardContent>
    </Card>
  )
}
