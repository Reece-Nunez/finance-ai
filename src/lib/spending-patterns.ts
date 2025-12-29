/**
 * Spending Pattern Analysis Engine
 * Learns from historical transaction data to identify spending patterns
 */

export interface Transaction {
  id: string
  amount: number
  date: string
  category: string | null
  merchant_name: string | null
  name: string
  is_income: boolean
}

export interface SpendingPattern {
  patternType: PatternType
  dimensionKey: string
  category: string | null
  averageAmount: number
  medianAmount: number
  stdDeviation: number
  minAmount: number
  maxAmount: number
  occurrenceCount: number
  confidenceScore: number
  weight: number
  dataPointsUsed: number
  monthsOfData: number
}

export type PatternType =
  | 'day_of_week'
  | 'week_of_month'
  | 'month_of_year'
  | 'category_daily'
  | 'category_weekly'
  | 'category_monthly'
  | 'pay_cycle'
  | 'seasonal'

export interface IncomePattern {
  sourceName: string
  sourceType: 'salary' | 'freelance' | 'investment' | 'transfer' | 'other'
  typicalDayOfMonth: number[]
  typicalDayOfWeek: number | null
  frequency: 'weekly' | 'bi-weekly' | 'semi-monthly' | 'monthly' | 'irregular'
  averageAmount: number
  minAmount: number
  maxAmount: number
  variability: number
  confidenceScore: number
  occurrencesAnalyzed: number
  lastOccurrence: string | null
  nextExpected: string | null
}

export interface PatternAnalysisResult {
  spendingPatterns: SpendingPattern[]
  incomePatterns: IncomePattern[]
  insights: PatternInsight[]
  dataQuality: {
    totalTransactions: number
    monthsOfData: number
    categoryCoverage: number
    dataCompleteness: number
  }
}

export interface PatternInsight {
  type: 'pattern_discovered' | 'anomaly_detected' | 'recommendation'
  title: string
  description: string
  category?: string
  impactScore: number
  actionable: boolean
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getDayOfWeek(date: Date): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[date.getDay()]
}

function getWeekOfMonth(date: Date): string {
  const dayOfMonth = date.getDate()
  if (dayOfMonth <= 7) return 'week_1'
  if (dayOfMonth <= 14) return 'week_2'
  if (dayOfMonth <= 21) return 'week_3'
  return 'week_4'
}

function getMonthName(date: Date): string {
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ]
  return months[date.getMonth()]
}

function getSeason(date: Date): string {
  const month = date.getMonth()
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'fall'
  return 'winter'
}

function calculateStats(values: number[]): {
  average: number
  median: number
  stdDev: number
  min: number
  max: number
} {
  if (values.length === 0) {
    return { average: 0, median: 0, stdDev: 0, min: 0, max: 0 }
  }

  const sorted = [...values].sort((a, b) => a - b)
  const sum = values.reduce((a, b) => a + b, 0)
  const average = sum / values.length
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)]

  const variance = values.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)

  return {
    average,
    median,
    stdDev,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  }
}

function calculateConfidence(
  occurrenceCount: number,
  stdDev: number,
  average: number,
  monthsOfData: number
): number {
  // Base confidence from occurrence count
  let confidence = Math.min(occurrenceCount / 10, 0.4) // Max 0.4 from occurrences

  // Adjust for consistency (lower variance = higher confidence)
  const coefficientOfVariation = average > 0 ? stdDev / average : 1
  const consistencyBonus = Math.max(0, 0.3 - coefficientOfVariation * 0.3)
  confidence += consistencyBonus

  // Adjust for data freshness/quantity
  const dataBonus = Math.min(monthsOfData / 12, 0.3) // Max 0.3 from data quantity
  confidence += dataBonus

  return Math.min(Math.max(confidence, 0), 1)
}

// ============================================================================
// PATTERN EXTRACTION
// ============================================================================

