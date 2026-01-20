import { createClient } from '@/lib/supabase/server'
import { getApiUser } from '@/lib/supabase/api'
import { NextRequest, NextResponse } from 'next/server'
import { getUserSubscription, canAccessFeature } from '@/lib/subscription'
import { anthropic } from '@/lib/ai'
import { checkAndIncrementUsage, rateLimitResponse } from '@/lib/ai-usage'
import { cacheGet, cacheSet, cacheDelete, CACHE_KEYS, CACHE_TTL } from '@/lib/cache'

interface CachedRecurringAnalysis {
  recurring: Array<{
    id: string
    name: string
    display_name: string
    amount: number
    frequency: string
    is_income: boolean
    next_expected_date: string | null
    category: string | null
    confidence: string | null
    bill_type: string | null
    averageAmount?: number
    lastSeenDate?: string
    occurrences?: number
    transactionIds?: string[]
  }>
  yearlySpend: number
  count: number
  aiPowered: boolean
  lastAnalysis: string | null
  cachedAt: string
  expiresAt: string
}

const AI_RECURRING_PROMPT = `You are a financial analyst detecting recurring BILLS and SUBSCRIPTIONS.

## INCLUDE (True Bills):
- Subscriptions (Netflix, Spotify, gym, software)
- Utilities (electric, water, gas, internet, phone)
- Loan payments (car, mortgage, personal loans)
- Insurance (auto, home, health, life)
- Rent/Mortgage
- Credit card auto-payments
- Paychecks (regular income)

## EXCLUDE (Shopping - NOT Bills):
- Gas stations, Grocery stores (Walmart, Target, Costco, Aldi, Kroger, Braum's)
- Restaurants, Fast food, Coffee shops
- General retail (Amazon unless Prime subscription), convenience stores

A BILL is something you OWE. Frequent shopping is discretionary spending.

Return JSON array only:
[{"name":"Netflix","displayName":"Netflix","frequency":"monthly","amount":15.99,"averageAmount":15.99,"isIncome":false,"confidence":"high","category":"ENTERTAINMENT","billType":"subscription"}]

Confidence: "high", "medium", "low". Only include high/medium confidence. Be CONSERVATIVE.`

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

interface RecurringPattern {
  id: string
  name: string
  display_name: string
  merchant_pattern: string | null
  frequency: string
  amount: number
  average_amount: number
  is_income: boolean
  typical_day: number | null
  next_expected_date: string | null
  last_seen_date: string | null
  category: string | null
  confidence: string | null
  occurrences: number
  bill_type: string | null
  ai_detected: boolean
  transaction_ids: string[]
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

// Normalize merchant name for consistent matching
function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .slice(0, 3)
    .join(' ')
    .trim()
}

interface TransactionRule {
  match_pattern: string
  match_field: string
  display_name: string | null
  set_category: string | null
  is_active: boolean
}

// Apply transaction rules to get the correct display name and category
function applyRules(
  originalName: string,
  originalCategory: string | null,
  rules: TransactionRule[]
): { displayName: string; category: string | null } {
  let displayName = originalName
  let category = originalCategory

  for (const rule of rules) {
    if (!rule.is_active) continue

    const pattern = rule.match_pattern.toLowerCase()
    const name = originalName.toLowerCase()

    if (name.includes(pattern)) {
      if (rule.display_name) displayName = rule.display_name
      if (rule.set_category) category = rule.set_category
      break // First matching rule wins
    }
  }

  return { displayName, category }
}

