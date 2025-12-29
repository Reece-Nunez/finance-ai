import { createClient } from '@/lib/supabase/server'

// Types
export interface Transaction {
  id: string
  user_id: string
  amount: number
  date: string
  merchant_name: string | null
  category: string | null
  account_id: string
}

export interface MerchantBaseline {
  merchant_name: string
  merchant_name_normalized: string
  average_amount: number
  median_amount: number
  min_amount: number
  max_amount: number
  std_deviation: number
  typical_frequency: string | null
  average_days_between: number | null
  transaction_count: number
  typical_category: string | null
  is_likely_subscription: boolean
  subscription_amount: number | null
  subscription_day_of_month: number | null
  first_transaction_date: string | null
  last_transaction_date: string | null
}

export interface DetectedAnomaly {
  user_id: string
  transaction_id: string | null
  anomaly_type: AnomalyType
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  merchant_name: string | null
  amount: number | null
  expected_amount: number | null
  historical_average: number | null
  deviation_percent: number | null
  related_transaction_ids: string[] | null
}

export interface AnomalyPreferences {
  sensitivity_level: number
  detect_unusual_amounts: boolean
  detect_duplicate_charges: boolean
  detect_price_increases: boolean
  detect_new_merchants: boolean
  detect_frequency_spikes: boolean
  unusual_amount_threshold: number
  duplicate_window_hours: number
  price_increase_threshold: number
  new_merchant_amount_threshold: number
}

export type AnomalyType =
  | 'unusual_amount'
  | 'duplicate_charge'
  | 'price_increase'
  | 'new_merchant_large'
  | 'frequency_spike'
  | 'category_unusual'

// Default preferences
const DEFAULT_PREFERENCES: AnomalyPreferences = {
  sensitivity_level: 5,
  detect_unusual_amounts: true,
  detect_duplicate_charges: true,
  detect_price_increases: true,
  detect_new_merchants: true,
  detect_frequency_spikes: true,
  unusual_amount_threshold: 2.0, // Standard deviations
  duplicate_window_hours: 48,
  price_increase_threshold: 0.10, // 10%
  new_merchant_amount_threshold: 100,
}

// Utility functions
function normalizemerchantName(name: string | null): string {
  if (!name) return ''
  return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
}

function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0
  const sorted = [...numbers].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function calculateStdDeviation(numbers: number[], mean: number): number {
  if (numbers.length < 2) return 0
  const squareDiffs = numbers.map(n => Math.pow(n - mean, 2))
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / numbers.length
  return Math.sqrt(avgSquareDiff)
}

function daysBetweenDates(date1: string, date2: string): number {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  return Math.abs(d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24)
}

function getSeverity(deviationPercent: number, prefs: AnomalyPreferences): 'low' | 'medium' | 'high' | 'critical' {
  // Adjust thresholds based on sensitivity (1-10)
  const sensitivityMultiplier = (11 - prefs.sensitivity_level) / 5 // Higher sensitivity = lower thresholds

  if (deviationPercent >= 500 * sensitivityMultiplier) return 'critical'
  if (deviationPercent >= 200 * sensitivityMultiplier) return 'high'
  if (deviationPercent >= 100 * sensitivityMultiplier) return 'medium'
  return 'low'
}

