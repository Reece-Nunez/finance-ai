'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  TrendingUp,
  AlertTriangle,
  Calendar,
  DollarSign,
  RefreshCw,
  ArrowDown,
  ArrowUp,
  Info,
  Brain,
  Target,
  ChevronDown,
  ChevronUp,
  Receipt,
  Wallet,
  PiggyBank,
} from 'lucide-react'
import { SterlingIcon } from '@/components/ui/sterling-icon'
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

interface LearningData {
  usedLearnedPatterns: boolean
  patternsCount: number
  incomeSourcesCount: number
  accuracyAdjustment: number | null
  recentAccuracy: {
    meanError: number
    directionAccuracy: number
  } | null
}

interface BreakdownItem {
  name: string
  amount: number
}

interface ForecastBreakdown {
  income: {
    total: number
    items: BreakdownItem[]
  }
  recurringExpenses: {
    total: number
    items: BreakdownItem[]
  }
  discretionarySpending: {
    total: number
    dailyAverage: number
    description: string
  }
  netChange: number
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
  breakdown?: ForecastBreakdown
  learning?: LearningData
}

export function CashFlowForecast() {
  const [data, setData] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLearning, setIsLearning] = useState(false)
  const [showBreakdown, setShowBreakdown] = useState(false)

  const fetchForecast = async (store = false, recalculate = false) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ days: '30' })
      if (store) params.set('store', 'true')
      if (recalculate) params.set('recalculate', 'true')
      const response = await fetch(`/api/cash-flow/forecast?${params.toString()}`)
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
    fetchForecast(true) // Store predictions on initial load
  }, [])

  const handleRefresh = async () => {
    toast.info('Recalculating forecast (excluding ignored transfers)...')
    await fetchForecast(true, true) // store=true, recalculate=true
    toast.success('Forecast recalculated')
  }

  const handleLearn = async () => {
    setIsLearning(true)
    try {
      // Step 1: Analyze patterns
      toast.info('Analyzing spending patterns...', { id: 'learning' })
      const analyzeRes = await fetch('/api/cash-flow/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze_patterns' }),
      })
      const analyzeData = await analyzeRes.json()

      if (!analyzeRes.ok) {
        throw new Error(analyzeData.error || 'Pattern analysis failed')
      }

      // Step 2: Compare predictions to actuals
      toast.info('Comparing predictions to actual spending...', { id: 'learning' })
      await fetch('/api/cash-flow/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compare_actuals' }),
      })

      // Step 3: AI analysis of errors (if there are any to analyze)
      toast.info('AI analyzing prediction accuracy...', { id: 'learning' })
      await fetch('/api/cash-flow/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze_errors' }),
      })

      // Step 4: Calculate accuracy metrics
      await fetch('/api/cash-flow/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'calculate_accuracy' }),
      })

      toast.success('Learning complete!', {
        id: 'learning',
        description: `Learned ${analyzeData.patternsLearned} patterns from your spending history.`,
      })

      // Refresh forecast with new patterns
      await fetchForecast(true)
    } catch (err) {
      toast.error('Learning failed', {
        id: 'learning',
        description: err instanceof Error ? err.message : 'Please try again',
      })
    } finally {
      setIsLearning(false)
    }
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

  const { forecast, summary, dailySpendingRate, upcomingRecurring, learning } = data
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
        <div className="flex items-center gap-2">
          {/* Show retrain button only if patterns exist (indicating prior learning) */}
          {learning && learning.patternsCount > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLearn}
                    disabled={isLearning}
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    {isLearning ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Brain className="h-3.5 w-3.5" />
                    )}
                    {isLearning ? 'Analyzing...' : 'Retrain'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">
                    Force re-analysis of spending patterns (learning happens automatically every 24 hours)
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Button variant="ghost" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
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
          <div
            className="rounded-lg bg-muted/50 p-3 cursor-pointer hover:bg-muted/70 transition-colors"
            onClick={() => setShowBreakdown(!showBreakdown)}
          >
            <p className="text-xs text-muted-foreground flex items-center justify-between">
              Change
              <span className="text-blue-600 dark:text-blue-400 text-[10px] font-medium">
                {showBreakdown ? 'Hide' : 'Why?'}
              </span>
            </p>
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

        {/* Breakdown Section */}
        {showBreakdown && data.breakdown && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                30-Day Projection Breakdown
              </h4>
              <Button variant="ghost" size="sm" onClick={() => setShowBreakdown(false)}>
                <ChevronUp className="h-4 w-4" />
              </Button>
            </div>

            {/* Income */}
            {data.breakdown.income.total > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <ArrowUp className="h-4 w-4" />
                    Expected Income
                  </span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    +${data.breakdown.income.total.toLocaleString()}
                  </span>
                </div>
                <div className="pl-6 space-y-1">
                  {data.breakdown.income.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{item.name}</span>
                      <span>+${item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recurring Expenses */}
            {data.breakdown.recurringExpenses.total > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <Wallet className="h-4 w-4" />
                    Recurring Bills & Subscriptions
                  </span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    -${data.breakdown.recurringExpenses.total.toLocaleString()}
                  </span>
                </div>
                <div className="pl-6 space-y-1 max-h-32 overflow-y-auto">
                  {data.breakdown.recurringExpenses.items.slice(0, 10).map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="truncate mr-2">{item.name}</span>
                      <span className="shrink-0">-${item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  {data.breakdown.recurringExpenses.items.length > 10 && (
                    <div className="text-xs text-muted-foreground italic">
                      +{data.breakdown.recurringExpenses.items.length - 10} more...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Discretionary Spending */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <PiggyBank className="h-4 w-4" />
                  Projected Daily Spending
                </span>
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  -${data.breakdown.discretionarySpending.total.toLocaleString()}
                </span>
              </div>
              <p className="pl-6 text-xs text-muted-foreground">
                {data.breakdown.discretionarySpending.description}
                <br />
                <span className="text-[10px]">(30 days × ${data.breakdown.discretionarySpending.dailyAverage.toFixed(2)}/day)</span>
              </p>
            </div>

            {/* Net Change Summary */}
            <div className="border-t pt-3 mt-3">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Net Change</span>
                <span className={data.breakdown.netChange >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {data.breakdown.netChange >= 0 ? '+' : ''}{data.breakdown.netChange.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                = ${data.breakdown.income.total.toLocaleString()} income
                − ${data.breakdown.recurringExpenses.total.toLocaleString()} bills
                − ${data.breakdown.discretionarySpending.total.toLocaleString()} daily spending
              </p>
            </div>
          </div>
        )}

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

        {/* AI Learning Status */}
        {learning && (learning.usedLearnedPatterns || learning.patternsCount > 0) && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-800 dark:bg-indigo-950/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <SterlingIcon size="sm" />
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  AI-Enhanced Prediction
                </span>
              </div>
              <span className="text-[10px] text-indigo-500 dark:text-indigo-400">
                Auto-learns daily
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Patterns learned:</span>
                <span className="font-medium">{learning.patternsCount}</span>
              </div>
              {learning.incomeSourcesCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <ArrowUp className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-muted-foreground">Income sources:</span>
                  <span className="font-medium">{learning.incomeSourcesCount}</span>
                </div>
              )}
              {learning.recentAccuracy && (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Avg error:</span>
                    <span className={`font-medium ${
                      learning.recentAccuracy.meanError < 10
                        ? 'text-emerald-600'
                        : learning.recentAccuracy.meanError < 25
                        ? 'text-amber-600'
                        : 'text-red-600'
                    }`}>
                      {learning.recentAccuracy.meanError.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Direction accuracy:</span>
                    <span className={`font-medium ${
                      learning.recentAccuracy.directionAccuracy >= 0.7
                        ? 'text-emerald-600'
                        : learning.recentAccuracy.directionAccuracy >= 0.5
                        ? 'text-amber-600'
                        : 'text-red-600'
                    }`}>
                      {(learning.recentAccuracy.directionAccuracy * 100).toFixed(0)}%
                    </span>
                  </div>
                </>
              )}
              {learning.accuracyAdjustment && (
                <div className="col-span-2 flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                  <Brain className="h-3.5 w-3.5" />
                  <span>Self-correcting by {((learning.accuracyAdjustment - 1) * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>
          </div>
        )}

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
