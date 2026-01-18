import { createClient } from '@/lib/supabase/server'
import { getApiUser } from '@/lib/supabase/api'
import { NextRequest, NextResponse } from 'next/server'

// Industry-standard income type detection keywords
const INCOME_KEYWORDS: Record<string, string[]> = {
  payroll: [
    'payroll', 'salary', 'wages', 'direct dep', 'dir dep', 'dd ', 'paycheck',
    'pay check', 'biweekly', 'bi-weekly', 'semi-monthly', 'employer',
    'ach credit', 'reg salary', 'net pay', 'gross pay'
  ],
  government: [
    'ssa ', 'ssi ', 'ssdi', 'social sec', 'irs treas', 'tax refund', 'tax ref',
    'unemployment', 'ui benefit', 'ebt', 'snap', 'tanf', 'wic ',
    'veterans', 'va benefit', 'disability', 'stimulus', 'economic impact'
  ],
  retirement: [
    'pension', 'retirement', '401k', '401(k)', 'ira dist', 'roth',
    'annuity', 'sep ira', 'simple ira', 'keogh', 'defined benefit'
  ],
  self_employment: [
    'stripe', 'square', 'paypal', 'invoice', 'client', 'freelance',
    'consulting', 'contract', 'gig', 'uber', 'lyft', 'doordash',
    'instacart', 'fiverr', 'upwork', 'etsy', 'shopify', 'merchant'
  ],
  investment: [
    'dividend', 'interest', 'capital gain', 'distribution', 'yield',
    'brokerage', 'fidelity', 'vanguard', 'schwab', 'ameritrade',
    'robinhood', 'stock', 'bond', 'mutual fund'
  ],
  rental: [
    'rent', 'tenant', 'lease', 'property', 'landlord', 'rental income',
    'airbnb', 'vrbo'
  ],
  refund: [
    'refund', 'return', 'cashback', 'cash back', 'rebate', 'credit',
    'reimburse', 'chargeback', 'reversal'
  ],
  transfer: [
    'venmo', 'zelle', 'transfer', 'xfer', 'from savings', 'from checking',
    'internal', 'p2p', 'person to person', 'mobile deposit'
  ]
}

// Detect income type from transaction name
function detectIncomeType(name: string): string {
  const nameLower = name.toLowerCase()

  // Check each income type's keywords
  for (const [type, keywords] of Object.entries(INCOME_KEYWORDS)) {
    for (const keyword of keywords) {
      if (nameLower.includes(keyword)) {
        return type
      }
    }
  }

  return 'other'
}

// Normalize merchant name for pattern matching
function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .slice(0, 4)
    .join(' ')
    .trim()
}

// Calculate next expected date based on frequency
function calculateNextDate(lastDate: string, frequency: string, payDay?: number): string {
  const last = new Date(lastDate)
  const next = new Date(last)

  switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7)
      break
    case 'bi-weekly':
      next.setDate(next.getDate() + 14)
      break
    case 'semi-monthly':
      // 1st and 15th, or 15th and last day
      if (last.getDate() <= 15) {
        next.setDate(15)
      } else {
        next.setMonth(next.getMonth() + 1)
        next.setDate(1)
      }
      break
    case 'monthly':
      next.setMonth(next.getMonth() + 1)
      if (payDay) {
        next.setDate(Math.min(payDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()))
      }
      break
    case 'quarterly':
      next.setMonth(next.getMonth() + 3)
      break
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1)
      break
  }

  return next.toISOString().split('T')[0]
}

// Helper to get monthly amount from frequency
function getMonthlyFromFrequency(amount: number, frequency: string): number {
  if (frequency === 'weekly') return amount * 4.33
  if (frequency === 'bi-weekly') return amount * 2.17
  if (frequency === 'semi-monthly') return amount * 2
  if (frequency === 'quarterly') return amount / 3
  if (frequency === 'yearly') return amount / 12
  if (frequency === 'irregular') return 0 // Don't project irregular income
  return amount // monthly
}

