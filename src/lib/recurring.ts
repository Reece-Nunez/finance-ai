// Recurring transaction detection logic

export interface RecurringTransaction {
  merchantName: string
  averageAmount: number
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
  lastDate: string
  nextExpectedDate: string
  transactionCount: number
  category?: string
  confidence: number // 0-100
}

interface Transaction {
  id: string
  merchant_name?: string | null
  name: string
  amount: number
  date: string
  category?: string | null
}

export function detectRecurringTransactions(transactions: Transaction[]): RecurringTransaction[] {
  // Group transactions by normalized merchant name
  const merchantGroups: Record<string, Transaction[]> = {}

  for (const tx of transactions) {
    // Only consider expenses (positive amounts in Plaid)
    if (tx.amount <= 0) continue

    const merchant = normalizeMerchantName(tx.merchant_name || tx.name)
    if (!merchantGroups[merchant]) {
      merchantGroups[merchant] = []
    }
    merchantGroups[merchant].push(tx)
  }

  const recurringTransactions: RecurringTransaction[] = []

  for (const [merchant, txs] of Object.entries(merchantGroups)) {
    // Need at least 2 transactions to detect pattern
    if (txs.length < 2) continue

    // Sort by date
    const sortedTxs = txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Calculate intervals between transactions
    const intervals: number[] = []
    for (let i = 1; i < sortedTxs.length; i++) {
      const daysDiff = daysBetween(sortedTxs[i - 1].date, sortedTxs[i].date)
      intervals.push(daysDiff)
    }

    // Check if amounts are similar (within 10% variance)
    const amounts = sortedTxs.map(t => t.amount)
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const amountVariance = amounts.every(a => Math.abs(a - avgAmount) / avgAmount < 0.15)

    if (!amountVariance) continue

    // Detect frequency pattern
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
    const frequency = detectFrequency(avgInterval)

    if (!frequency) continue

    // Check interval consistency (within 20% of expected)
    const expectedInterval = getExpectedDays(frequency)
    const intervalConsistency = intervals.every(i =>
      Math.abs(i - expectedInterval) / expectedInterval < 0.25
    )

    // Calculate confidence score
    let confidence = 50

    // More transactions = higher confidence
    confidence += Math.min(sortedTxs.length * 5, 25)

    // Consistent amounts = higher confidence
    if (amountVariance) confidence += 10

    // Consistent intervals = higher confidence
    if (intervalConsistency) confidence += 15

    if (confidence >= 60) {
      const lastTx = sortedTxs[sortedTxs.length - 1]
      const nextDate = addDays(lastTx.date, expectedInterval)

      recurringTransactions.push({
        merchantName: merchant,
        averageAmount: Math.round(avgAmount * 100) / 100,
        frequency,
        lastDate: lastTx.date,
        nextExpectedDate: nextDate,
        transactionCount: sortedTxs.length,
        category: lastTx.category || undefined,
        confidence: Math.min(confidence, 100),
      })
    }
  }

  // Sort by confidence (highest first)
  return recurringTransactions.sort((a, b) => b.confidence - a.confidence)
}

function normalizeMerchantName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 3) // Take first 3 words
    .join(' ')
}

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diffTime = Math.abs(d2.getTime() - d1.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

function detectFrequency(avgDays: number): RecurringTransaction['frequency'] | null {
  if (avgDays >= 5 && avgDays <= 10) return 'weekly'
  if (avgDays >= 12 && avgDays <= 18) return 'biweekly'
  if (avgDays >= 25 && avgDays <= 35) return 'monthly'
  if (avgDays >= 80 && avgDays <= 100) return 'quarterly'
  if (avgDays >= 350 && avgDays <= 380) return 'yearly'
  return null
}

function getExpectedDays(frequency: RecurringTransaction['frequency']): number {
  switch (frequency) {
    case 'weekly': return 7
    case 'biweekly': return 14
    case 'monthly': return 30
    case 'quarterly': return 90
    case 'yearly': return 365
  }
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

export function formatFrequency(frequency: RecurringTransaction['frequency']): string {
  switch (frequency) {
    case 'weekly': return 'Weekly'
    case 'biweekly': return 'Every 2 weeks'
    case 'monthly': return 'Monthly'
    case 'quarterly': return 'Quarterly'
    case 'yearly': return 'Yearly'
  }
}

export function calculateYearlyCost(recurring: RecurringTransaction): number {
  switch (recurring.frequency) {
    case 'weekly': return recurring.averageAmount * 52
    case 'biweekly': return recurring.averageAmount * 26
    case 'monthly': return recurring.averageAmount * 12
    case 'quarterly': return recurring.averageAmount * 4
    case 'yearly': return recurring.averageAmount
  }
}
