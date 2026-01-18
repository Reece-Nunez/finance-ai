import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  generateCashFlowForecast,
  calculateDailySpendingRate,
  getForecastSummary,
  RecurringItem,
} from '@/lib/cash-flow'
import { getPredictedDailySpending, SpendingPattern, analyzeSpendingPatterns } from '@/lib/spending-patterns'
import { getUserSubscription, canAccessFeature } from '@/lib/subscription'

interface Transaction {
  id: string
  name: string
  merchant_name: string | null
  display_name: string | null
  amount: number
  date: string
  category: string | null
  plaid_account_id: string
  is_income: boolean
}

interface RecurringTransaction {
  id: string
  name: string
  displayName: string
  amount: number
  averageAmount: number
  frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'yearly'
  nextDate: string
  lastDate: string
  category: string | null
  accountId: string
  isIncome: boolean
  confidence: 'high' | 'medium' | 'low'
  occurrences: number
}

// Reuse the recurring pattern analysis from the recurring API
function analyzeRecurringPatterns(transactions: Transaction[]): RecurringTransaction[] {
  const groups = new Map<string, Transaction[]>()

  for (const tx of transactions) {
    const key = (tx.display_name || tx.merchant_name || tx.name).toLowerCase().trim()
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(tx)
  }

  const recurring: RecurringTransaction[] = []

  for (const [, txs] of groups) {
    if (txs.length < 2) continue

    const sorted = [...txs].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    const intervals: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].date)
      const curr = new Date(sorted[i].date)
      const daysDiff = Math.round(
        (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
      )
      intervals.push(daysDiff)
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length

    const amounts = txs.map((t) => Math.abs(t.amount))
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const amountVariance =
      amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / amounts.length
    const amountStdDev = Math.sqrt(amountVariance)
    const amountConsistent = amountStdDev / avgAmount < 0.2

    const intervalVariance =
      intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length
    const intervalStdDev = Math.sqrt(intervalVariance)
    const intervalConsistent = intervalStdDev < 10

    let frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'yearly' | null = null
    if (avgInterval <= 10) frequency = 'weekly'
    else if (avgInterval <= 20) frequency = 'bi-weekly'
    else if (avgInterval <= 40) frequency = 'monthly'
    else if (avgInterval <= 100) frequency = 'quarterly'
    else if (avgInterval <= 400) frequency = 'yearly'

    if (!frequency) continue

    let confidence: 'high' | 'medium' | 'low' = 'low'
    if (amountConsistent && intervalConsistent && txs.length >= 3) {
      confidence = 'high'
    } else if ((amountConsistent || intervalConsistent) && txs.length >= 3) {
      confidence = 'medium'
    } else if (txs.length >= 4) {
      confidence = 'medium'
    }

    if (confidence === 'low' && txs.length < 4) continue

    const lastTx = sorted[sorted.length - 1]
    const lastDate = new Date(lastTx.date)

    const nextDate = new Date(lastDate)
    nextDate.setDate(nextDate.getDate() + Math.round(avgInterval))

    const firstTx = sorted[0]
    const displayName = firstTx.display_name || firstTx.merchant_name || firstTx.name

    recurring.push({
      id: firstTx.id,
      name: firstTx.name,
      displayName,
      amount: Math.abs(lastTx.amount),
      averageAmount: avgAmount,
      frequency,
      nextDate: nextDate.toISOString().split('T')[0],
      lastDate: lastTx.date,
      category: firstTx.category,
      accountId: firstTx.plaid_account_id,
      isIncome: firstTx.is_income || lastTx.amount < 0,
      confidence,
      occurrences: txs.length,
    })
  }

  recurring.sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime())

  return recurring
}