function extractDayOfWeekPatterns(
  transactions: Transaction[],
  monthsOfData: number
): SpendingPattern[] {
  const patterns: SpendingPattern[] = []
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

  // Overall day of week patterns (expenses only)
  const dayGroups: Map<string, number[]> = new Map()
  days.forEach(day => dayGroups.set(day, []))

  for (const tx of transactions) {
    if (tx.is_income || tx.amount <= 0) continue
    const dayKey = getDayOfWeek(new Date(tx.date))
    dayGroups.get(dayKey)?.push(tx.amount)
  }

  for (const [day, amounts] of dayGroups) {
    if (amounts.length < 3) continue
    const stats = calculateStats(amounts)
    const confidence = calculateConfidence(amounts.length, stats.stdDev, stats.average, monthsOfData)

    patterns.push({
      patternType: 'day_of_week',
      dimensionKey: day,
      category: null,
      averageAmount: stats.average,
      medianAmount: stats.median,
      stdDeviation: stats.stdDev,
      minAmount: stats.min,
      maxAmount: stats.max,
      occurrenceCount: amounts.length,
      confidenceScore: confidence,
      weight: 1.0,
      dataPointsUsed: amounts.length,
      monthsOfData,
    })
  }

  return patterns
}

function extractWeekOfMonthPatterns(
  transactions: Transaction[],
  monthsOfData: number
): SpendingPattern[] {
  const patterns: SpendingPattern[] = []
  const weeks = ['week_1', 'week_2', 'week_3', 'week_4']

  const weekGroups: Map<string, number[]> = new Map()
  weeks.forEach(week => weekGroups.set(week, []))

  for (const tx of transactions) {
    if (tx.is_income || tx.amount <= 0) continue
    const weekKey = getWeekOfMonth(new Date(tx.date))
    weekGroups.get(weekKey)?.push(tx.amount)
  }

  for (const [week, amounts] of weekGroups) {
    if (amounts.length < 3) continue
    const stats = calculateStats(amounts)
    const confidence = calculateConfidence(amounts.length, stats.stdDev, stats.average, monthsOfData)

    patterns.push({
      patternType: 'week_of_month',
      dimensionKey: week,
      category: null,
      averageAmount: stats.average,
      medianAmount: stats.median,
      stdDeviation: stats.stdDev,
      minAmount: stats.min,
      maxAmount: stats.max,
      occurrenceCount: amounts.length,
      confidenceScore: confidence,
      weight: 1.0,
      dataPointsUsed: amounts.length,
      monthsOfData,
    })
  }

  return patterns
}