// Calculate merchant baselines from transaction history
export async function calculateMerchantBaselines(
  userId: string,
  transactions: Transaction[]
): Promise<MerchantBaseline[]> {
  // Group transactions by normalized merchant name
  const merchantGroups = new Map<string, Transaction[]>()

  for (const txn of transactions) {
    const normalized = normalizemerchantName(txn.merchant_name)
    if (!normalized) continue

    if (!merchantGroups.has(normalized)) {
      merchantGroups.set(normalized, [])
    }
    merchantGroups.get(normalized)!.push(txn)
  }

  const baselines: MerchantBaseline[] = []

  for (const [normalizedName, txns] of merchantGroups) {
    if (txns.length < 2) continue // Need at least 2 transactions for baseline

    const amounts = txns.map(t => Math.abs(t.amount))
    const dates = txns.map(t => t.date).sort()

    const average = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const median = calculateMedian(amounts)
    const stdDev = calculateStdDeviation(amounts, average)

    // Calculate days between transactions
    const daysBetween: number[] = []
    for (let i = 1; i < dates.length; i++) {
      daysBetween.push(daysBetweenDates(dates[i - 1], dates[i]))
    }
    const avgDaysBetween = daysBetween.length > 0
      ? daysBetween.reduce((a, b) => a + b, 0) / daysBetween.length
      : null

    // Determine frequency
    let typicalFrequency: string | null = null
    if (avgDaysBetween !== null) {
      if (avgDaysBetween <= 2) typicalFrequency = 'daily'
      else if (avgDaysBetween <= 10) typicalFrequency = 'weekly'
      else if (avgDaysBetween <= 35) typicalFrequency = 'monthly'
      else typicalFrequency = 'irregular'
    }

    // Detect subscriptions (consistent amount, monthly frequency)
    const amountVariance = stdDev / average
    const isLikelySubscription =
      typicalFrequency === 'monthly' &&
      amountVariance < 0.05 && // Less than 5% variance in amount
      txns.length >= 3

    // Get subscription day of month
    let subscriptionDay: number | null = null
    if (isLikelySubscription) {
      const daysOfMonth = txns.map(t => new Date(t.date).getDate())
      subscriptionDay = Math.round(
        daysOfMonth.reduce((a, b) => a + b, 0) / daysOfMonth.length
      )
    }

    // Get typical category
    const categoryCounts = new Map<string, number>()
    for (const txn of txns) {
      if (txn.category) {
        categoryCounts.set(txn.category, (categoryCounts.get(txn.category) || 0) + 1)
      }
    }
    const typicalCategory = [...categoryCounts.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null

    baselines.push({
      merchant_name: txns[0].merchant_name || normalizedName,
      merchant_name_normalized: normalizedName,
      average_amount: Math.round(average * 100) / 100,
      median_amount: Math.round(median * 100) / 100,
      min_amount: Math.min(...amounts),
      max_amount: Math.max(...amounts),
      std_deviation: Math.round(stdDev * 100) / 100,
      typical_frequency: typicalFrequency,
      average_days_between: avgDaysBetween ? Math.round(avgDaysBetween * 100) / 100 : null,
      transaction_count: txns.length,
      typical_category: typicalCategory,
      is_likely_subscription: isLikelySubscription,
      subscription_amount: isLikelySubscription ? median : null,
      subscription_day_of_month: subscriptionDay,
      first_transaction_date: dates[0],
      last_transaction_date: dates[dates.length - 1],
    })
  }

  return baselines
}

// Detect unusual amounts compared to merchant baseline
export function detectUnusualAmounts(
  transaction: Transaction,
  baseline: MerchantBaseline | null,
  prefs: AnomalyPreferences
): DetectedAnomaly | null {
  if (!prefs.detect_unusual_amounts) return null
  if (!baseline || baseline.transaction_count < 3) return null

  const amount = Math.abs(transaction.amount)
  const { average_amount, std_deviation } = baseline

  // Skip if no meaningful standard deviation
  if (std_deviation < 1) return null

  const deviations = (amount - average_amount) / std_deviation

  // Check if exceeds threshold
  if (deviations < prefs.unusual_amount_threshold) return null

  const deviationPercent = ((amount - average_amount) / average_amount) * 100

  return {
    user_id: transaction.user_id,
    transaction_id: transaction.id,
    anomaly_type: 'unusual_amount',
    severity: getSeverity(deviationPercent, prefs),
    title: `Unusual charge from ${transaction.merchant_name}`,
    description: `This $${amount.toFixed(2)} charge is ${deviationPercent.toFixed(0)}% higher than your typical $${average_amount.toFixed(2)} at this merchant.`,
    merchant_name: transaction.merchant_name,
    amount: amount,
    expected_amount: average_amount,
    historical_average: average_amount,
    deviation_percent: Math.round(deviationPercent * 100) / 100,
    related_transaction_ids: null,
  }
}

// Detect duplicate charges
export function detectDuplicateCharges(
  transaction: Transaction,
  recentTransactions: Transaction[],
  prefs: AnomalyPreferences
): DetectedAnomaly | null {
  if (!prefs.detect_duplicate_charges) return null

  const windowMs = prefs.duplicate_window_hours * 60 * 60 * 1000
  const txnDate = new Date(transaction.date).getTime()
  const normalizedMerchant = normalizemerchantName(transaction.merchant_name)

  if (!normalizedMerchant) return null

  // Find potential duplicates
  const duplicates = recentTransactions.filter(t => {
    if (t.id === transaction.id) return false

    const tDate = new Date(t.date).getTime()
    const timeDiff = Math.abs(txnDate - tDate)

    return (
      timeDiff <= windowMs &&
      normalizemerchantName(t.merchant_name) === normalizedMerchant &&
      Math.abs(t.amount - transaction.amount) < 0.01 // Same amount
    )
  })

  if (duplicates.length === 0) return null

  return {
    user_id: transaction.user_id,
    transaction_id: transaction.id,
    anomaly_type: 'duplicate_charge',
    severity: 'high',
    title: `Possible duplicate charge from ${transaction.merchant_name}`,
    description: `Found ${duplicates.length + 1} identical charges of $${Math.abs(transaction.amount).toFixed(2)} within ${prefs.duplicate_window_hours} hours. This could be a double charge.`,
    merchant_name: transaction.merchant_name,
    amount: Math.abs(transaction.amount),
    expected_amount: null,
    historical_average: null,
    deviation_percent: null,
    related_transaction_ids: duplicates.map(d => d.id),
  }
}

// Detect subscription price increases
export function detectPriceIncrease(
  transaction: Transaction,
  baseline: MerchantBaseline | null,
  prefs: AnomalyPreferences
): DetectedAnomaly | null {
  if (!prefs.detect_price_increases) return null
  if (!baseline?.is_likely_subscription || !baseline.subscription_amount) return null

  const amount = Math.abs(transaction.amount)
  const expectedAmount = baseline.subscription_amount

  // Check if it's an increase above threshold
  const increasePercent = (amount - expectedAmount) / expectedAmount

  if (increasePercent < prefs.price_increase_threshold) return null

  return {
    user_id: transaction.user_id,
    transaction_id: transaction.id,
    anomaly_type: 'price_increase',
    severity: increasePercent >= 0.25 ? 'high' : 'medium',
    title: `${transaction.merchant_name} subscription increased`,
    description: `Your subscription went from $${expectedAmount.toFixed(2)} to $${amount.toFixed(2)} (${(increasePercent * 100).toFixed(0)}% increase).`,
    merchant_name: transaction.merchant_name,
    amount: amount,
    expected_amount: expectedAmount,
    historical_average: baseline.average_amount,
    deviation_percent: Math.round(increasePercent * 100 * 100) / 100,
    related_transaction_ids: null,
  }
}

// Detect large transactions from new merchants
export function detectNewMerchantLarge(
  transaction: Transaction,
  baseline: MerchantBaseline | null,
  prefs: AnomalyPreferences
): DetectedAnomaly | null {
  if (!prefs.detect_new_merchants) return null

  // If we have a baseline, it's not a new merchant
  if (baseline && baseline.transaction_count >= 1) return null

  const amount = Math.abs(transaction.amount)

  // Check if exceeds new merchant threshold
  if (amount < prefs.new_merchant_amount_threshold) return null

  return {
    user_id: transaction.user_id,
    transaction_id: transaction.id,
    anomaly_type: 'new_merchant_large',
    severity: amount >= prefs.new_merchant_amount_threshold * 5 ? 'high' : 'medium',
    title: `Large first-time purchase at ${transaction.merchant_name}`,
    description: `This is your first transaction at this merchant and it's $${amount.toFixed(2)}. Please verify this is legitimate.`,
    merchant_name: transaction.merchant_name,
    amount: amount,
    expected_amount: null,
    historical_average: null,
    deviation_percent: null,
    related_transaction_ids: null,
  }
}

// Detect spending frequency spikes
export function detectFrequencySpike(
  merchantName: string,
  recentTransactions: Transaction[],
  baseline: MerchantBaseline | null,
  prefs: AnomalyPreferences,
  userId: string
): DetectedAnomaly | null {
  if (!prefs.detect_frequency_spikes) return null
  if (!baseline || !baseline.average_days_between) return null

  const normalizedMerchant = normalizemerchantName(merchantName)

  // Get transactions in the last 7 days for this merchant
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const recentMerchantTxns = recentTransactions.filter(t =>
    normalizemerchantName(t.merchant_name) === normalizedMerchant &&
    new Date(t.date) >= weekAgo
  )

  if (recentMerchantTxns.length < 3) return null

  // Calculate expected transactions per week based on baseline
  const expectedPerWeek = 7 / baseline.average_days_between

  // Check if recent frequency is significantly higher
  const frequencyRatio = recentMerchantTxns.length / expectedPerWeek

  if (frequencyRatio < 2) return null // Less than 2x normal frequency

  const totalAmount = recentMerchantTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0)

  return {
    user_id: userId,
    transaction_id: recentMerchantTxns[0].id,
    anomaly_type: 'frequency_spike',
    severity: frequencyRatio >= 4 ? 'high' : 'medium',
    title: `Unusual activity at ${merchantName}`,
    description: `You've had ${recentMerchantTxns.length} transactions at this merchant in the past week, which is ${frequencyRatio.toFixed(1)}x your normal rate. Total: $${totalAmount.toFixed(2)}`,
    merchant_name: merchantName,
    amount: totalAmount,
    expected_amount: null,
    historical_average: baseline.average_amount,
    deviation_percent: (frequencyRatio - 1) * 100,
    related_transaction_ids: recentMerchantTxns.map(t => t.id),
  }
}

