import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserSubscription, canAccessFeature } from '@/lib/subscription'
import { anthropic } from '@/lib/ai'
import { checkAndIncrementUsage, rateLimitResponse } from '@/lib/ai-usage'

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

// Convert database pattern to API response format
function patternToRecurring(pattern: RecurringPattern, transactions: Transaction[]): RecurringTransaction {
  const matchingTxs = transactions.filter(tx => {
    const txMerchant = normalizeMerchant(tx.display_name || tx.merchant_name || tx.name)
    return pattern.merchant_pattern && txMerchant.includes(pattern.merchant_pattern)
  })

  return {
    id: pattern.id,
    name: pattern.name,
    displayName: pattern.display_name,
    amount: Number(pattern.amount),
    averageAmount: Number(pattern.average_amount),
    frequency: pattern.frequency as RecurringTransaction['frequency'],
    nextDate: pattern.next_expected_date || new Date().toISOString().split('T')[0],
    lastDate: pattern.last_seen_date || new Date().toISOString().split('T')[0],
    category: pattern.category,
    accountId: matchingTxs[0]?.plaid_account_id || '',
    isIncome: pattern.is_income,
    confidence: (pattern.confidence || 'medium') as RecurringTransaction['confidence'],
    occurrences: pattern.occurrences,
    transactions: matchingTxs,
  }
}

// Basic pattern detection (fallback when no AI cache)
function analyzeRecurringPatterns(transactions: Transaction[], dismissedPatterns: string[]): RecurringTransaction[] {
  const groups = new Map<string, Transaction[]>()

  for (const tx of transactions) {
    const key = normalizeMerchant(tx.display_name || tx.merchant_name || tx.name)
    if (!key || dismissedPatterns.includes(key)) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(tx)
  }

  const recurring: RecurringTransaction[] = []

  for (const [key, txs] of groups) {
    if (txs.length < 2) continue

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
    if (amountConsistent && intervalConsistent && txs.length >= 3) confidence = 'high'
    else if ((amountConsistent || intervalConsistent) && txs.length >= 3) confidence = 'medium'
    else if (txs.length >= 4) confidence = 'medium'

    if (confidence === 'low' && txs.length < 4) continue

    const lastTx = sorted[sorted.length - 1]
    const [year, month, day] = lastTx.date.split('-').map(Number)
    const lastDate = new Date(year, month - 1, day)
    const nextDate = new Date(lastDate)
    nextDate.setDate(nextDate.getDate() + Math.round(avgInterval))

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
export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get dismissed patterns
  const { data: dismissals } = await supabase
    .from('recurring_dismissals')
    .select('merchant_pattern')
    .eq('user_id', user.id)

  const dismissedPatterns = (dismissals || []).map(d => d.merchant_pattern)

  // Check for cached AI patterns
  const { data: cachedPatterns } = await supabase
    .from('recurring_patterns')
    .select('*')
    .eq('user_id', user.id)

  // Get transactions for display
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', twelveMonthsAgo.toISOString().split('T')[0])
    .neq('ignore_type', 'all')
    .order('date', { ascending: false })

  let recurring: RecurringTransaction[]
  let aiPowered = false
  let lastAnalysis: string | null = null

  if (cachedPatterns && cachedPatterns.length > 0) {
    // Use cached AI results, filtering out dismissed ones
    recurring = cachedPatterns
      .filter(p => !dismissedPatterns.includes(p.merchant_pattern || ''))
      .map(p => patternToRecurring(p, transactions || []))

    aiPowered = cachedPatterns.some(p => p.ai_detected)
    lastAnalysis = cachedPatterns[0]?.last_ai_analysis || null
  } else {
    // Fall back to basic detection
    recurring = analyzeRecurringPatterns(transactions || [], dismissedPatterns)
  }

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

  return NextResponse.json({
    recurring,
    yearlySpend,
    count: recurring.length,
    aiPowered,
    lastAnalysis,
    hasCachedResults: cachedPatterns && cachedPatterns.length > 0,
  })
}

// POST - Re-analyze with AI (explicit user action)
export async function POST() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check subscription
  const subscription = await getUserSubscription(user.id)
  const isPro = canAccessFeature(subscription, 'ai_suggestions')

  if (!isPro) {
    return NextResponse.json({
      error: 'upgrade_required',
      message: 'AI Recurring Detection requires a Pro subscription'
    }, { status: 403 })
  }

  // Check rate limits
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

    // Clear old cached patterns
    await supabase.from('recurring_patterns').delete().eq('user_id', user.id)

    // Save new patterns
    const now = new Date().toISOString()
    const patternsToInsert = aiRecurring.map(item => {
      const merchantKey = normalizeMerchant(item.name)
      const group = merchantGroups.get(merchantKey)

      // Calculate next date
      let daysToAdd = 30
      if (item.frequency === 'weekly') daysToAdd = 7
      else if (item.frequency === 'bi-weekly') daysToAdd = 14
      else if (item.frequency === 'quarterly') daysToAdd = 90
      else if (item.frequency === 'yearly') daysToAdd = 365

      const lastDate = group?.dates[0] ? new Date(group.dates[0]) : new Date()
      const nextDate = new Date(lastDate)
      nextDate.setDate(nextDate.getDate() + daysToAdd)

      return {
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
        ai_detected: true,
        last_ai_analysis: now,
      }
    })

    if (patternsToInsert.length > 0) {
      await supabase.from('recurring_patterns').insert(patternsToInsert)
    }

    // Convert to response format
    const recurring = aiRecurring.map(item => {
      const merchantKey = normalizeMerchant(item.name)
      const group = merchantGroups.get(merchantKey)
      const matchingTxs = transactions.filter(tx =>
        normalizeMerchant(tx.display_name || tx.merchant_name || tx.name) === merchantKey
      )

      let daysToAdd = 30
      if (item.frequency === 'weekly') daysToAdd = 7
      else if (item.frequency === 'bi-weekly') daysToAdd = 14
      else if (item.frequency === 'quarterly') daysToAdd = 90
      else if (item.frequency === 'yearly') daysToAdd = 365

      const lastDate = group?.dates[0] ? new Date(group.dates[0]) : new Date()
      const nextDate = new Date(lastDate)
      nextDate.setDate(nextDate.getDate() + daysToAdd)

      return {
        id: matchingTxs[0]?.id || item.name,
        name: item.name,
        displayName: item.displayName || item.name,
        amount: item.amount,
        averageAmount: item.averageAmount || item.amount,
        frequency: item.frequency,
        nextDate: nextDate.toISOString().split('T')[0],
        lastDate: group?.dates[0] || new Date().toISOString().split('T')[0],
        category: item.category || group?.category || null,
        accountId: matchingTxs[0]?.plaid_account_id || '',
        isIncome: item.isIncome || false,
        confidence: item.confidence,
        occurrences: group?.count || 0,
        transactions: matchingTxs,
      }
    })

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

    return NextResponse.json({
      recurring,
      yearlySpend,
      count: recurring.length,
      aiPowered: true,
      lastAnalysis: now,
      message: `AI detected ${recurring.length} recurring bills/subscriptions`
    })

  } catch (aiError) {
    console.error('AI recurring detection error:', aiError)
    return NextResponse.json({
      error: 'AI analysis failed. Please try again later.',
      recurring: []
    }, { status: 500 })
  }
}

// DELETE - Dismiss a recurring pattern
export async function DELETE(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { merchantPattern, originalName, reason } = await request.json()

  if (!merchantPattern) {
    return NextResponse.json({ error: 'merchantPattern is required' }, { status: 400 })
  }

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

  return NextResponse.json({ success: true })
}