function extractMonthlyPatterns(
  transactions: Transaction[],
  monthsOfData: number
): SpendingPattern[] {
  const patterns: SpendingPattern[] = []

  // Group by month-year and calculate monthly totals
  const monthlyTotals: Map<string, number> = new Map()

  for (const tx of transactions) {
    if (tx.is_income || tx.amount <= 0) continue
    const date = new Date(tx.date)
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`
    monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + tx.amount)
  }

  // Group by month name across years
  const monthGroups: Map<string, number[]> = new Map()
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ]

  for (const [monthYear, total] of monthlyTotals) {
    const monthIndex = parseInt(monthYear.split('-')[1])
    const monthName = monthNames[monthIndex]
    if (!monthGroups.has(monthName)) monthGroups.set(monthName, [])
    monthGroups.get(monthName)?.push(total)
  }

  for (const [month, amounts] of monthGroups) {
    if (amounts.length < 2) continue
    const stats = calculateStats(amounts)
    const confidence = calculateConfidence(amounts.length, stats.stdDev, stats.average, monthsOfData)

    patterns.push({
      patternType: 'month_of_year',
      dimensionKey: month,
      category: null,
      averageAmount: stats.average,
      medianAmount: stats.median,
      stdDeviation: stats.stdDev,
      minAmount: stats.min,
      maxAmount: stats.max,
      occurrenceCount: amounts.length,
      confidenceScore: confidence,
      weight: 1.0,
      dataPointsUsed: amounts.length,
      monthsOfData,
    })
  }

  return patterns
}

function extractCategoryPatterns(
  transactions: Transaction[],
  monthsOfData: number
): SpendingPattern[] {
  const patterns: SpendingPattern[] = []

  // Group transactions by category
  const categoryGroups: Map<string, Transaction[]> = new Map()

  for (const tx of transactions) {
    if (tx.is_income || tx.amount <= 0) continue
    const category = tx.category || 'uncategorized'
    if (!categoryGroups.has(category)) categoryGroups.set(category, [])
    categoryGroups.get(category)?.push(tx)
  }

  for (const [category, txs] of categoryGroups) {
    if (txs.length < 5) continue

    // Daily average for this category
    const dateAmounts: Map<string, number> = new Map()
    for (const tx of txs) {
      const dateKey = tx.date
      dateAmounts.set(dateKey, (dateAmounts.get(dateKey) || 0) + tx.amount)
    }

    const dailyTotals = Array.from(dateAmounts.values())
    const dailyStats = calculateStats(dailyTotals)
    const dailyConfidence = calculateConfidence(dailyTotals.length, dailyStats.stdDev, dailyStats.average, monthsOfData)

    patterns.push({
      patternType: 'category_daily',
      dimensionKey: 'daily',
      category,
      averageAmount: dailyStats.average,
      medianAmount: dailyStats.median,
      stdDeviation: dailyStats.stdDev,
      minAmount: dailyStats.min,
      maxAmount: dailyStats.max,
      occurrenceCount: dailyTotals.length,
      confidenceScore: dailyConfidence,
      weight: 1.0,
      dataPointsUsed: dailyTotals.length,
      monthsOfData,
    })

    // Monthly totals for this category
    const monthlyAmounts: Map<string, number> = new Map()
    for (const tx of txs) {
      const date = new Date(tx.date)
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`
      monthlyAmounts.set(monthKey, (monthlyAmounts.get(monthKey) || 0) + tx.amount)
    }

    const monthlyTotals = Array.from(monthlyAmounts.values())
    if (monthlyTotals.length >= 2) {
      const monthlyStats = calculateStats(monthlyTotals)
      const monthlyConfidence = calculateConfidence(monthlyTotals.length, monthlyStats.stdDev, monthlyStats.average, monthsOfData)

      patterns.push({
        patternType: 'category_monthly',
        dimensionKey: 'monthly',
        category,
        averageAmount: monthlyStats.average,
        medianAmount: monthlyStats.median,
        stdDeviation: monthlyStats.stdDev,
        minAmount: monthlyStats.min,
        maxAmount: monthlyStats.max,
        occurrenceCount: monthlyTotals.length,
        confidenceScore: monthlyConfidence,
        weight: 1.0,
        dataPointsUsed: monthlyTotals.length,
        monthsOfData,
      })
    }
  }

  return patterns
}