// GET - Fetch income sources and stats
export async function GET(request: NextRequest) {
  // Check for Bearer token first (mobile), then fall back to cookies (web)
  const authHeader = request.headers.get('authorization')

  let supabase
  let user

  if (authHeader?.startsWith('Bearer ')) {
    const result = await getApiUser(request)
    if (result.error || !result.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    supabase = result.supabase
    user = result.user
  } else {
    supabase = await createClient()
    const { data: { user: cookieUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !cookieUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    user = cookieUser
  }

  // Fetch income sources
  const { data: sources, error: sourcesError } = await supabase
    .from('income_sources')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('income_type', { ascending: true })
    .order('amount', { ascending: false })

  if (sourcesError) {
    console.error('Error fetching income sources:', sourcesError)
    return NextResponse.json({ error: 'Failed to fetch income sources' }, { status: 500 })
  }

  // Date calculations
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  // Start of this month
  const thisMonthStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0]
  // Start of last month (handles year boundary - December of previous year if in January)
  const lastMonthDate = new Date(currentYear, currentMonth - 1, 1)
  const lastMonthStart = lastMonthDate.toISOString().split('T')[0]
  // End of last month
  const lastMonthEnd = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]
  // Start of year
  const yearStart = new Date(currentYear, 0, 1).toISOString().split('T')[0]

  // Determine fetch start: need to include last month even if it's in previous year
  // and also start of year for YTD calculations
  const fetchStartDate = lastMonthDate < new Date(currentYear, 0, 1) ? lastMonthDate : new Date(currentYear, 0, 1)
  const fetchStart = fetchStartDate.toISOString().split('T')[0]

  // Get ALL transactions (including last month for comparison), then filter for income in JavaScript
  // This is more reliable than the .or() query which can have issues
  // Exclude transactions marked as ignore_type='all' (hidden from all reports)
  const { data: yearlyTransactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', fetchStart)
    .or('ignore_type.is.null,ignore_type.neq.all')
    .order('date', { ascending: false })

  // Legitimate income sources that should NOT be excluded even if they contain "transfer"
  const LEGITIMATE_INCOME_PATTERNS = [
    'stripe', 'square', 'paypal', 'shopify', 'etsy', 'amazon pay',
    'uber', 'lyft', 'doordash', 'instacart', 'grubhub', 'fiverr', 'upwork',
    'direct dep', 'payroll', 'salary', 'wages'
  ]

  // Patterns to exclude from income (transfers, refunds, internal movements)
  const EXCLUDE_PATTERNS = [
    'xfer to', 'xfer from', 'transfer to', 'transfer from',
    'internal transfer', 'from savings', 'from checking', 'to savings', 'to checking',
    'mobile deposit', 'atm deposit', 'cash deposit',
    'payment to', 'send money',
    'cashapp', 'cash app'
  ]

  const EXCLUDE_CATEGORIES = [
    'TRANSFER_OUT', 'TRANSFER_OUT_ACCOUNT_TRANSFER', 'TRANSFER_OUT_SAVINGS'
  ]

  // Check if transaction is a transfer that should be excluded
  const isTransferToExclude = (tx: { name?: string; display_name?: string; category?: string; category_detailed?: string; income_type?: string }) => {
    const txName = (tx.name || '').toLowerCase()
    const displayName = (tx.display_name || '').toLowerCase()
    const category = (tx.category || '').toUpperCase()
    const categoryDetailed = (tx.category_detailed || '').toUpperCase()
    const incomeType = (tx.income_type || '').toLowerCase()

    // FIRST: Check if this is a legitimate income source - if so, DON'T exclude
    if (LEGITIMATE_INCOME_PATTERNS.some(pattern => txName.includes(pattern) || displayName.includes(pattern))) {
      return false // This is legitimate income, don't exclude
    }

    // Check if marked as transfer type (user-set)
    if (incomeType === 'transfer') return true

    // Check category - only exclude OUTGOING transfers, not incoming
    if (EXCLUDE_CATEGORIES.some(cat => category.includes(cat) || categoryDetailed.includes(cat))) return true

    // Check name patterns - more specific patterns to avoid false positives
    if (EXCLUDE_PATTERNS.some(pattern => txName.includes(pattern))) return true

    return false
  }

  // Check if transaction is from a known legitimate income source
  const isLegitimateIncomeSource = (tx: { name?: string; display_name?: string }) => {
    const txName = (tx.name || '').toLowerCase()
    const displayName = (tx.display_name || '').toLowerCase()
    return LEGITIMATE_INCOME_PATTERNS.some(pattern =>
      txName.includes(pattern) || displayName.includes(pattern)
    )
  }

  // Filter for income transactions:
  // - Explicitly marked as income (is_income = true)
  // - OR negative amounts from legitimate income sources
  // - OR negative amounts that haven't been explicitly marked as NOT income
  // - EXCLUDING ignored transactions (respects user rules)
  // - EXCLUDING transfers and internal movements
  const allIncomeTxs = (yearlyTransactions || []).filter(tx => {
    // First, respect user's ignore rules - if ignored, exclude completely
    if (tx.ignored === true) return false

    // Exclude transfers (but legitimate income sources are whitelisted in isTransferToExclude)
    if (isTransferToExclude(tx)) return false

    // Explicitly marked as income - always include
    if (tx.is_income === true) return true

    // Convert amount to number (may be stored as string in some DBs)
    const amount = Number(tx.amount)

    // For legitimate income sources (Stripe, PayPal, etc.), include if negative amount
    // even if is_income is false (likely a sync issue or mistaken rule)
    if (isLegitimateIncomeSource(tx) && amount < 0) {
      return true
    }

    // For other transactions: respect is_income = false
    if (tx.is_income === false) return false

    // For transactions without explicit is_income flag (null/undefined):
    // Use heuristics to determine if it's income

    // Negative amount = money coming in (Plaid's default)
    if (amount < 0) return true

    // Check if it's a positive amount that looks like income based on keywords
    // This catches cases where Plaid uses inverted amounts
    if (amount > 0) {
      const txName = (tx.name || '').toLowerCase()
      const incomeKeywords = [
        'direct dep', 'payroll', 'salary', 'wages', 'ach credit',
        'deposit', 'ssi', 'ssa', 'social sec', 'pension', 'retirement',
        'dividend', 'interest paid'
      ]
      return incomeKeywords.some(keyword => txName.includes(keyword))
    }

    return false
  })

  // Filter income transactions by period
  const thisMonthIncome = allIncomeTxs.filter(tx => tx.date >= thisMonthStart)
  const lastMonthIncome = allIncomeTxs.filter(tx => tx.date >= lastMonthStart && tx.date <= lastMonthEnd)

  // Calculate actual income totals
  const actualThisMonth = thisMonthIncome.reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0)
  const actualLastMonth = lastMonthIncome.reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0)
  const actualMonthChange = actualLastMonth > 0
    ? Math.round(((actualThisMonth - actualLastMonth) / actualLastMonth) * 100)
    : 0

  // Calculate YTD total (only current year transactions)
  const currentYearIncome = allIncomeTxs.filter(tx => tx.date >= yearStart)
  const ytdTotal = currentYearIncome.reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0)

  // Build YTD by month data for chart
  const ytdByMonth: Array<{ month: string; year: number; amount: number }> = []
  for (let m = 0; m <= currentMonth; m++) {
    const monthStart = new Date(currentYear, m, 1)
    const monthEnd = new Date(currentYear, m + 1, 0)
    const monthStartStr = monthStart.toISOString().split('T')[0]
    const monthEndStr = monthEnd.toISOString().split('T')[0]

    const monthIncome = currentYearIncome
      .filter(tx => tx.date >= monthStartStr && tx.date <= monthEndStr)
      .reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0)

    ytdByMonth.push({
      month: monthStart.toLocaleDateString('en-US', { month: 'short' }),
      year: currentYear,
      amount: monthIncome
    })
  }

  // Calculate projected monthly from sources (excluding irregular)
  let projectedMonthly = 0
  const byType: Record<string, { count: number; actualThisMonth: number; projectedMonthly: number }> = {}

  for (const source of sources || []) {
    const monthlyAmount = getMonthlyFromFrequency(source.amount, source.frequency)
    projectedMonthly += monthlyAmount

    if (!byType[source.income_type]) {
      byType[source.income_type] = { count: 0, actualThisMonth: 0, projectedMonthly: 0 }
    }
    byType[source.income_type].count++
    byType[source.income_type].projectedMonthly += monthlyAmount
  }

  // Calculate actual by type from this month's transactions
  for (const tx of thisMonthIncome) {
    // Detect income type: use existing type, detect from name, or default to 'other'
    // Note: 'none' is treated as unset
    let incomeType = tx.income_type
    if (!incomeType || incomeType === 'none') {
      incomeType = detectIncomeType(tx.name || '') || 'other'
    }
    if (!byType[incomeType]) {
      byType[incomeType] = { count: 0, actualThisMonth: 0, projectedMonthly: 0 }
    }
    byType[incomeType].actualThisMonth += Math.abs(Number(tx.amount))
  }

  // Build upcoming payments list
  const upcomingPayments: Array<{
    sourceId: string
    name: string
    amount: number
    expectedDate: string
    daysUntil: number
    incomeType: string
  }> = []

  const today = now.toISOString().split('T')[0]
  for (const source of sources || []) {
    if (source.frequency === 'irregular') continue
    if (!source.next_expected_date || source.next_expected_date.startsWith('9999')) continue

    const nextDate = new Date(source.next_expected_date)
    const daysUntil = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    // Only show upcoming in next 30 days or recently passed (last 7 days)
    if (daysUntil >= -7 && daysUntil <= 30) {
      upcomingPayments.push({
        sourceId: source.id,
        name: source.display_name || source.name,
        amount: source.amount,
        expectedDate: source.next_expected_date,
        daysUntil,
        incomeType: source.income_type
      })
    }
  }

  // Sort by days until (soonest first)
  upcomingPayments.sort((a, b) => a.daysUntil - b.daysUntil)

  // Match recent income to sources for history
  const sourcesWithHistory = (sources || []).map(source => {
    const pattern = source.merchant_pattern.toLowerCase()
    const expectedAmount = source.amount

    const matchingTxs = allIncomeTxs.filter(tx => {
      const txKey = normalizeMerchant(tx.display_name || tx.merchant_name || tx.name)
      const patternMatch = txKey.includes(pattern) || pattern.includes(txKey)

      if (!patternMatch) return false

      const txAmount = Math.abs(tx.amount)
      const amountDiff = Math.abs(txAmount - expectedAmount) / expectedAmount
      const amountThreshold = source.frequency === 'irregular' ? 1.0 : 0.5

      return amountDiff <= amountThreshold
    })

    return {
      ...source,
      recentTransactions: matchingTxs.slice(0, 10)
    }
  })

  // Build stats object
  const stats = {
    // Actual income (from transactions)
    actualThisMonth,
    actualLastMonth,
    actualMonthChange,
    transactionCount: thisMonthIncome.length,

    // Projected income (from sources)
    projectedMonthly,
    projectedYearly: projectedMonthly * 12,

    // YTD
    ytdTotal,
    ytdByMonth,
    ytdAvgMonthly: currentMonth > 0 ? ytdTotal / (currentMonth + 1) : ytdTotal,

    // By type
    byType,

    // Legacy fields for backwards compatibility
    monthlyTotal: projectedMonthly,
    yearlyProjection: projectedMonthly * 12,
    sourceCount: sources?.length || 0
  }

  return NextResponse.json({
    sources: sourcesWithHistory,
    stats,
    recentIncome: allIncomeTxs.slice(0, 50),
    thisMonthIncome: thisMonthIncome,
    lastMonthIncome: lastMonthIncome,
    upcomingPayments
  })
}