// Main detection function - analyzes all transactions and returns anomalies
export async function detectAnomalies(
  userId: string,
  newTransactions: Transaction[],
  allTransactions: Transaction[],
  baselines: MerchantBaseline[],
  prefs: AnomalyPreferences = DEFAULT_PREFERENCES
): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = []
  const baselineMap = new Map(
    baselines.map(b => [b.merchant_name_normalized, b])
  )

  // Track merchants we've already checked for frequency spikes
  const checkedFrequency = new Set<string>()

  for (const transaction of newTransactions) {
    const normalizedMerchant = normalizemerchantName(transaction.merchant_name)
    const baseline = baselineMap.get(normalizedMerchant) || null

    // Check for unusual amount
    const unusualAmount = detectUnusualAmounts(transaction, baseline, prefs)
    if (unusualAmount) anomalies.push(unusualAmount)

    // Check for duplicates
    const duplicate = detectDuplicateCharges(transaction, allTransactions, prefs)
    if (duplicate) anomalies.push(duplicate)

    // Check for price increases (subscriptions)
    const priceIncrease = detectPriceIncrease(transaction, baseline, prefs)
    if (priceIncrease) anomalies.push(priceIncrease)

    // Check for new merchant large transactions
    const newMerchant = detectNewMerchantLarge(transaction, baseline, prefs)
    if (newMerchant) anomalies.push(newMerchant)

    // Check for frequency spikes (once per merchant)
    if (normalizedMerchant && !checkedFrequency.has(normalizedMerchant)) {
      checkedFrequency.add(normalizedMerchant)
      const frequencySpike = detectFrequencySpike(
        transaction.merchant_name || '',
        allTransactions,
        baseline,
        prefs,
        userId
      )
      if (frequencySpike) anomalies.push(frequencySpike)
    }
  }

  return anomalies
}

