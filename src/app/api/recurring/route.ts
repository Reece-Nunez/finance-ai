import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
  transactions: Transaction[]
}

function analyzeRecurringPatterns(transactions: Transaction[]): RecurringTransaction[] {
  // Group transactions by merchant/name pattern
  const groups = new Map<string, Transaction[]>()

  for (const tx of transactions) {
    const key = (tx.display_name || tx.merchant_name || tx.name).toLowerCase().trim()
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(tx)
  }

  const recurring: RecurringTransaction[] = []

  for (const [key, txs] of groups) {
    // Need at least 2 transactions to detect pattern
    if (txs.length < 2) continue

    // Sort by date
    const sorted = [...txs].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // Calculate intervals between transactions
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

    // Calculate amount consistency
    const amounts = txs.map((t) => Math.abs(t.amount))
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const amountVariance =
      amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / amounts.length
    const amountStdDev = Math.sqrt(amountVariance)
    const amountConsistent = amountStdDev / avgAmount < 0.2 // 20% variance allowed

    // Calculate interval consistency
    const intervalVariance =
      intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length
    const intervalStdDev = Math.sqrt(intervalVariance)
    const intervalConsistent = intervalStdDev < 10 // 10 days variance allowed

    // Determine frequency
    let frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'yearly' | null = null
    if (avgInterval <= 10) frequency = 'weekly'
    else if (avgInterval <= 20) frequency = 'bi-weekly'
    else if (avgInterval <= 40) frequency = 'monthly'
    else if (avgInterval <= 100) frequency = 'quarterly'
    else if (avgInterval <= 400) frequency = 'yearly'

    // Skip if no clear frequency pattern
    if (!frequency) continue

    // Determine confidence
    let confidence: 'high' | 'medium' | 'low' = 'low'
    if (amountConsistent && intervalConsistent && txs.length >= 3) {
      confidence = 'high'
    } else if ((amountConsistent || intervalConsistent) && txs.length >= 3) {
      confidence = 'medium'
    } else if (txs.length >= 4) {
      confidence = 'medium'
    }

    // Skip low confidence with few occurrences
    if (confidence === 'low' && txs.length < 4) continue

    // Calculate next expected date
    const lastTx = sorted[sorted.length - 1]
    const lastDate = new Date(lastTx.date)
    let daysToAdd = 30 // default monthly
    if (frequency === 'weekly') daysToAdd = 7
    else if (frequency === 'bi-weekly') daysToAdd = 14
    else if (frequency === 'monthly') daysToAdd = 30
    else if (frequency === 'quarterly') daysToAdd = 90
    else if (frequency === 'yearly') daysToAdd = 365

    const nextDate = new Date(lastDate)
    nextDate.setDate(nextDate.getDate() + Math.round(avgInterval))

    // Use first transaction's ID as the recurring group ID
    const firstTx = sorted[0]
    const displayName = firstTx.display_name || firstTx.merchant_name || firstTx.name

    recurring.push({
      id: firstTx.id,
      name: firstTx.name,
      displayName,
      amount: lastTx.amount,
      averageAmount: avgAmount,
      frequency,
      nextDate: nextDate.toISOString().split('T')[0],
      lastDate: lastTx.date,
      category: firstTx.category,
      accountId: firstTx.plaid_account_id,
      isIncome: firstTx.is_income || lastTx.amount < 0,
      confidence,
      occurrences: txs.length,
      transactions: sorted,
    })
  }

  // Sort by next date
  recurring.sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime())

  return recurring
}

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get all transactions from the last 12 months for analysis
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', twelveMonthsAgo.toISOString().split('T')[0])
    .neq('ignore_type', 'all')
    .order('date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const recurring = analyzeRecurringPatterns(transactions || [])

  // Calculate yearly spend (only for expenses, not income)
  const yearlySpend = recurring
    .filter(r => !r.isIncome && r.amount > 0)
    .reduce((sum, r) => {
      let multiplier = 12 // default monthly
      if (r.frequency === 'weekly') multiplier = 52
      else if (r.frequency === 'bi-weekly') multiplier = 26
      else if (r.frequency === 'monthly') multiplier = 12
      else if (r.frequency === 'quarterly') multiplier = 4
      else if (r.frequency === 'yearly') multiplier = 1
      return sum + (r.averageAmount * multiplier)
    }, 0)

  return NextResponse.json({
    recurring,
    yearlySpend,
    count: recurring.length,
  })
}
