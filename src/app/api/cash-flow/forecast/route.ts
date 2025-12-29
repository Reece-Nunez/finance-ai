import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  generateCashFlowForecast,
  calculateDailySpendingRate,
  getForecastSummary,
  RecurringItem,
  CashFlowForecast,
} from '@/lib/cash-flow'

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

  // Parse query params
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '30', 10)
  const lowBalanceThreshold = parseFloat(searchParams.get('threshold') || '100')

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
    .neq('ignore_type', 'all')
    .order('date', { ascending: false })

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 })
  }

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

  // Mark recurring transactions and calculate daily spending rate
  const markedTransactions = markRecurringTransactions(transactions || [], recurringPatterns)
  const dailySpendingRate = calculateDailySpendingRate(markedTransactions, 30)

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

  // Get upcoming recurring transactions (next 7 days) for quick view
  const upcomingRecurring = recurringItems
    .filter((r) => {
      const nextDate = new Date(r.nextDate)
      const sevenDaysFromNow = new Date()
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
      return nextDate <= sevenDaysFromNow && nextDate >= new Date()
    })
    .sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime())

  return NextResponse.json({
    forecast,
    summary,
    dailySpendingRate: Math.round(dailySpendingRate * 100) / 100,
    upcomingRecurring,
    accounts: (accounts || []).filter((a) => a.type === 'depository').map((a) => ({
      id: a.id,
      name: a.name,
      balance: a.current_balance,
      type: a.subtype,
    })),
  })
}