// Save baselines to database
export async function saveMerchantBaselines(
  userId: string,
  baselines: MerchantBaseline[]
): Promise<void> {
  const supabase = await createClient()

  for (const baseline of baselines) {
    const { error } = await supabase
      .from('merchant_baselines')
      .upsert({
        user_id: userId,
        merchant_name: baseline.merchant_name,
        merchant_name_normalized: baseline.merchant_name_normalized,
        average_amount: baseline.average_amount,
        median_amount: baseline.median_amount,
        min_amount: baseline.min_amount,
        max_amount: baseline.max_amount,
        std_deviation: baseline.std_deviation,
        typical_frequency: baseline.typical_frequency,
        average_days_between: baseline.average_days_between,
        transaction_count: baseline.transaction_count,
        typical_category: baseline.typical_category,
        is_likely_subscription: baseline.is_likely_subscription,
        subscription_amount: baseline.subscription_amount,
        subscription_day_of_month: baseline.subscription_day_of_month,
        first_transaction_date: baseline.first_transaction_date,
        last_transaction_date: baseline.last_transaction_date,
        last_calculated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,merchant_name_normalized'
      })

    if (error) {
      console.error('Error saving baseline:', error)
    }
  }
}

// Save detected anomalies to database
export async function saveDetectedAnomalies(
  anomalies: DetectedAnomaly[]
): Promise<{ saved: number; duplicates: number }> {
  const supabase = await createClient()
  let saved = 0
  let duplicates = 0

  for (const anomaly of anomalies) {
    const { error } = await supabase
      .from('detected_anomalies')
      .upsert({
        user_id: anomaly.user_id,
        transaction_id: anomaly.transaction_id,
        anomaly_type: anomaly.anomaly_type,
        severity: anomaly.severity,
        title: anomaly.title,
        description: anomaly.description,
        merchant_name: anomaly.merchant_name,
        amount: anomaly.amount,
        expected_amount: anomaly.expected_amount,
        historical_average: anomaly.historical_average,
        deviation_percent: anomaly.deviation_percent,
        related_transaction_ids: anomaly.related_transaction_ids,
        detected_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,transaction_id,anomaly_type',
        ignoreDuplicates: true
      })

    if (error) {
      if (error.code === '23505') {
        duplicates++
      } else {
        console.error('Error saving anomaly:', error)
      }
    } else {
      saved++
    }
  }

  return { saved, duplicates }
}