// Convert database pattern to API response format
function patternToRecurring(
  pattern: RecurringPattern,
  transactions: Transaction[],
  rules: TransactionRule[] = []
): RecurringTransaction {
  // Match transactions using multiple strategies
  const patternLower = (pattern.merchant_pattern || '').toLowerCase()
  const patternName = (pattern.name || '').toLowerCase()
  const patternDisplay = (pattern.display_name || '').toLowerCase()

  // For manually added patterns, use stricter matching
  const isManualPattern = !pattern.ai_detected

  const matchingTxs = transactions.filter(tx => {
    // For income patterns, only match income transactions
    if (pattern.is_income && tx.amount > 0) return false
    // For expense patterns, only match expense transactions
    if (!pattern.is_income && tx.amount < 0) return false

    const txName = (tx.name || '').toLowerCase()
    const txMerchant = (tx.merchant_name || '').toLowerCase()
    const txDisplay = (tx.display_name || '').toLowerCase()
    const txNormalized = normalizeMerchant(tx.display_name || tx.merchant_name || tx.name)

    // For manual patterns, use stricter matching (exact or very close)
    if (isManualPattern) {
      return (
        txNormalized === patternLower ||
        txDisplay === patternDisplay ||
        txName.includes(patternDisplay) ||
        txMerchant.includes(patternDisplay)
      )
    }

    // For AI-detected patterns, use broader matching
    return (
      // Exact normalized match
      txNormalized === patternLower ||
      // Pattern contains check
      txNormalized.includes(patternLower) ||
      patternLower.includes(txNormalized) ||
      // Original name contains pattern
      txName.includes(patternLower) ||
      txMerchant.includes(patternLower) ||
      txDisplay.includes(patternLower) ||
      // Pattern name/display matches
      txName.includes(patternName) ||
      txMerchant.includes(patternName) ||
      txName.includes(patternDisplay) ||
      txMerchant.includes(patternDisplay)
    )
  })

  // Apply transaction rules to get correct display name and category
  // If we have matched transactions, prefer their display_name (which has rules applied)
  let displayName = pattern.display_name || pattern.name
  let category = pattern.category

  if (matchingTxs.length > 0) {
    // Use the first matched transaction's display_name if it exists (rules are applied to transactions)
    const firstTx = matchingTxs[0]
    if (firstTx.display_name) {
      displayName = firstTx.display_name
    }
    // Also use transaction category if pattern doesn't have one
    if (!category && firstTx.category) {
      category = firstTx.category
    }
  } else {
    // Fall back to applying rules to the pattern name
    const applied = applyRules(pattern.display_name || pattern.name, pattern.category, rules)
    displayName = applied.displayName
    category = applied.category
  }

  // Use actual matched count, not stored occurrences
  const actualOccurrences = matchingTxs.length > 0 ? matchingTxs.length : pattern.occurrences

  // Detect if transactions are actually income (negative amounts in Plaid = deposits)
  // For manually added patterns (ai_detected = false), always trust the stored is_income value
  // For AI-detected patterns, recalculate based on transaction amounts
  let isActuallyIncome = pattern.is_income
  if (pattern.ai_detected && matchingTxs.length > 0) {
    const incomeCount = matchingTxs.filter(tx => tx.amount < 0).length
    isActuallyIncome = incomeCount > matchingTxs.length / 2
  }

  // Calculate actual average from matched transactions if available
  const actualAverage = matchingTxs.length > 0
    ? matchingTxs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) / matchingTxs.length
    : Number(pattern.average_amount)

  // Calculate the actual next date - advance if stored date is in the past
  let nextDate = pattern.next_expected_date || new Date().toISOString().split('T')[0]
  let lastDate = pattern.last_seen_date || new Date().toISOString().split('T')[0]

  // If we have matching transactions, use the most recent one as the last date
  if (matchingTxs.length > 0) {
    const sortedTxs = [...matchingTxs].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    lastDate = sortedTxs[0].date
  }

  // Advance nextDate if it's in the past
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let nextDateObj = new Date(nextDate)

  // If the stored next date is in the past, recalculate from the last transaction date
  if (nextDateObj < today) {
    nextDateObj = new Date(lastDate)

    // Keep advancing until we're in the future
    while (nextDateObj < today) {
      if (pattern.frequency === 'weekly') {
        nextDateObj.setDate(nextDateObj.getDate() + 7)
      } else if (pattern.frequency === 'bi-weekly') {
        nextDateObj.setDate(nextDateObj.getDate() + 14)
      } else if (pattern.frequency === 'monthly') {
        nextDateObj.setMonth(nextDateObj.getMonth() + 1)
      } else if (pattern.frequency === 'quarterly') {
        nextDateObj.setMonth(nextDateObj.getMonth() + 3)
      } else if (pattern.frequency === 'yearly') {
        nextDateObj.setFullYear(nextDateObj.getFullYear() + 1)
      } else {
        // Default to monthly
        nextDateObj.setMonth(nextDateObj.getMonth() + 1)
      }
    }

    nextDate = nextDateObj.toISOString().split('T')[0]
  }

  return {
    id: pattern.id,
    name: pattern.name,
    displayName,
    amount: Number(pattern.amount),
    averageAmount: actualAverage,
    frequency: pattern.frequency as RecurringTransaction['frequency'],
    nextDate,
    lastDate,
    category,
    accountId: matchingTxs[0]?.plaid_account_id || '',
    isIncome: isActuallyIncome,
    confidence: (pattern.confidence || 'medium') as RecurringTransaction['confidence'],
    occurrences: actualOccurrences,
    transactions: matchingTxs,
  }
}