// POST - Detect income patterns from transactions
export async function POST(request: NextRequest) {
  // Check for Bearer token first (mobile), then fall back to cookies (web)
  const authHeader = request.headers.get('authorization')

  let supabase
  let user

  if (authHeader?.startsWith('Bearer ')) {
    const result = await getApiUser(request)
    if (result.error || !result.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    supabase = result.supabase
    user = result.user
  } else {
    supabase = await createClient()
    const { data: { user: cookieUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !cookieUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    user = cookieUser
  }

  // Get all income transactions (negative amounts in Plaid)
  // Exclude transactions marked as ignore_type='all' (hidden from all reports)
  const { data: incomeTransactions, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .lt('amount', 0)
    .or('ignore_type.is.null,ignore_type.neq.all')
    .order('date', { ascending: false })

  if (txError) {
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }

  // Group by normalized merchant
  const grouped: Record<string, typeof incomeTransactions> = {}
  for (const tx of incomeTransactions || []) {
    const key = normalizeMerchant(tx.display_name || tx.merchant_name || tx.name)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(tx)
  }

  // Analyze each group for recurring patterns
  const detectedSources: Array<{
    name: string
    merchantPattern: string
    incomeType: string
    amount: number
    frequency: string
    occurrences: number
    lastDate: string
    confidence: string
  }> = []

  for (const [pattern, txs] of Object.entries(grouped)) {
    if (txs.length < 2) continue // Need at least 2 occurrences

    // Skip small amounts (likely not real income)
    const avgAmount = Math.abs(txs.reduce((sum, tx) => sum + tx.amount, 0) / txs.length)
    if (avgAmount < 50) continue

    // Detect income type
    const incomeType = detectIncomeType(txs[0].name)

    // Skip refunds and transfers - these aren't real recurring income
    if (incomeType === 'refund' || incomeType === 'transfer') continue

    // Analyze frequency
    const dates = txs.map(tx => new Date(tx.date).getTime()).sort((a, b) => b - a)
    const gaps: number[] = []
    for (let i = 0; i < dates.length - 1; i++) {
      gaps.push((dates[i] - dates[i + 1]) / (1000 * 60 * 60 * 24))
    }

    if (gaps.length === 0) continue

    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length
    let frequency = 'monthly'
    let confidence = 'medium'

    if (avgGap >= 5 && avgGap <= 9) {
      frequency = 'weekly'
      confidence = 'high'
    } else if (avgGap >= 12 && avgGap <= 17) {
      frequency = 'bi-weekly'
      confidence = 'high'
    } else if (avgGap >= 13 && avgGap <= 18) {
      frequency = 'semi-monthly'
      confidence = 'medium'
    } else if (avgGap >= 25 && avgGap <= 35) {
      frequency = 'monthly'
      confidence = 'high'
    } else if (avgGap >= 85 && avgGap <= 100) {
      frequency = 'quarterly'
      confidence = 'medium'
    } else if (avgGap >= 350 && avgGap <= 380) {
      frequency = 'yearly'
      confidence = 'medium'
    } else {
      confidence = 'low'
    }

    // Check amount consistency for higher confidence
    const amounts = txs.map(tx => Math.abs(tx.amount))
    const amountVariance = Math.max(...amounts) - Math.min(...amounts)
    const amountConsistency = amountVariance / avgAmount

    if (amountConsistency < 0.05) {
      confidence = 'high' // Very consistent amounts
    } else if (amountConsistency > 0.3) {
      confidence = 'low' // Highly variable amounts
    }

    detectedSources.push({
      name: txs[0].display_name || txs[0].merchant_name || txs[0].name,
      merchantPattern: pattern,
      incomeType,
      amount: avgAmount,
      frequency,
      occurrences: txs.length,
      lastDate: txs[0].date,
      confidence
    })
  }

  // Sort by confidence and amount
  detectedSources.sort((a, b) => {
    const confOrder = { high: 0, medium: 1, low: 2 }
    const confDiff = confOrder[a.confidence as keyof typeof confOrder] - confOrder[b.confidence as keyof typeof confOrder]
    if (confDiff !== 0) return confDiff
    return b.amount - a.amount
  })

  return NextResponse.json({
    detected: detectedSources,
    count: detectedSources.length
  })
}

// PUT - Add or update an income source
export async function PUT(request: NextRequest) {
  // Check for Bearer token first (mobile), then fall back to cookies (web)
  const authHeader = request.headers.get('authorization')

  let supabase
  let user

  if (authHeader?.startsWith('Bearer ')) {
    const result = await getApiUser(request)
    if (result.error || !result.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    supabase = result.supabase
    user = result.user
  } else {
    supabase = await createClient()
    const { data: { user: cookieUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !cookieUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    user = cookieUser
  }

  const body = await request.json()
  const {
    name,
    incomeType,
    amount,
    frequency,
    employerName,
    payDay,
    originalName, // Original transaction name for pattern matching
    accountId,
    notes
  } = body

  if (!name || !incomeType || !amount || !frequency) {
    return NextResponse.json({
      error: 'name, incomeType, amount, and frequency are required'
    }, { status: 400 })
  }

  const validTypes = ['payroll', 'government', 'retirement', 'self_employment', 'investment', 'rental', 'other']
  if (!validTypes.includes(incomeType)) {
    return NextResponse.json({ error: 'Invalid income type' }, { status: 400 })
  }

  const validFrequencies = ['weekly', 'bi-weekly', 'semi-monthly', 'monthly', 'quarterly', 'yearly', 'irregular']
  if (!validFrequencies.includes(frequency)) {
    return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 })
  }

  // Create merchant pattern - use more of the name for specific matching
  let merchantPattern: string
  if (originalName) {
    merchantPattern = originalName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .slice(0, 6)
      .join(' ')
      .trim()
  } else {
    merchantPattern = normalizeMerchant(name)
  }

  const today = new Date().toISOString().split('T')[0]

  // Find the most recent matching transaction to get actual last received date
  // Exclude ignored transactions
  const { data: recentTxs } = await supabase
    .from('transactions')
    .select('date, amount')
    .eq('user_id', user.id)
    .lt('amount', 0) // Income is negative in Plaid
    .or('ignore_type.is.null,ignore_type.neq.all')
    .order('date', { ascending: false })
    .limit(100)

  // Find transactions matching this income source (by amount similarity)
  const expectedAmount = Math.abs(amount)
  const matchingTxs = (recentTxs || []).filter(tx => {
    const txAmount = Math.abs(tx.amount)
    const amountDiff = Math.abs(txAmount - expectedAmount) / expectedAmount
    return amountDiff <= 0.3 // Within 30% of expected amount
  })

  // Use the most recent matching transaction's date, or today if none found
  const lastReceivedDate = matchingTxs.length > 0 ? matchingTxs[0].date : today
  const firstSeenDate = matchingTxs.length > 0 ? matchingTxs[matchingTxs.length - 1].date : today
  const occurrences = matchingTxs.length || 1
  const totalReceived = matchingTxs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) || Math.abs(amount)
  const averageAmount = matchingTxs.length > 0 ? totalReceived / matchingTxs.length : Math.abs(amount)

  // Irregular income doesn't have a predictable next date - use far future date
  const nextDate = frequency === 'irregular' ? '9999-12-31' : calculateNextDate(lastReceivedDate, frequency, payDay)

  const sourceData = {
    user_id: user.id,
    name,
    display_name: name,
    income_type: incomeType,
    merchant_pattern: merchantPattern,
    amount: Math.abs(amount),
    average_amount: averageAmount,
    frequency,
    pay_day: payDay || null,
    next_expected_date: nextDate,
    last_received_date: lastReceivedDate,
    first_seen_date: firstSeenDate,
    employer_name: employerName || null,
    account_id: accountId || null,
    notes: notes || null,
    occurrences,
    total_received: totalReceived,
    confidence: 'high',
    is_active: true,
    is_verified: true,
    ai_detected: false
  }

  const { data, error } = await supabase
    .from('income_sources')
    .upsert(sourceData, { onConflict: 'user_id,merchant_pattern' })
    .select()

  if (error) {
    console.error('Error adding income source:', error)
    return NextResponse.json({ error: 'Failed to add income source', details: error.message }, { status: 500 })
  }

  // Update matching transactions with income_type
  await supabase
    .from('transactions')
    .update({ income_type: incomeType, is_income: true })
    .eq('user_id', user.id)
    .lt('amount', 0)
    .ilike('name', `%${merchantPattern.split(' ').slice(0, 3).join('%')}%`)

  return NextResponse.json({ success: true, source: data?.[0] })
}

// PATCH - Update an income source
export async function PATCH(request: NextRequest) {
  // Check for Bearer token first (mobile), then fall back to cookies (web)
  const authHeader = request.headers.get('authorization')

  let supabase
  let user

  if (authHeader?.startsWith('Bearer ')) {
    const result = await getApiUser(request)
    if (result.error || !result.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    supabase = result.supabase
    user = result.user
  } else {
    supabase = await createClient()
    const { data: { user: cookieUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !cookieUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    user = cookieUser
  }

  let body
  try {
    body = await request.json()
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { id, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // First verify the income source exists and belongs to user
  const { data: existingSource, error: fetchError } = await supabase
    .from('income_sources')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !existingSource) {
    console.error('Income source not found:', fetchError)
    return NextResponse.json({ error: 'Income source not found' }, { status: 404 })
  }

  const allowedUpdates: Record<string, unknown> = {}

  if (updates.name) allowedUpdates.name = updates.name
  if (updates.display_name) allowedUpdates.display_name = updates.display_name
  if (updates.income_type) allowedUpdates.income_type = updates.income_type
  if (updates.amount !== undefined) {
    allowedUpdates.amount = Math.abs(updates.amount)
    allowedUpdates.average_amount = Math.abs(updates.amount)
  }
  if (updates.frequency) {
    allowedUpdates.frequency = updates.frequency

    // Irregular frequency has no next date - set far future date instead of null
    // to avoid potential null handling issues
    if (updates.frequency === 'irregular') {
      // Use a very far future date as "no scheduled date"
      allowedUpdates.next_expected_date = '9999-12-31'
    } else {
      // Recalculate next date for regular frequencies
      if (existingSource.last_received_date) {
        allowedUpdates.next_expected_date = calculateNextDate(
          existingSource.last_received_date,
          updates.frequency,
          existingSource.pay_day
        )
      }
    }
  }
  if (updates.employer_name !== undefined) allowedUpdates.employer_name = updates.employer_name
  if (updates.pay_day !== undefined) allowedUpdates.pay_day = updates.pay_day
  if (updates.notes !== undefined) allowedUpdates.notes = updates.notes
  if (updates.is_active !== undefined) allowedUpdates.is_active = updates.is_active

  if (Object.keys(allowedUpdates).length === 0) {
    return NextResponse.json({ error: 'No valid updates' }, { status: 400 })
  }

  console.log('Updating income source:', id, 'with:', allowedUpdates)

  const { data, error } = await supabase
    .from('income_sources')
    .update(allowedUpdates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()

  if (error) {
    console.error('Error updating income source:', error)
    return NextResponse.json({
      error: 'Failed to update',
      details: error.message,
      code: error.code,
      hint: error.hint
    }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Update returned no data' }, { status: 500 })
  }

  return NextResponse.json({ success: true, source: data[0] })
}

// DELETE - Remove an income source
export async function DELETE(request: NextRequest) {
  // Check for Bearer token first (mobile), then fall back to cookies (web)
  const authHeader = request.headers.get('authorization')

  let supabase
  let user

  if (authHeader?.startsWith('Bearer ')) {
    const result = await getApiUser(request)
    if (result.error || !result.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    supabase = result.supabase
    user = result.user
  } else {
    supabase = await createClient()
    const { data: { user: cookieUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !cookieUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    user = cookieUser
  }

  const { id } = await request.json()

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // Get the source first to update related transactions
  const { data: source } = await supabase
    .from('income_sources')
    .select('merchant_pattern')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  // Delete the source
  const { error } = await supabase
    .from('income_sources')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }

  // Reset income_type on matching transactions
  if (source?.merchant_pattern) {
    await supabase
      .from('transactions')
      .update({ income_type: 'none', is_income: false })
      .eq('user_id', user.id)
      .ilike('name', `%${source.merchant_pattern.split(' ').slice(0, 3).join('%')}%`)
  }

  return NextResponse.json({ success: true })
}