function extractSeasonalPatterns(
  transactions: Transaction[],
  monthsOfData: number
): SpendingPattern[] {
  const patterns: SpendingPattern[] = []

  // Need at least a year of data for seasonal patterns
  if (monthsOfData < 6) return patterns

  const seasonGroups: Map<string, number[]> = new Map()
  const seasons = ['spring', 'summer', 'fall', 'winter']
  seasons.forEach(s => seasonGroups.set(s, []))

  // Group by month and aggregate
  const monthlyTotals: Map<string, number> = new Map()
  for (const tx of transactions) {
    if (tx.is_income || tx.amount <= 0) continue
    const date = new Date(tx.date)
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`
    monthlyTotals.set(monthKey, (monthlyTotals.get(monthKey) || 0) + tx.amount)
  }

  // Assign monthly totals to seasons
  for (const [monthYear, total] of monthlyTotals) {
    const [year, month] = monthYear.split('-').map(Number)
    const date = new Date(year, month, 15)
    const season = getSeason(date)
    seasonGroups.get(season)?.push(total)
  }

  for (const [season, amounts] of seasonGroups) {
    if (amounts.length < 2) continue
    const stats = calculateStats(amounts)
    const confidence = calculateConfidence(amounts.length, stats.stdDev, stats.average, monthsOfData)

    patterns.push({
      patternType: 'seasonal',
      dimensionKey: season,
      category: null,
      averageAmount: stats.average,
      medianAmount: stats.median,
      stdDeviation: stats.stdDev,
      minAmount: stats.min,
      maxAmount: stats.max,
      occurrenceCount: amounts.length,
      confidenceScore: confidence,
      weight: 1.0,
      dataPointsUsed: amounts.length,
      monthsOfData,
    })
  }

  return patterns
}

// ============================================================================
// INCOME PATTERN EXTRACTION
// ============================================================================

function extractIncomePatterns(transactions: Transaction[]): IncomePattern[] {
  const incomePatterns: IncomePattern[] = []

  // Filter to income transactions
  const incomeTransactions = transactions.filter(tx => tx.is_income || tx.amount < 0)

  // Group by source (normalized name)
  const sourceGroups: Map<string, Transaction[]> = new Map()

  for (const tx of incomeTransactions) {
    const sourceName = (tx.merchant_name || tx.name).toLowerCase().trim()
    if (!sourceGroups.has(sourceName)) sourceGroups.set(sourceName, [])
    sourceGroups.get(sourceName)?.push(tx)
  }

  for (const [sourceName, txs] of sourceGroups) {
    if (txs.length < 2) continue

    const amounts = txs.map(tx => Math.abs(tx.amount))
    const stats = calculateStats(amounts)

    // Analyze timing
    const dates = txs.map(tx => new Date(tx.date)).sort((a, b) => a.getTime() - b.getTime())
    const daysOfMonth = dates.map(d => d.getDate())
    const daysOfWeek = dates.map(d => d.getDay())

    // Calculate intervals
    const intervals: number[] = []
    for (let i = 1; i < dates.length; i++) {
      const days = Math.round((dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24))
      intervals.push(days)
    }

    // Determine frequency
    const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 30
    let frequency: IncomePattern['frequency'] = 'irregular'
    if (avgInterval <= 10) frequency = 'weekly'
    else if (avgInterval <= 18) frequency = 'bi-weekly'
    else if (avgInterval <= 20) frequency = 'semi-monthly'
    else if (avgInterval <= 35) frequency = 'monthly'

    // Determine source type based on name and patterns
    let sourceType: IncomePattern['sourceType'] = 'other'
    const lowerName = sourceName.toLowerCase()
    if (lowerName.includes('payroll') || lowerName.includes('salary') || lowerName.includes('direct dep')) {
      sourceType = 'salary'
    } else if (lowerName.includes('venmo') || lowerName.includes('paypal') || lowerName.includes('zelle')) {
      sourceType = 'transfer'
    } else if (lowerName.includes('dividend') || lowerName.includes('interest')) {
      sourceType = 'investment'
    }

    // Find typical days
    const dayCount: Map<number, number> = new Map()
    for (const day of daysOfMonth) {
      dayCount.set(day, (dayCount.get(day) || 0) + 1)
    }
    const typicalDays = Array.from(dayCount.entries())
      .filter(([, count]) => count >= txs.length * 0.3)
      .map(([day]) => day)
      .sort((a, b) => a - b)

    // Calculate variability
    const variability = stats.average > 0 ? stats.stdDev / stats.average : 0

    // Calculate next expected date
    const lastDate = dates[dates.length - 1]
    const nextExpected = new Date(lastDate)
    if (frequency === 'weekly') nextExpected.setDate(nextExpected.getDate() + 7)
    else if (frequency === 'bi-weekly') nextExpected.setDate(nextExpected.getDate() + 14)
    else if (frequency === 'semi-monthly') nextExpected.setDate(nextExpected.getDate() + 15)
    else nextExpected.setMonth(nextExpected.getMonth() + 1)

    const confidence = calculateConfidence(txs.length, stats.stdDev, stats.average, 12)

    incomePatterns.push({
      sourceName: sourceName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      sourceType,
      typicalDayOfMonth: typicalDays,
      typicalDayOfWeek: frequency === 'weekly' ? daysOfWeek[0] : null,
      frequency,
      averageAmount: stats.average,
      minAmount: stats.min,
      maxAmount: stats.max,
      variability,
      confidenceScore: confidence,
      occurrencesAnalyzed: txs.length,
      lastOccurrence: dates[dates.length - 1].toISOString().split('T')[0],
      nextExpected: nextExpected.toISOString().split('T')[0],
    })
  }

  return incomePatterns.sort((a, b) => b.averageAmount - a.averageAmount)
}

// ============================================================================
// INSIGHT GENERATION
// ============================================================================

function generateInsights(
  patterns: SpendingPattern[],
  incomePatterns: IncomePattern[]
): PatternInsight[] {
  const insights: PatternInsight[] = []

  // Find high-spending days
  const dayPatterns = patterns.filter(p => p.patternType === 'day_of_week')
  if (dayPatterns.length > 0) {
    const avgDaily = dayPatterns.reduce((sum, p) => sum + p.averageAmount, 0) / dayPatterns.length
    const highDays = dayPatterns.filter(p => p.averageAmount > avgDaily * 1.3)

    for (const day of highDays) {
      insights.push({
        type: 'pattern_discovered',
        title: `Higher spending on ${day.dimensionKey}s`,
        description: `You spend ${((day.averageAmount / avgDaily - 1) * 100).toFixed(0)}% more on ${day.dimensionKey}s compared to other days.`,
        impactScore: Math.min((day.averageAmount / avgDaily - 1) * 0.5, 0.8),
        actionable: true,
      })
    }
  }

  // Find week-of-month patterns (post-payday spending)
  const weekPatterns = patterns.filter(p => p.patternType === 'week_of_month')
  if (weekPatterns.length >= 2) {
    const week1 = weekPatterns.find(p => p.dimensionKey === 'week_1')
    const week4 = weekPatterns.find(p => p.dimensionKey === 'week_4')

    if (week1 && week4 && week1.averageAmount > week4.averageAmount * 1.5) {
      insights.push({
        type: 'pattern_discovered',
        title: 'Post-payday spending spike',
        description: `You spend ${((week1.averageAmount / week4.averageAmount - 1) * 100).toFixed(0)}% more in the first week of the month compared to the last week.`,
        impactScore: 0.7,
        actionable: true,
      })
    }
  }

  // Find high-variance categories
  const categoryPatterns = patterns.filter(p => p.patternType === 'category_monthly')
  for (const pattern of categoryPatterns) {
    const cv = pattern.averageAmount > 0 ? pattern.stdDeviation / pattern.averageAmount : 0
    if (cv > 0.5 && pattern.averageAmount > 100) {
      insights.push({
        type: 'pattern_discovered',
        title: `Inconsistent ${pattern.category} spending`,
        description: `Your ${pattern.category} spending varies significantly month to month (±${(cv * 100).toFixed(0)}%). This makes predictions less accurate.`,
        category: pattern.category || undefined,
        impactScore: cv * 0.6,
        actionable: false,
      })
    }
  }

  // Income stability insights
  for (const income of incomePatterns) {
    if (income.variability > 0.2) {
      insights.push({
        type: 'pattern_discovered',
        title: `Variable income from ${income.sourceName}`,
        description: `Income from ${income.sourceName} varies by ±${(income.variability * 100).toFixed(0)}%. Using average of $${income.averageAmount.toFixed(0)} for predictions.`,
        impactScore: income.variability * 0.5,
        actionable: false,
      })
    }
  }

  return insights.sort((a, b) => b.impactScore - a.impactScore).slice(0, 10)
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

export function analyzeSpendingPatterns(transactions: Transaction[]): PatternAnalysisResult {
  // Calculate data quality metrics
  const dates = transactions.map(tx => new Date(tx.date))
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
  const monthsOfData = Math.max(1, Math.round((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24 * 30)))

  const categorizedCount = transactions.filter(tx => tx.category).length
  const categoryCoverage = transactions.length > 0 ? categorizedCount / transactions.length : 0

  // Extract all patterns
  const spendingPatterns: SpendingPattern[] = [
    ...extractDayOfWeekPatterns(transactions, monthsOfData),
    ...extractWeekOfMonthPatterns(transactions, monthsOfData),
    ...extractMonthlyPatterns(transactions, monthsOfData),
    ...extractCategoryPatterns(transactions, monthsOfData),
    ...extractSeasonalPatterns(transactions, monthsOfData),
  ]

  const incomePatterns = extractIncomePatterns(transactions)
  const insights = generateInsights(spendingPatterns, incomePatterns)

  return {
    spendingPatterns,
    incomePatterns,
    insights,
    dataQuality: {
      totalTransactions: transactions.length,
      monthsOfData,
      categoryCoverage,
      dataCompleteness: Math.min(monthsOfData / 12, 1) * 0.5 + categoryCoverage * 0.5,
    },
  }
}

// ============================================================================
// PREDICTION HELPERS
// ============================================================================

export function getPredictedDailySpending(
  patterns: SpendingPattern[],
  date: Date,
  category?: string
): { amount: number; confidence: number } {
  const dayOfWeek = getDayOfWeek(date)
  const weekOfMonth = getWeekOfMonth(date)
  const monthName = getMonthName(date)
  const season = getSeason(date)

  let totalWeight = 0
  let weightedSum = 0
  let confidenceSum = 0

  // Day of week pattern
  const dayPattern = patterns.find(
    p => p.patternType === 'day_of_week' && p.dimensionKey === dayOfWeek && !p.category
  )
  if (dayPattern) {
    const weight = dayPattern.confidenceScore * 0.3
    weightedSum += dayPattern.averageAmount * weight
    totalWeight += weight
    confidenceSum += dayPattern.confidenceScore
  }

  // Week of month pattern
  const weekPattern = patterns.find(
    p => p.patternType === 'week_of_month' && p.dimensionKey === weekOfMonth && !p.category
  )
  if (weekPattern) {
    const weight = weekPattern.confidenceScore * 0.25
    weightedSum += weekPattern.averageAmount * weight
    totalWeight += weight
    confidenceSum += weekPattern.confidenceScore
  }

  // Monthly pattern
  const monthPattern = patterns.find(
    p => p.patternType === 'month_of_year' && p.dimensionKey === monthName && !p.category
  )
  if (monthPattern) {
    // Convert monthly to daily
    const dailyFromMonthly = monthPattern.averageAmount / 30
    const weight = monthPattern.confidenceScore * 0.25
    weightedSum += dailyFromMonthly * weight
    totalWeight += weight
    confidenceSum += monthPattern.confidenceScore
  }

  // Seasonal pattern
  const seasonPattern = patterns.find(
    p => p.patternType === 'seasonal' && p.dimensionKey === season && !p.category
  )
  if (seasonPattern) {
    const dailyFromSeasonal = seasonPattern.averageAmount / 30
    const weight = seasonPattern.confidenceScore * 0.2
    weightedSum += dailyFromSeasonal * weight
    totalWeight += weight
    confidenceSum += seasonPattern.confidenceScore
  }

  // Category-specific if requested
  if (category) {
    const categoryPattern = patterns.find(
      p => p.patternType === 'category_daily' && p.category === category
    )
    if (categoryPattern) {
      const weight = categoryPattern.confidenceScore * 0.4
      weightedSum += categoryPattern.averageAmount * weight
      totalWeight += weight
      confidenceSum += categoryPattern.confidenceScore
    }
  }

  const amount = totalWeight > 0 ? weightedSum / totalWeight : 0
  const confidence = totalWeight > 0 ? confidenceSum / (category ? 5 : 4) : 0

  return { amount, confidence }
}