// Check if a key matches any dismissed pattern (lenient matching)
function isDismissed(key: string, dismissedPatterns: string[]): boolean {
  const keyLower = key.toLowerCase()
  for (const pattern of dismissedPatterns) {
    const patternLower = pattern.toLowerCase()
    // Check if the key contains the dismissed pattern or vice versa
    if (keyLower.includes(patternLower) || patternLower.includes(keyLower)) {
      return true
    }
    // Also check if first two words match (common for merchant variants)
    const keyWords = keyLower.split(' ')
    const patternWords = patternLower.split(' ')
    if (keyWords.length >= 2 && patternWords.length >= 2 &&
        keyWords[0] === patternWords[0] && keyWords[1] === patternWords[1]) {
      return true
    }
  }
  return false
}

// Basic pattern detection (fallback when no AI cache)
function analyzeRecurringPatterns(transactions: Transaction[], dismissedPatterns: string[]): RecurringTransaction[] {
  const groups = new Map<string, Transaction[]>()

  for (const tx of transactions) {
    const key = normalizeMerchant(tx.display_name || tx.merchant_name || tx.name)
    if (!key || isDismissed(key, dismissedPatterns)) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(tx)
  }

  const recurring: RecurringTransaction[] = []

  for (const [key, txs] of groups) {
    // Require at least 3 occurrences to avoid false positives from one-off purchases
    if (txs.length < 3) continue

    const sorted = [...txs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const intervals: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].date)
      const curr = new Date(sorted[i].date)
      intervals.push(Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)))
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
    const amounts = txs.map(t => Math.abs(t.amount))
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const amountStdDev = Math.sqrt(amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / amounts.length)
    const amountConsistent = amountStdDev / avgAmount < 0.2
    const intervalStdDev = Math.sqrt(intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length)
    const intervalConsistent = intervalStdDev < 10

    let frequency: RecurringTransaction['frequency'] | null = null
    if (avgInterval <= 10) frequency = 'weekly'
    else if (avgInterval <= 20) frequency = 'bi-weekly'
    else if (avgInterval <= 40) frequency = 'monthly'
    else if (avgInterval <= 100) frequency = 'quarterly'
    else if (avgInterval <= 400) frequency = 'yearly'

    if (!frequency) continue

    let confidence: 'high' | 'medium' | 'low' = 'low'
    if (amountConsistent && intervalConsistent && txs.length >= 4) confidence = 'high'
    else if ((amountConsistent || intervalConsistent) && txs.length >= 4) confidence = 'medium'
    else if (amountConsistent && intervalConsistent && txs.length >= 3) confidence = 'medium'
    else if (txs.length >= 5) confidence = 'medium'

    // Only show medium or high confidence patterns to avoid false positives
    // Low confidence patterns require explicit user confirmation via AI analysis
    if (confidence === 'low') continue

    const lastTx = sorted[sorted.length - 1]
    const [year, month, day] = lastTx.date.split('-').map(Number)
    const lastDate = new Date(year, month - 1, day)
    const nextDate = new Date(lastDate)

    // Use calendar-based increments for predictable dates
    if (frequency === 'weekly') {
      nextDate.setDate(nextDate.getDate() + 7)
    } else if (frequency === 'bi-weekly') {
      nextDate.setDate(nextDate.getDate() + 14)
    } else if (frequency === 'monthly') {
      nextDate.setMonth(nextDate.getMonth() + 1)
    } else if (frequency === 'quarterly') {
      nextDate.setMonth(nextDate.getMonth() + 3)
    } else if (frequency === 'yearly') {
      nextDate.setFullYear(nextDate.getFullYear() + 1)
    }

    const firstTx = sorted[0]
    const displayName = firstTx.display_name || firstTx.merchant_name || firstTx.name
    const nextDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`

    recurring.push({
      id: firstTx.id,
      name: firstTx.name,
      displayName,
      amount: lastTx.amount,
      averageAmount: avgAmount,
      frequency,
      nextDate: nextDateStr,
      lastDate: lastTx.date,
      category: firstTx.category,
      accountId: firstTx.plaid_account_id,
      isIncome: firstTx.is_income || lastTx.amount < 0,
      confidence,
      occurrences: txs.length,
      transactions: sorted,
    })
  }

  recurring.sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime())
  return recurring
}

// GET - Load recurring patterns (from cache or basic detection)
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

  // Get dismissed patterns
  const { data: dismissals } = await supabase
    .from('recurring_dismissals')
    .select('merchant_pattern')
    .eq('user_id', user.id)

  const dismissedPatterns = (dismissals || []).map(d => d.merchant_pattern)

  // Get transaction rules for applying display names and categories
  const { data: rules } = await supabase
    .from('transaction_rules')
    .select('match_pattern, match_field, display_name, set_category, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('priority', { ascending: false })

  const transactionRules: TransactionRule[] = (rules || []).map(r => ({
    match_pattern: r.match_pattern,
    match_field: r.match_field,
    display_name: r.display_name,
    set_category: r.set_category,
    is_active: r.is_active,
  }))

  // Check for cached AI patterns
  const { data: cachedPatterns } = await supabase
    .from('recurring_patterns')
    .select('*')
    .eq('user_id', user.id)

  // Get transactions for display (exclude ignored transactions)
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', twelveMonthsAgo.toISOString().split('T')[0])
    .or('ignore_type.is.null,ignore_type.neq.all')
    .order('date', { ascending: false })

  let recurring: RecurringTransaction[]
  let aiPowered = false
  let lastAnalysis: string | null = null

  if (cachedPatterns && cachedPatterns.length > 0) {
    // Use cached AI results, filtering out dismissed ones (using lenient matching)
    // Apply transaction rules for display names and categories
    console.log('[recurring] Using cached patterns:', cachedPatterns.length, 'total,', dismissedPatterns.length, 'dismissed')
    recurring = cachedPatterns
      .filter(p => !isDismissed(p.merchant_pattern || '', dismissedPatterns))
      .map(p => patternToRecurring(p, transactions || [], transactionRules))

    aiPowered = cachedPatterns.some(p => p.ai_detected)
    lastAnalysis = cachedPatterns[0]?.last_ai_analysis || null
  } else {
    // Fall back to basic detection
    console.log('[recurring] No cached patterns, using basic detection. Dismissed patterns:', dismissedPatterns)
    recurring = analyzeRecurringPatterns(transactions || [], dismissedPatterns)
    console.log('[recurring] Basic detection found:', recurring.length, 'patterns')
  }

  // Also fetch from income_patterns table and merge as income items
  const { data: incomePatterns } = await supabase
    .from('income_patterns')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (incomePatterns && incomePatterns.length > 0) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (const income of incomePatterns) {
      // Only include high-confidence patterns that look like actual income (not shopping)
      if (income.confidence_score < 0.7) continue
      if (income.source_type === 'other' && income.average_amount < 500) continue // Skip low-value "other" patterns

      // Check if this income is already in recurring (by name similarity)
      const alreadyExists = recurring.some(r =>
        r.isIncome &&
        (r.name.toLowerCase().includes(income.source_name.toLowerCase()) ||
         income.source_name.toLowerCase().includes(r.name.toLowerCase()))
      )
      if (alreadyExists) continue

      // Advance next_expected to future if it's in the past
      let nextDate = income.next_expected || new Date().toISOString().split('T')[0]
      let nextDateObj = new Date(nextDate)

      if (nextDateObj < today) {
        // Advance to next occurrence based on frequency
        const lastDate = new Date(income.last_occurrence || nextDate)
        nextDateObj = new Date(lastDate)

        while (nextDateObj < today) {
          if (income.frequency === 'weekly') {
            nextDateObj.setDate(nextDateObj.getDate() + 7)
          } else if (income.frequency === 'bi-weekly') {
            nextDateObj.setDate(nextDateObj.getDate() + 14)
          } else if (income.frequency === 'monthly') {
            nextDateObj.setMonth(nextDateObj.getMonth() + 1)
          } else if (income.frequency === 'quarterly') {
            nextDateObj.setMonth(nextDateObj.getMonth() + 3)
          } else if (income.frequency === 'yearly') {
            nextDateObj.setFullYear(nextDateObj.getFullYear() + 1)
          } else {
            nextDateObj.setMonth(nextDateObj.getMonth() + 1)
          }
        }
        nextDate = nextDateObj.toISOString().split('T')[0]
      }

      recurring.push({
        id: `income-${income.id}`,
        name: income.source_name,
        displayName: income.source_name,
        amount: Number(income.average_amount),
        averageAmount: Number(income.average_amount),
        frequency: income.frequency as RecurringTransaction['frequency'],
        nextDate,
        lastDate: income.last_occurrence || nextDate,
        category: 'Income',
        accountId: '',
        isIncome: true,
        confidence: income.confidence_score >= 0.8 ? 'high' : 'medium',
        occurrences: income.occurrences_analyzed || 3,
        transactions: [],
      })
    }

    console.log('[recurring] Added', incomePatterns.length, 'income patterns from income_patterns table')
  }

  // Final filter: ensure minimum 3 occurrences for all patterns (safety check)
  recurring = recurring.filter(r => r.occurrences >= 3)
  console.log('[recurring] After occurrence filter:', recurring.length, 'patterns')

  // Calculate yearly spend
  const yearlySpend = recurring
    .filter(r => !r.isIncome && r.amount > 0)
    .reduce((sum, r) => {
      let multiplier = 12
      if (r.frequency === 'weekly') multiplier = 52
      else if (r.frequency === 'bi-weekly') multiplier = 26
      else if (r.frequency === 'quarterly') multiplier = 4
      else if (r.frequency === 'yearly') multiplier = 1
      return sum + (r.averageAmount * multiplier)
    }, 0)

  // Get pending suggestions count
  const { count: pendingSuggestions } = await supabase
    .from('recurring_suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'pending')

  return NextResponse.json({
    recurring,
    yearlySpend,
    count: recurring.length,
    aiPowered,
    lastAnalysis,
    hasCachedResults: cachedPatterns && cachedPatterns.length > 0,
    pendingSuggestions: pendingSuggestions || 0,
  })
}

// POST - Re-analyze with AI (explicit user action)
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

  // Parse request body for force parameter
  let forceRefresh = false
  try {
    const body = await request.json()
    forceRefresh = body.force === true
  } catch {
    // No body or invalid JSON - default to not forcing
  }

  // Check subscription (pass supabase client for mobile auth)
  const subscription = await getUserSubscription(user.id, supabase)
  const isPro = canAccessFeature(subscription, 'ai_suggestions')

  if (!isPro) {
    return NextResponse.json({
      error: 'upgrade_required',
      message: 'AI Recurring Detection requires a Pro subscription'
    }, { status: 403 })
  }

  // =========================================================================
  // CHECK CACHE FOR RECURRING ANALYSIS (Optimization #4)
  // =========================================================================
  const cacheKey = CACHE_KEYS.recurringDetection(user.id)

  if (!forceRefresh) {
    const cached = await cacheGet<CachedRecurringAnalysis>(cacheKey)
    if (cached) {
      // Get current pending suggestions count (might have changed)
      const { count: pendingSuggestions } = await supabase
        .from('recurring_suggestions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending')

      return NextResponse.json({
        ...cached,
        pendingSuggestions: pendingSuggestions || 0,
        fromCache: true,
      })
    }
  }

  // Check rate limits (only if we're actually going to call AI)
  const usageCheck = await checkAndIncrementUsage(supabase, user.id, 'recurring_detection', isPro)
  if (!usageCheck.allowed) {
    return NextResponse.json(
      rateLimitResponse('recurring detection', usageCheck.limit, isPro),
      { status: 429 }
    )
  }

  // Get dismissed patterns to exclude from analysis
  const { data: dismissals } = await supabase
    .from('recurring_dismissals')
    .select('merchant_pattern')
    .eq('user_id', user.id)

  const dismissedPatterns = (dismissals || []).map(d => d.merchant_pattern)

  // Get transactions
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('id, name, merchant_name, display_name, amount, date, category, is_income, plaid_account_id')
    .eq('user_id', user.id)
    .gte('date', sixMonthsAgo.toISOString().split('T')[0])
    .or('ignore_type.is.null,ignore_type.neq.all')
    .order('date', { ascending: false })
    .limit(500)

  if (error || !transactions || transactions.length < 10) {
    return NextResponse.json({
      error: 'Not enough transaction history for AI analysis',
      recurring: []
    })
  }

  // Group transactions by merchant for summarized input (saves tokens!)
  const merchantGroups = new Map<string, {
    name: string
    count: number
    amounts: number[]
    dates: string[]
    category: string | null
    isIncome: boolean
  }>()

  for (const tx of transactions) {
    const name = tx.display_name || tx.merchant_name || tx.name
    const key = normalizeMerchant(name)

    if (dismissedPatterns.includes(key)) continue

    if (!merchantGroups.has(key)) {
      merchantGroups.set(key, {
        name,
        count: 0,
        amounts: [],
        dates: [],
        category: tx.category,
        isIncome: tx.is_income || tx.amount < 0,
      })
    }
    const group = merchantGroups.get(key)!
    group.count++
    group.amounts.push(tx.amount)
    group.dates.push(tx.date)
  }

  // Only send merchants with 2+ transactions (potential recurring)
  const summarizedData = Array.from(merchantGroups.entries())
    .filter(([, g]) => g.count >= 2)
    .map(([key, g]) => ({
      merchant: g.name,
      key,
      count: g.count,
      avgAmount: (g.amounts.reduce((a, b) => a + b, 0) / g.amounts.length).toFixed(2),
      minAmount: Math.min(...g.amounts).toFixed(2),
      maxAmount: Math.max(...g.amounts).toFixed(2),
      dates: g.dates.slice(0, 5), // First 5 dates
      category: g.category,
      isIncome: g.isIncome,
    }))

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Analyze these ${summarizedData.length} merchants with 2+ transactions. Identify ONLY true recurring bills/subscriptions:\n\n${JSON.stringify(summarizedData, null, 2)}`
      }],
      system: AI_RECURRING_PROMPT,
    })

    const responseText = response.content[0].type === 'text' ? response.content[0].text : ''

    // Parse AI response
    let aiRecurring: Array<{
      name: string
      displayName?: string
      frequency: string
      amount: number
      averageAmount?: number
      isIncome?: boolean
      confidence: string
      category?: string
      billType?: string
    }> = []

    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        aiRecurring = JSON.parse(jsonMatch[0])
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError)
      return NextResponse.json({ error: 'Failed to parse AI analysis', recurring: [] })
    }

    // Save AI detections to suggestions table for user review (NOT directly to patterns)
    const now = new Date().toISOString()

    // Get existing patterns to avoid re-suggesting what's already confirmed
    const { data: existingPatterns } = await supabase
      .from('recurring_patterns')
      .select('merchant_pattern')
      .eq('user_id', user.id)
    const existingMerchants = new Set((existingPatterns || []).map(p => p.merchant_pattern))

    let newSuggestions = 0

    for (const item of aiRecurring) {
      const merchantKey = normalizeMerchant(item.name)
      const group = merchantGroups.get(merchantKey)

      // Skip if already dismissed or already a confirmed pattern
      if (dismissedPatterns.includes(merchantKey)) continue
      if (existingMerchants.has(merchantKey)) continue

      // Calculate next date using proper calendar increments
      const lastDate = group?.dates[0] ? new Date(group.dates[0]) : new Date()
      const nextDate = new Date(lastDate)

      if (item.frequency === 'weekly') {
        nextDate.setDate(nextDate.getDate() + 7)
      } else if (item.frequency === 'bi-weekly') {
        nextDate.setDate(nextDate.getDate() + 14)
      } else if (item.frequency === 'monthly') {
        nextDate.setMonth(nextDate.getMonth() + 1)
      } else if (item.frequency === 'quarterly') {
        nextDate.setMonth(nextDate.getMonth() + 3)
      } else if (item.frequency === 'yearly') {
        nextDate.setFullYear(nextDate.getFullYear() + 1)
      } else {
        // Default to monthly
        nextDate.setMonth(nextDate.getMonth() + 1)
      }

      // Save to suggestions table for user review
      const { error: suggestionError } = await supabase.from('recurring_suggestions').upsert({
        user_id: user.id,
        name: item.name,
        display_name: item.displayName || item.name,
        merchant_pattern: merchantKey,
        frequency: item.frequency,
        amount: item.amount,
        average_amount: item.averageAmount || item.amount,
        is_income: item.isIncome || false,
        next_expected_date: nextDate.toISOString().split('T')[0],
        last_seen_date: group?.dates[0] || null,
        category: item.category || group?.category || null,
        confidence: item.confidence,
        occurrences: group?.count || 0,
        bill_type: item.billType || null,
        detection_reason: `AI detected ${group?.count || 0} transactions with ${item.confidence} confidence`,
        status: 'pending',
      }, { onConflict: 'user_id,merchant_pattern' })

      if (!suggestionError) {
        newSuggestions++
      }
    }

    // Fetch ALL patterns from database (includes both AI and basic detection)
    const { data: allPatterns } = await supabase
      .from('recurring_patterns')
      .select('*')
      .eq('user_id', user.id)

    // Get transaction rules for applying display names and categories
    const { data: rules } = await supabase
      .from('transaction_rules')
      .select('match_pattern, match_field, display_name, set_category, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('priority', { ascending: false })

    const transactionRules: TransactionRule[] = (rules || []).map(r => ({
      match_pattern: r.match_pattern,
      match_field: r.match_field,
      display_name: r.display_name,
      set_category: r.set_category,
      is_active: r.is_active,
    }))

    // Get 12 months of transactions for display
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const { data: allTransactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', twelveMonthsAgo.toISOString().split('T')[0])
      .or('ignore_type.is.null,ignore_type.neq.all')
      .order('date', { ascending: false })

    // Convert to response format (apply transaction rules for display names)
    const recurring = (allPatterns || [])
      .filter(p => !dismissedPatterns.includes(p.merchant_pattern || ''))
      .map(p => patternToRecurring(p, allTransactions || [], transactionRules))

    // Calculate yearly spend
    const yearlySpend = recurring
      .filter(r => !r.isIncome && r.amount > 0)
      .reduce((sum, r) => {
        let multiplier = 12
        if (r.frequency === 'weekly') multiplier = 52
        else if (r.frequency === 'bi-weekly') multiplier = 26
        else if (r.frequency === 'quarterly') multiplier = 4
        else if (r.frequency === 'yearly') multiplier = 1
        return sum + ((r.averageAmount || r.amount) * multiplier)
      }, 0)

    // Get pending suggestions count for the response
    const { count: pendingSuggestions } = await supabase
      .from('recurring_suggestions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'pending')

    const totalCount = recurring.length

    // Cache the results for 24 hours
    const cachedAt = new Date()
    const expiresAt = new Date(cachedAt.getTime() + CACHE_TTL.recurringDetection * 1000)

    const cacheData: CachedRecurringAnalysis = {
      recurring: recurring.map(r => ({
        id: r.id,
        name: r.name,
        display_name: r.displayName || r.name,
        amount: r.amount,
        frequency: r.frequency,
        is_income: r.isIncome,
        next_expected_date: r.nextDate || null,
        category: r.category || null,
        confidence: r.confidence || null,
        bill_type: null, // Not available in RecurringTransaction
        averageAmount: r.averageAmount,
        lastSeenDate: r.lastDate,
        occurrences: r.occurrences,
        transactionIds: r.transactions?.map(t => t.id) || [],
      })),
      yearlySpend,
      count: totalCount,
      aiPowered: true,
      lastAnalysis: now,
      cachedAt: cachedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }

    // Cache asynchronously (don't wait)
    cacheSet(cacheKey, cacheData, CACHE_TTL.recurringDetection).catch(err => {
      console.error('Failed to cache recurring analysis:', err)
    })

    return NextResponse.json({
      recurring,
      yearlySpend,
      count: totalCount,
      aiPowered: true,
      lastAnalysis: now,
      pendingSuggestions: pendingSuggestions || 0,
      newSuggestions,
      fromCache: false,
      cachedAt: cachedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      message: newSuggestions > 0
        ? `AI detected ${newSuggestions} new recurring transactions. Review them in the suggestions panel.`
        : `No new recurring transactions detected. You have ${totalCount} confirmed patterns.`
    })

  } catch (aiError: unknown) {
    console.error('AI recurring detection error:', aiError)

    // Check for rate limit error from Anthropic
    if (aiError && typeof aiError === 'object' && 'status' in aiError && aiError.status === 429) {
      return NextResponse.json({
        error: 'AI rate limit reached. Please wait a minute and try again.',
        recurring: []
      }, { status: 429 })
    }

    return NextResponse.json({
      error: 'AI analysis failed. Please try again later.',
      recurring: []
    }, { status: 500 })
  }
}

// PUT - Manually add a recurring pattern
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
  const { name, amount, frequency, isIncome, category, nextDate, originalName } = body

  if (!name || !amount || !frequency) {
    return NextResponse.json({ error: 'name, amount, and frequency are required' }, { status: 400 })
  }

  const validFrequencies = ['weekly', 'bi-weekly', 'monthly', 'quarterly', 'yearly']
  if (!validFrequencies.includes(frequency)) {
    return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 })
  }

  // For income patterns, use more of the original name for specific matching
  // This prevents salary from matching gas station purchases with the same merchant
  let merchantPattern: string
  if (isIncome && originalName) {
    // Use more words from the original name for income (up to 6 words)
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
  const now = new Date().toISOString()

  // Calculate next expected date if not provided
  let nextExpectedDate = nextDate
  if (!nextExpectedDate) {
    const next = new Date()
    switch (frequency) {
      case 'weekly':
        next.setDate(next.getDate() + 7)
        break
      case 'bi-weekly':
        next.setDate(next.getDate() + 14)
        break
      case 'monthly':
        next.setMonth(next.getMonth() + 1)
        break
      case 'quarterly':
        next.setMonth(next.getMonth() + 3)
        break
      case 'yearly':
        next.setFullYear(next.getFullYear() + 1)
        break
    }
    nextExpectedDate = next.toISOString().split('T')[0]
  }

  // Remove from dismissals if previously dismissed
  await supabase
    .from('recurring_dismissals')
    .delete()
    .eq('user_id', user.id)
    .eq('merchant_pattern', merchantPattern)

  // Upsert the recurring pattern
  const patternData = {
    user_id: user.id,
    name: name,
    display_name: name,
    merchant_pattern: merchantPattern,
    frequency: frequency,
    amount: Math.abs(amount),
    average_amount: Math.abs(amount),
    is_income: isIncome || false,
    next_expected_date: nextExpectedDate,
    last_seen_date: now.split('T')[0],
    category: category || null,
    confidence: 'high', // User-added is high confidence
    occurrences: 1,
    bill_type: isIncome ? 'income' : 'bill',
    ai_detected: false, // Manual entry
    last_ai_analysis: null,
  }

  console.log('Creating recurring pattern:', JSON.stringify(patternData, null, 2))

  const { data, error } = await supabase.from('recurring_patterns').upsert(patternData, {
    onConflict: 'user_id,merchant_pattern'
  }).select()

  if (error) {
    console.error('Error adding recurring pattern:', error)
    return NextResponse.json({ error: 'Failed to add recurring pattern', details: error.message }, { status: 500 })
  }

  console.log('Created recurring pattern:', data)

  return NextResponse.json({ success: true, merchantPattern, pattern: data?.[0] })
}