// Get user's anomaly preferences (or defaults)
export async function getAnomalyPreferences(
  userId: string
): Promise<AnomalyPreferences> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('anomaly_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!data) return DEFAULT_PREFERENCES

  return {
    sensitivity_level: data.sensitivity_level,
    detect_unusual_amounts: data.detect_unusual_amounts,
    detect_duplicate_charges: data.detect_duplicate_charges,
    detect_price_increases: data.detect_price_increases,
    detect_new_merchants: data.detect_new_merchants,
    detect_frequency_spikes: data.detect_frequency_spikes,
    unusual_amount_threshold: parseFloat(data.unusual_amount_threshold),
    duplicate_window_hours: data.duplicate_window_hours,
    price_increase_threshold: parseFloat(data.price_increase_threshold),
    new_merchant_amount_threshold: parseFloat(data.new_merchant_amount_threshold),
  }
}

// Get stored baselines for a user
export async function getMerchantBaselines(
  userId: string
): Promise<MerchantBaseline[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('merchant_baselines')
    .select('*')
    .eq('user_id', userId)

  if (error || !data) return []

  return data.map(row => ({
    merchant_name: row.merchant_name,
    merchant_name_normalized: row.merchant_name_normalized,
    average_amount: parseFloat(row.average_amount),
    median_amount: parseFloat(row.median_amount),
    min_amount: parseFloat(row.min_amount),
    max_amount: parseFloat(row.max_amount),
    std_deviation: parseFloat(row.std_deviation),
    typical_frequency: row.typical_frequency,
    average_days_between: row.average_days_between ? parseFloat(row.average_days_between) : null,
    transaction_count: row.transaction_count,
    typical_category: row.typical_category,
    is_likely_subscription: row.is_likely_subscription,
    subscription_amount: row.subscription_amount ? parseFloat(row.subscription_amount) : null,
    subscription_day_of_month: row.subscription_day_of_month,
    first_transaction_date: row.first_transaction_date,
    last_transaction_date: row.last_transaction_date,
  }))
}
