/**
 * Cash Flow Prediction Engine
 * Forecasts account balances based on recurring transactions and spending patterns
 */

export interface RecurringItem {
  id: string
  name: string
  amount: number
  frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'yearly'
  nextDate: string
  isIncome: boolean
  confidence: 'high' | 'medium' | 'low'
  category?: string
}

export interface DailyForecast {
  date: string
  dayOfWeek: number
  projectedBalance: number
  transactions: ForecastTransaction[]
  isLowBalance: boolean
  isNegative: boolean
}

export interface ForecastTransaction {
  name: string
  amount: number
  type: 'recurring_income' | 'recurring_expense' | 'projected_spending'
  confidence: 'high' | 'medium' | 'low'
  category?: string
}

export interface CashFlowForecast {
  startDate: string
  endDate: string
  currentBalance: number
  projectedEndBalance: number
  lowestBalance: number
  lowestBalanceDate: string
  highestBalance: number
  highestBalanceDate: string
  totalIncome: number
  totalExpenses: number
  netCashFlow: number
  dailyForecasts: DailyForecast[]
  alerts: CashFlowAlert[]
  confidence: 'high' | 'medium' | 'low'
}

export interface CashFlowAlert {
  type: 'low_balance' | 'negative_balance' | 'large_expense' | 'missed_income'
  date: string
  message: string
  severity: 'warning' | 'critical'
  amount?: number
}

// Frequency to days mapping
const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  'bi-weekly': 14,
  monthly: 30,
  quarterly: 91,
  yearly: 365,
}

/**
 * Get the next occurrence date for a recurring transaction
 */
function getNextOccurrence(lastDate: Date, frequency: string): Date {
  const days = FREQUENCY_DAYS[frequency] || 30
  const next = new Date(lastDate)
  next.setDate(next.getDate() + days)
  return next
}

/**
 * Get all occurrences of a recurring transaction within a date range
 */
function getOccurrencesInRange(
  item: RecurringItem,
  startDate: Date,
  endDate: Date
): { date: Date; amount: number }[] {
  const occurrences: { date: Date; amount: number }[] = []
  let currentDate = new Date(item.nextDate)

  // If nextDate is before startDate, advance it
  while (currentDate < startDate) {
    currentDate = getNextOccurrence(currentDate, item.frequency)
  }

  // Collect all occurrences within range
  while (currentDate <= endDate) {
    occurrences.push({
      date: new Date(currentDate),
      amount: item.amount,
    })
    currentDate = getNextOccurrence(currentDate, item.frequency)
  }

  return occurrences
}

/**
 * Calculate average daily discretionary spending from historical transactions
 */
export function calculateDailySpendingRate(
  transactions: { amount: number; date: string; isRecurring?: boolean }[],
  daysToAnalyze: number = 30
): number {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToAnalyze)

  // Filter to non-recurring expenses in the analysis period
  const discretionarySpending = transactions.filter((t) => {
    const txDate = new Date(t.date)
    return (
      txDate >= cutoffDate &&
      t.amount > 0 && // Expenses are positive in Plaid
      !t.isRecurring
    )
  })

  const totalSpending = discretionarySpending.reduce(
    (sum, t) => sum + t.amount,
    0
  )

  return totalSpending / daysToAnalyze
}

/**
 * Generate cash flow forecast
 */