// PATCH - Update a recurring pattern
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

  const body = await request.json()
  const { id, frequency, amount, nextDate } = body

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  if (frequency) {
    const validFrequencies = ['weekly', 'bi-weekly', 'monthly', 'quarterly', 'yearly']
    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 })
    }
    updates.frequency = frequency

    // Recalculate next expected date based on new frequency
    const { data: pattern } = await supabase
      .from('recurring_patterns')
      .select('last_seen_date')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (pattern?.last_seen_date) {
      const lastDate = new Date(pattern.last_seen_date)
      const nextExpected = new Date(lastDate)

      // Use calendar-based increments for predictable dates
      if (frequency === 'weekly') {
        nextExpected.setDate(nextExpected.getDate() + 7)
      } else if (frequency === 'bi-weekly') {
        nextExpected.setDate(nextExpected.getDate() + 14)
      } else if (frequency === 'monthly') {
        nextExpected.setMonth(nextExpected.getMonth() + 1)
      } else if (frequency === 'quarterly') {
        nextExpected.setMonth(nextExpected.getMonth() + 3)
      } else if (frequency === 'yearly') {
        nextExpected.setFullYear(nextExpected.getFullYear() + 1)
      }

      updates.next_expected_date = nextExpected.toISOString().split('T')[0]
    }
  }

  if (amount !== undefined) {
    updates.amount = Math.abs(amount)
    updates.average_amount = Math.abs(amount)
  }

  if (nextDate) {
    updates.next_expected_date = nextDate
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('recurring_patterns')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()

  if (error) {
    console.error('Error updating recurring pattern:', error)
    return NextResponse.json({ error: 'Failed to update pattern' }, { status: 500 })
  }

  return NextResponse.json({ success: true, pattern: data?.[0] })
}