// Identify which transactions are recurring (for daily spending calculation)
function markRecurringTransactions(
  transactions: Transaction[],
  recurringPatterns: RecurringTransaction[]
): (Transaction & { isRecurring: boolean })[] {
  const recurringNames = new Set(
    recurringPatterns.map((r) => r.displayName.toLowerCase().trim())
  )

  return transactions.map((tx) => {
    const txName = (tx.display_name || tx.merchant_name || tx.name).toLowerCase().trim()
    return {
      ...tx,
      isRecurring: recurringNames.has(txName),
    }
  })
}

export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check subscription for cash flow predictions access
  const subscription = await getUserSubscription(user.id)
  if (!canAccessFeature(subscription, 'cash_flow')) {
    return NextResponse.json(
      { error: 'upgrade_required', message: 'Cash Flow Predictions requires a Pro subscription' },
      { status: 403 }
    )
  }

  // Parse query params
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '30', 10)
  const lowBalanceThreshold = parseFloat(searchParams.get('threshold') || '100')
  const storePredictions = searchParams.get('store') === 'true'
  const recalculate = searchParams.get('recalculate') === 'true'

  // If recalculate is true, delete old predictions to force fresh calculation
  if (recalculate) {
    await supabase
      .from('cash_flow_predictions')
      .delete()
      .eq('user_id', user.id)
  }

  // Get all accounts for total balance
  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', user.id)

  if (accountsError) {
    return NextResponse.json({ error: accountsError.message }, { status: 500 })
  }

  // Calculate total current balance (checking + savings)
  const currentBalance = (accounts || [])
    .filter((a) => a.type === 'depository')
    .reduce((sum, a) => sum + (a.current_balance || 0), 0)

  // Get transactions from last 12 months for pattern analysis
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', twelveMonthsAgo.toISOString().split('T')[0])
    .or('ignore_type.is.null,ignore_type.neq.all')
    .order('date', { ascending: false })

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 })
  }

  // Get learned spending patterns if available
  let { data: learnedPatterns } = await supabase
    .from('spending_patterns')
    .select('*')
    .eq('user_id', user.id)

  // Get learned income patterns
  let { data: incomePatterns } = await supabase
    .from('income_patterns')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)

  // =========================================================================
  // AUTOMATIC LEARNING: Check if patterns need updating
  // =========================================================================
  const shouldAnalyzePatterns = (() => {
    // No patterns exist yet
    if (!learnedPatterns || learnedPatterns.length === 0) return true

    // Check if patterns are older than 24 hours
    const lastCalculated = learnedPatterns[0]?.last_calculated_at
    if (!lastCalculated) return true

    const hoursSinceUpdate = (Date.now() - new Date(lastCalculated).getTime()) / (1000 * 60 * 60)
    return hoursSinceUpdate > 24
  })()

  if (shouldAnalyzePatterns && transactions && transactions.length >= 10) {
    // Run pattern analysis automatically
    const analysis = analyzeSpendingPatterns(transactions as Array<{
      id: string
      amount: number
      date: string
      category: string | null
      merchant_name: string | null
      name: string
      is_income: boolean
    }>)

    // Store spending patterns - BATCH UPSERT (N+1 fix)
    if (analysis.spendingPatterns.length > 0) {
      const spendingPatternRecords = analysis.spendingPatterns.map(pattern => ({
        user_id: user.id,
        pattern_type: pattern.patternType,
        dimension_key: pattern.dimensionKey,
        category: pattern.category,
        average_amount: pattern.averageAmount,
        median_amount: pattern.medianAmount,
        std_deviation: pattern.stdDeviation,
        min_amount: pattern.minAmount,
        max_amount: pattern.maxAmount,
        occurrence_count: pattern.occurrenceCount,
        confidence_score: pattern.confidenceScore,
        weight: pattern.weight,
        data_points_used: pattern.dataPointsUsed,
        months_of_data: pattern.monthsOfData,
        last_calculated_at: new Date().toISOString(),
      }))

      await supabase
        .from('spending_patterns')
        .upsert(spendingPatternRecords, {
          onConflict: 'user_id,pattern_type,dimension_key,category',
        })
    }

    // Store income patterns - BATCH UPSERT (N+1 fix)
    if (analysis.incomePatterns.length > 0) {
      const incomePatternRecords = analysis.incomePatterns.map(income => ({
        user_id: user.id,
        source_name: income.sourceName,
        source_type: income.sourceType,
        typical_day_of_month: income.typicalDayOfMonth,
        typical_day_of_week: income.typicalDayOfWeek,
        frequency: income.frequency,
        average_amount: income.averageAmount,
        min_amount: income.minAmount,
        max_amount: income.maxAmount,
        variability: income.variability,
        confidence_score: income.confidenceScore,
        occurrences_analyzed: income.occurrencesAnalyzed,
        last_occurrence: income.lastOccurrence,
        next_expected: income.nextExpected,
        is_active: true,
      }))

      await supabase
        .from('income_patterns')
        .upsert(incomePatternRecords, {
          onConflict: 'user_id,source_name',
        })
    }

    // Refresh the patterns after storing
    const { data: refreshedPatterns } = await supabase
      .from('spending_patterns')
      .select('*')
      .eq('user_id', user.id)
    learnedPatterns = refreshedPatterns

    const { data: refreshedIncome } = await supabase
      .from('income_patterns')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
    incomePatterns = refreshedIncome
  }

  // =========================================================================
  // AUTOMATIC LEARNING: Compare past predictions to actuals
  // =========================================================================
  const today = new Date().toISOString().split('T')[0]

  // Check for predictions that need comparison (only once per session)
  const { data: uncomaredPredictions } = await supabase
    .from('cash_flow_predictions')
    .select('id, prediction_date, predicted_balance')
    .eq('user_id', user.id)
    .lt('prediction_date', today)
    .is('actual_balance', null)
    .limit(7)

  if (uncomaredPredictions && uncomaredPredictions.length > 0) {
    // Calculate daily actuals from transactions
    const predDates = uncomaredPredictions.map(p => p.prediction_date)
    const { data: predTransactions } = await supabase
      .from('transactions')
      .select('date, amount, is_income')
      .eq('user_id', user.id)
      .in('date', predDates)
      .or('ignore_type.is.null,ignore_type.neq.all')

    const dailyActuals: Map<string, { income: number; expenses: number }> = new Map()
    for (const tx of predTransactions || []) {
      if (!dailyActuals.has(tx.date)) {
        dailyActuals.set(tx.date, { income: 0, expenses: 0 })
      }
      const daily = dailyActuals.get(tx.date)!
      if (tx.is_income || tx.amount < 0) {
        daily.income += Math.abs(tx.amount)
      } else {
        daily.expenses += tx.amount
      }
    }

    // Estimate actuals and update predictions - Use Promise.all for parallel execution (N+1 fix)
    let runningBalance = currentBalance
    const sortedPreds = [...uncomaredPredictions].sort(
      (a, b) => new Date(b.prediction_date).getTime() - new Date(a.prediction_date).getTime()
    )

    // Calculate all updates first, then execute in parallel
    const updates: Array<{ id: string; data: Record<string, unknown> }> = []
    for (const pred of sortedPreds) {
      const daily = dailyActuals.get(pred.prediction_date)
      const actualIncome = daily?.income || 0
      const actualExpenses = daily?.expenses || 0
      const actualBalance = runningBalance
      runningBalance = runningBalance + actualExpenses - actualIncome

      const variance = actualBalance - pred.predicted_balance
      const variancePercent = pred.predicted_balance !== 0
        ? (variance / Math.abs(pred.predicted_balance)) * 100
        : 0

      updates.push({
        id: pred.id,
        data: {
          actual_balance: actualBalance,
          actual_income: actualIncome,
          actual_expenses: actualExpenses,
          actual_recorded_at: new Date().toISOString(),
          variance_amount: variance,
          variance_percentage: variancePercent,
        },
      })
    }

    // Execute all updates in parallel
    await Promise.all(
      updates.map(({ id, data }) =>
        supabase
          .from('cash_flow_predictions')
          .update(data)
          .eq('id', id)
      )
    )
  }

  // Get prediction accuracy to adjust confidence
  const { data: accuracyData } = await supabase
    .from('prediction_accuracy')
    .select('mean_percentage_error, direction_accuracy')
    .eq('user_id', user.id)
    .order('period_start', { ascending: false })
    .limit(1)
    .single()

  // Analyze recurring patterns
  const recurringPatterns = analyzeRecurringPatterns(transactions || [])

  // Convert to RecurringItem format for the cash flow engine
  const recurringItems: RecurringItem[] = recurringPatterns.map((r) => ({
    id: r.id,
    name: r.displayName,
    amount: r.averageAmount,
    frequency: r.frequency,
    nextDate: r.nextDate,
    isIncome: r.isIncome,
    confidence: r.confidence,
    category: r.category || undefined,
  }))

  // Add income patterns as recurring items
  if (incomePatterns) {
    for (const income of incomePatterns) {
      if (income.next_expected && new Date(income.next_expected) >= new Date()) {
        recurringItems.push({
          id: `income-${income.id}`,
          name: income.source_name,
          amount: income.average_amount,
          frequency: income.frequency as RecurringItem['frequency'],
          nextDate: income.next_expected,
          isIncome: true,
          confidence: income.confidence_score >= 0.7 ? 'high' : income.confidence_score >= 0.4 ? 'medium' : 'low',
          category: 'Income',
        })
      }
    }
  }

  // Mark recurring transactions and calculate base daily spending rate
  const markedTransactions = markRecurringTransactions(transactions || [], recurringPatterns)
  let dailySpendingRate = calculateDailySpendingRate(markedTransactions, 30)

  // Enhance with learned patterns if available
  let usedLearnedPatterns = false
  if (learnedPatterns && learnedPatterns.length > 0) {
    usedLearnedPatterns = true
    // Use pattern-based prediction for a sample day to get more accurate rate
    const today = new Date()
    const patterns = learnedPatterns.map(p => ({
      patternType: p.pattern_type,
      dimensionKey: p.dimension_key,
      category: p.category,
      averageAmount: p.average_amount,
      medianAmount: p.median_amount,
      stdDeviation: p.std_deviation,
      minAmount: p.min_amount,
      maxAmount: p.max_amount,
      occurrenceCount: p.occurrence_count,
      confidenceScore: p.confidence_score,
      weight: p.weight,
      dataPointsUsed: p.data_points_used,
      monthsOfData: p.months_of_data,
    })) as SpendingPattern[]

    const patternPrediction = getPredictedDailySpending(patterns, today)

    // Blend historical rate with pattern prediction based on pattern confidence
    if (patternPrediction.confidence > 0.3) {
      const blendWeight = Math.min(patternPrediction.confidence, 0.6)
      dailySpendingRate = (dailySpendingRate * (1 - blendWeight)) + (patternPrediction.amount * blendWeight)
    }
  }

  // Apply accuracy-based adjustment if we have historical accuracy data
  let accuracyAdjustment = 1.0
  if (accuracyData && accuracyData.mean_percentage_error) {
    // If we've been under-predicting, increase the rate slightly
    // If we've been over-predicting, decrease it
    const errorPercent = accuracyData.mean_percentage_error / 100
    if (errorPercent > 0.1) {
      accuracyAdjustment = 1 + (errorPercent * 0.5) // Partial correction
    }
    dailySpendingRate *= accuracyAdjustment
  }

  // Generate forecast
  const forecast = generateCashFlowForecast(
    currentBalance,
    recurringItems,
    dailySpendingRate,
    days,
    lowBalanceThreshold
  )

  // Get summary message
  const summary = getForecastSummary(forecast)

  // Store prediction snapshots if requested
  if (storePredictions && forecast.dailyForecasts.length > 0) {
    // Only store predictions for the next 7 days to avoid too much data
    const predictionsToStore = forecast.dailyForecasts.slice(0, 7).map(day => ({
      user_id: user.id,
      prediction_date: day.date,
      predicted_balance: day.projectedBalance,
      predicted_income: day.transactions
        .filter(t => t.type === 'recurring_income')
        .reduce((sum, t) => sum + t.amount, 0),
      predicted_expenses: day.transactions
        .filter(t => t.type !== 'recurring_income')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
      predicted_recurring: day.transactions
        .filter(t => t.type === 'recurring_expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
      predicted_discretionary: day.transactions
        .filter(t => t.type === 'projected_spending')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
      confidence_score: forecast.confidence === 'high' ? 0.8 : forecast.confidence === 'medium' ? 0.5 : 0.3,
      prediction_factors: {
        usedLearnedPatterns,
        accuracyAdjustment,
        dailySpendingRate,
        recurringItemsCount: recurringItems.length,
      },
    }))

    // Upsert predictions - BATCH INSERT (N+1 fix)
    // Use insert instead of upsert since we want to create new predictions, not update old ones
    await supabase
      .from('cash_flow_predictions')
      .insert(predictionsToStore)
  }

  // Get upcoming recurring transactions (next 7 days) for quick view
  const upcomingRecurring = recurringItems
    .filter((r) => {
      const nextDate = new Date(r.nextDate)
      const sevenDaysFromNow = new Date()
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
      return nextDate <= sevenDaysFromNow && nextDate >= new Date()
    })
    .sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime())

  // Get recent accuracy for display
  const recentAccuracy = accuracyData ? {
    meanError: accuracyData.mean_percentage_error,
    directionAccuracy: accuracyData.direction_accuracy,
  } : null

  // =========================================================================
  // BUILD DETAILED BREAKDOWN
  // =========================================================================
  const incomeBySource: Record<string, number> = {}
  const expensesByName: Record<string, number> = {}
  let totalDiscretionary = 0

  for (const day of forecast.dailyForecasts) {
    for (const tx of day.transactions) {
      if (tx.type === 'recurring_income') {
        incomeBySource[tx.name] = (incomeBySource[tx.name] || 0) + tx.amount
      } else if (tx.type === 'recurring_expense') {
        expensesByName[tx.name] = (expensesByName[tx.name] || 0) + Math.abs(tx.amount)
      } else if (tx.type === 'projected_spending') {
        totalDiscretionary += Math.abs(tx.amount)
      }
    }
  }

  // Sort by amount (highest first)
  const incomeBreakdown = Object.entries(incomeBySource)
    .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount)

  const expenseBreakdown = Object.entries(expensesByName)
    .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount)

  const breakdown = {
    income: {
      total: forecast.totalIncome,
      items: incomeBreakdown,
    },
    recurringExpenses: {
      total: Math.round((forecast.totalExpenses - totalDiscretionary) * 100) / 100,
      items: expenseBreakdown,
    },
    discretionarySpending: {
      total: Math.round(totalDiscretionary * 100) / 100,
      dailyAverage: dailySpendingRate,
      description: `Based on your average daily spending of $${dailySpendingRate.toFixed(2)}`,
    },
    netChange: forecast.netCashFlow,
  }

  return NextResponse.json({
    forecast,
    summary,
    dailySpendingRate: Math.round(dailySpendingRate * 100) / 100,
    upcomingRecurring,
    breakdown,
    accounts: (accounts || []).filter((a) => a.type === 'depository').map((a) => ({
      id: a.id,
      name: a.name,
      balance: a.current_balance,
      type: a.subtype,
    })),
    learning: {
      usedLearnedPatterns,
      patternsCount: learnedPatterns?.length || 0,
      incomeSourcesCount: incomePatterns?.length || 0,
      accuracyAdjustment: accuracyAdjustment !== 1.0 ? accuracyAdjustment : null,
      recentAccuracy,
    },
  })
}