export function generateCashFlowForecast(
  currentBalance: number,
  recurringItems: RecurringItem[],
  dailySpendingRate: number,
  forecastDays: number = 30,
  lowBalanceThreshold: number = 100
): CashFlowForecast {
  const startDate = new Date()
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + forecastDays)

  const dailyForecasts: DailyForecast[] = []
  let runningBalance = currentBalance
  let lowestBalance = currentBalance
  let lowestBalanceDate = startDate.toISOString().split('T')[0]
  let highestBalance = currentBalance
  let highestBalanceDate = startDate.toISOString().split('T')[0]
  let totalIncome = 0
  let totalExpenses = 0
  const alerts: CashFlowAlert[] = []

  // Pre-calculate all recurring occurrences
  const recurringOccurrences: Map<
    string,
    { item: RecurringItem; occurrences: { date: Date; amount: number }[] }
  > = new Map()

  for (const item of recurringItems) {
    const occurrences = getOccurrencesInRange(item, startDate, endDate)
    if (occurrences.length > 0) {
      recurringOccurrences.set(item.id, { item, occurrences })
    }
  }

  // Generate daily forecasts
  for (let day = 0; day <= forecastDays; day++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + day)
    const dateStr = currentDate.toISOString().split('T')[0]
    const dayOfWeek = currentDate.getDay()

    const transactions: ForecastTransaction[] = []

    // Add recurring transactions for this day
    for (const [, { item, occurrences }] of recurringOccurrences) {
      for (const occ of occurrences) {
        if (occ.date.toISOString().split('T')[0] === dateStr) {
          if (item.isIncome) {
            runningBalance += occ.amount
            totalIncome += occ.amount
            transactions.push({
              name: item.name,
              amount: occ.amount,
              type: 'recurring_income',
              confidence: item.confidence,
              category: item.category,
            })
          } else {
            runningBalance -= occ.amount
            totalExpenses += occ.amount
            transactions.push({
              name: item.name,
              amount: -occ.amount,
              type: 'recurring_expense',
              confidence: item.confidence,
              category: item.category,
            })

            // Alert for large upcoming expenses
            if (occ.amount > 500 && day > 0 && day <= 7) {
              alerts.push({
                type: 'large_expense',
                date: dateStr,
                message: `${item.name} ($${occ.amount.toFixed(2)}) coming up on ${formatDate(currentDate)}`,
                severity: 'warning',
                amount: occ.amount,
              })
            }
          }
        }
      }
    }

    // Add projected discretionary spending (skip weekends, reduce spending)
    if (day > 0) {
      // Weekend adjustment - people spend differently on weekends
      const weekendMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 1.3 : 1.0
      const projectedSpending = dailySpendingRate * weekendMultiplier

      runningBalance -= projectedSpending
      totalExpenses += projectedSpending

      transactions.push({
        name: 'Projected daily spending',
        amount: -projectedSpending,
        type: 'projected_spending',
        confidence: 'medium',
      })
    }

    // Track balance extremes
    if (runningBalance < lowestBalance) {
      lowestBalance = runningBalance
      lowestBalanceDate = dateStr
    }
    if (runningBalance > highestBalance) {
      highestBalance = runningBalance
      highestBalanceDate = dateStr
    }

    const isLowBalance = runningBalance < lowBalanceThreshold && runningBalance >= 0
    const isNegative = runningBalance < 0

    // Generate alerts
    if (isNegative && day > 0) {
      const existingNegativeAlert = alerts.find(
        (a) => a.type === 'negative_balance' && a.date === dateStr
      )
      if (!existingNegativeAlert) {
        alerts.push({
          type: 'negative_balance',
          date: dateStr,
          message: `Projected negative balance of $${Math.abs(runningBalance).toFixed(2)} on ${formatDate(currentDate)}`,
          severity: 'critical',
          amount: runningBalance,
        })
      }
    } else if (isLowBalance && day > 0) {
      const existingLowAlert = alerts.find(
        (a) => a.type === 'low_balance' && a.date === dateStr
      )
      if (!existingLowAlert) {
        alerts.push({
          type: 'low_balance',
          date: dateStr,
          message: `Balance projected to drop to $${runningBalance.toFixed(2)} on ${formatDate(currentDate)}`,
          severity: 'warning',
          amount: runningBalance,
        })
      }
    }

    dailyForecasts.push({
      date: dateStr,
      dayOfWeek,
      projectedBalance: Math.round(runningBalance * 100) / 100,
      transactions,
      isLowBalance,
      isNegative,
    })
  }

  // Calculate overall confidence based on data quality
  const highConfidenceItems = recurringItems.filter(
    (r) => r.confidence === 'high'
  ).length
  const totalItems = recurringItems.length
  const confidenceRatio = totalItems > 0 ? highConfidenceItems / totalItems : 0

  let confidence: 'high' | 'medium' | 'low' = 'medium'
  if (confidenceRatio >= 0.7 && totalItems >= 3) {
    confidence = 'high'
  } else if (confidenceRatio < 0.3 || totalItems < 2) {
    confidence = 'low'
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    currentBalance,
    projectedEndBalance: Math.round(runningBalance * 100) / 100,
    lowestBalance: Math.round(lowestBalance * 100) / 100,
    lowestBalanceDate,
    highestBalance: Math.round(highestBalance * 100) / 100,
    highestBalanceDate,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netCashFlow: Math.round((totalIncome - totalExpenses) * 100) / 100,
    dailyForecasts,
    alerts: alerts.slice(0, 10), // Limit to 10 most relevant alerts
    confidence,
  }
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Get a summary message for the forecast
 */
export function getForecastSummary(forecast: CashFlowForecast): string {
  const { projectedEndBalance, currentBalance, lowestBalance, lowestBalanceDate } = forecast
  const change = projectedEndBalance - currentBalance
  const changePercent = ((change / currentBalance) * 100).toFixed(1)

  if (lowestBalance < 0) {
    return `Warning: Your balance may go negative around ${lowestBalanceDate}. Consider adjusting spending.`
  }

  if (change >= 0) {
    return `Your balance is projected to increase by $${change.toFixed(2)} (${changePercent}%) over the next 30 days.`
  } else {
    return `Your balance is projected to decrease by $${Math.abs(change).toFixed(2)} (${Math.abs(parseFloat(changePercent))}%) over the next 30 days.`
  }
}