// DELETE - Dismiss a recurring pattern
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

  const { merchantPattern: rawMerchantPattern, originalName, reason } = await request.json()

  if (!rawMerchantPattern) {
    return NextResponse.json({ error: 'merchantPattern is required' }, { status: 400 })
  }

  // Normalize the merchant pattern to ensure consistent matching with basic detection
  const merchantPattern = normalizeMerchant(rawMerchantPattern)
  console.log('[recurring] Dismissing pattern:', { raw: rawMerchantPattern, normalized: merchantPattern })

  // Check if this was an income pattern before deleting
  const { data: existingPattern } = await supabase
    .from('recurring_patterns')
    .select('is_income')
    .eq('user_id', user.id)
    .eq('merchant_pattern', merchantPattern)
    .single()

  // Add to dismissals
  await supabase.from('recurring_dismissals').upsert({
    user_id: user.id,
    merchant_pattern: merchantPattern,
    original_name: originalName || null,
    reason: reason || null,
    dismissed_at: new Date().toISOString(),
  }, { onConflict: 'user_id,merchant_pattern' })

  // Remove from cached patterns if exists
  await supabase
    .from('recurring_patterns')
    .delete()
    .eq('user_id', user.id)
    .eq('merchant_pattern', merchantPattern)

  // If this was an income pattern, also unset is_income on matching transactions
  // This prevents basic detection from re-creating the pattern
  if (existingPattern?.is_income) {
    // Find and update transactions that match this pattern
    const patternLower = merchantPattern.toLowerCase()
    const { data: transactions } = await supabase
      .from('transactions')
      .select('id, name, merchant_name, display_name')
      .eq('user_id', user.id)
      .eq('is_income', true)

    if (transactions) {
      const matchingIds = transactions
        .filter(tx => {
          const txKey = normalizeMerchant(tx.display_name || tx.merchant_name || tx.name)
          return txKey === patternLower || txKey.includes(patternLower) || patternLower.includes(txKey)
        })
        .map(tx => tx.id)

      if (matchingIds.length > 0) {
        await supabase
          .from('transactions')
          .update({ is_income: false })
          .in('id', matchingIds)

        console.log(`[recurring] Unset is_income on ${matchingIds.length} transactions for pattern "${merchantPattern}"`)
      }
    }
  }

  return NextResponse.json({ success: true })
}
