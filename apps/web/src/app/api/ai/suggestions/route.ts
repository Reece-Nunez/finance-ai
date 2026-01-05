import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/ai'
import { getUserSubscription, canAccessFeature } from '@/lib/subscription'
import { checkAndIncrementUsage, rateLimitResponse } from '@/lib/ai-usage'

const SUGGESTION_SYSTEM_PROMPT = `You are an intelligent financial advisor with deep insight into this specific user's spending patterns, upcoming cash flow, and financial goals. You provide highly personalized, actionable suggestions based on comprehensive data analysis.

## Your Capabilities:
1. **Spending Pattern Awareness** - You know their typical spending by day of week, time of month, and category
2. **Cash Flow Forecasting** - You can see their projected balance over the next 30 days
3. **Budget Tracking** - You know their budget limits and current progress
4. **Recurring Bill Detection** - You know their upcoming recurring expenses
5. **Personalized Thresholds** - You adjust "low balance" warnings based on THEIR spending, not generic amounts
6. **Anomaly Detection** - You can see unusual transactions, duplicate charges, price increases, and suspicious activity

## Suggestion Types:
- **"transfer"** - Move money between accounts (be specific: from, to, amount, why)
- **"alert"** - Time-sensitive warnings (upcoming overdraft, unusual spending, bill due)
- **"tip"** - Actionable advice based on their patterns ("You spend 40% more on weekends - consider...")
- **"savings_opportunity"** - Specific ways to save based on their data
- **"budget_warning"** - Budget category approaching or exceeding limit
- **"bill_reminder"** - Upcoming recurring expense they should be aware of
- **"anomaly"** - Flag suspicious transactions or unusual patterns detected

## Priority Levels:
- **"urgent"** - Needs immediate action (overdraft risk, missed bill)
- **"high"** - Important, act soon (budget nearly exceeded, low balance approaching)
- **"medium"** - Good to know, act when convenient
- **"low"** - Informational, nice to have

## Learning from Feedback:
- APPROVED/EXECUTED suggestions = user finds these helpful, do more like this
- DISMISSED suggestions = avoid similar ones unless circumstances are very different
- Adapt thresholds based on what they've accepted/rejected

## Response Format:
Return ONLY a JSON array of suggestions. Each suggestion:
{
  "type": "transfer" | "alert" | "tip" | "savings_opportunity" | "budget_warning" | "bill_reminder" | "anomaly",
  "priority": "urgent" | "high" | "medium" | "low",
  "title": "Short title (max 50 chars)",
  "description": "Detailed, personalized explanation referencing specific patterns/numbers from their data",
  "action": { "from_account": "name", "to_account": "name", "amount": number } // Only for transfers
}

If everything looks good, return an empty array [].
Be specific and reference actual numbers/patterns from their data. Generic advice is not helpful.
For anomalies, always flag critical/high severity ones - the user needs to know about potential fraud or duplicate charges.`

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check subscription for AI suggestions access
    const subscription = await getUserSubscription(user.id)
    if (!canAccessFeature(subscription, 'ai_suggestions')) {
      return NextResponse.json(
        { error: 'upgrade_required', message: 'AI Suggestions requires a Pro subscription' },
        { status: 403 }
      )
    }

    // Get only pending suggestions
    const { data: suggestions } = await supabase
      .from('ai_actions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    return NextResponse.json({ suggestions: suggestions || [] })
  } catch (error) {
    console.error('Error fetching suggestions:', error)
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check subscription for AI suggestions access
    const subscription = await getUserSubscription(user.id)
    const isPro = canAccessFeature(subscription, 'ai_suggestions')
    if (!isPro) {
      return NextResponse.json(
        { error: 'upgrade_required', message: 'AI Suggestions requires a Pro subscription' },
        { status: 403 }
      )
    }

    // Check rate limits (using insights limit since suggestions are similar)
    const usageCheck = await checkAndIncrementUsage(supabase, user.id, 'insights', isPro)
    if (!usageCheck.allowed) {
      return NextResponse.json(
        rateLimitResponse('suggestions', usageCheck.limit, isPro),
        { status: 429 }
      )
    }

    // =========================================================================
    // FETCH ALL DATA IN PARALLEL
    // =========================================================================
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const [
      accountsRes,
      transactionsRes,
      pastActionsRes,
      spendingPatternsRes,
      incomePatternsRes,
      budgetsRes,
      recurringRes,
      cashFlowPredictionsRes,
      accuracyRes,
      anomaliesRes,
    ] = await Promise.all([
      // Accounts
      supabase.from('accounts').select('*').eq('user_id', user.id),
      // 6 months of transactions for better analysis
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', sixMonthsAgo.toISOString().split('T')[0])
        .order('date', { ascending: false })
        .limit(500),
      // Past AI actions for learning
      supabase
        .from('ai_actions')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['approved', 'dismissed', 'executed'])
        .order('created_at', { ascending: false })
        .limit(50),
      // Spending patterns from learning system
      supabase
        .from('spending_patterns')
        .select('*')
        .eq('user_id', user.id)
        .order('confidence_score', { ascending: false }),
      // Income patterns
      supabase
        .from('income_patterns')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true),
      // Active budgets with spending
      supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true),
      // Detected recurring transactions
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', sixMonthsAgo.toISOString().split('T')[0])
        .order('date', { ascending: false }),
      // Cash flow predictions for next 7 days
      supabase
        .from('cash_flow_predictions')
        .select('*')
        .eq('user_id', user.id)
        .gte('prediction_date', todayStr)
        .order('prediction_date', { ascending: true })
        .limit(7),
      // Prediction accuracy
      supabase
        .from('prediction_accuracy')
        .select('*')
        .eq('user_id', user.id)
        .order('period_start', { ascending: false })
        .limit(1)
        .single(),
      // Pending anomalies
      supabase
        .from('detected_anomalies')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('detected_at', { ascending: false })
        .limit(20),
    ])

    const accounts = accountsRes.data || []
    const transactions = transactionsRes.data || []
    const pastActions = pastActionsRes.data || []
    const spendingPatterns = spendingPatternsRes.data || []
    const incomePatterns = incomePatternsRes.data || []
    const budgets = budgetsRes.data || []
    const cashFlowPredictions = cashFlowPredictionsRes.data || []
    const accuracy = accuracyRes.data
    const pendingAnomalies = anomaliesRes.data || []

    if (accounts.length === 0) {
      return NextResponse.json({ suggestions: [], message: 'No accounts connected' })
    }

    // =========================================================================
    // CALCULATE PERSONALIZED THRESHOLDS
    // =========================================================================

    // Calculate average daily spending from patterns or transactions
    let avgDailySpending = 50 // Default fallback
    const dayOfWeekPatterns = spendingPatterns.filter(p => p.pattern_type === 'day_of_week')
    if (dayOfWeekPatterns.length > 0) {
      avgDailySpending = dayOfWeekPatterns.reduce((sum, p) => sum + p.average_amount, 0) / dayOfWeekPatterns.length
    } else {
      // Calculate from transactions
      const last30Days = transactions.filter(t => {
        const txDate = new Date(t.date)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        return txDate >= thirtyDaysAgo && t.amount > 0 && !t.is_income
      })
      if (last30Days.length > 0) {
        const totalSpending = last30Days.reduce((sum, t) => sum + t.amount, 0)
        avgDailySpending = totalSpending / 30
      }
    }

    // Personalized thresholds based on their spending
    const lowBalanceThreshold = Math.max(avgDailySpending * 5, 100) // 5 days of spending or $100 minimum
    const urgentBalanceThreshold = Math.max(avgDailySpending * 2, 50) // 2 days of spending or $50 minimum
    const comfortableBalance = avgDailySpending * 14 // 2 weeks of spending

    // =========================================================================
    // DETECT RECURRING TRANSACTIONS (for upcoming bills)
    // =========================================================================
    const recurringMap = new Map<string, Array<{ date: string; amount: number }>>()

    for (const tx of transactions) {
      if (tx.amount <= 0 || tx.is_income) continue // Skip income
      const key = (tx.merchant_name || tx.name || '').toLowerCase().trim()
      if (!key) continue

      if (!recurringMap.has(key)) {
        recurringMap.set(key, [])
      }
      recurringMap.get(key)!.push({ date: tx.date, amount: tx.amount })
    }

    // Find recurring expenses (same merchant, 2+ occurrences, consistent timing)
    const upcomingBills: Array<{
      name: string
      amount: number
      expectedDate: string
      daysUntil: number
    }> = []

    for (const [name, occurrences] of recurringMap) {
      if (occurrences.length < 2) continue

      // Sort by date and check intervals
      const sorted = [...occurrences].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      const intervals: number[] = []
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1].date)
        const curr = new Date(sorted[i].date)
        const daysDiff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
        intervals.push(daysDiff)
      }

      if (intervals.length === 0) continue

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const intervalVariance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length

      // If consistent (low variance), predict next occurrence
      if (intervalVariance < 100 && avgInterval >= 7 && avgInterval <= 35) {
        const lastOccurrence = new Date(sorted[sorted.length - 1].date)
        const nextExpected = new Date(lastOccurrence)
        nextExpected.setDate(nextExpected.getDate() + Math.round(avgInterval))

        const daysUntil = Math.round((nextExpected.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        // Only include if coming up in next 14 days
        if (daysUntil >= 0 && daysUntil <= 14) {
          const avgAmount = sorted.reduce((sum, o) => sum + o.amount, 0) / sorted.length
          upcomingBills.push({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            amount: Math.round(avgAmount * 100) / 100,
            expectedDate: nextExpected.toISOString().split('T')[0],
            daysUntil,
          })
        }
      }
    }

    // Sort by days until
    upcomingBills.sort((a, b) => a.daysUntil - b.daysUntil)

    // =========================================================================
    // CALCULATE BUDGET STATUS
    // =========================================================================
    const budgetStatus: Array<{
      category: string
      limit: number
      spent: number
      remaining: number
      percentUsed: number
      daysLeftInPeriod: number
    }> = []

    for (const budget of budgets) {
      // Calculate period dates
      const periodStart = new Date(budget.period_start || today)
      let periodEnd = new Date(periodStart)

      if (budget.period === 'weekly') {
        periodEnd.setDate(periodEnd.getDate() + 7)
      } else if (budget.period === 'monthly') {
        periodEnd.setMonth(periodEnd.getMonth() + 1)
      } else if (budget.period === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1)
      }

      // Calculate spending in this period for this category
      const categoryTransactions = transactions.filter(t =>
        t.category === budget.category &&
        t.amount > 0 &&
        !t.is_income &&
        new Date(t.date) >= periodStart &&
        new Date(t.date) <= today
      )

      const spent = categoryTransactions.reduce((sum, t) => sum + t.amount, 0)
      const remaining = budget.amount - spent
      const percentUsed = (spent / budget.amount) * 100
      const daysLeftInPeriod = Math.max(0, Math.round((periodEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))

      budgetStatus.push({
        category: budget.category,
        limit: budget.amount,
        spent: Math.round(spent * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        percentUsed: Math.round(percentUsed),
        daysLeftInPeriod,
      })
    }

    // =========================================================================
    // FORMAT DATA FOR AI
    // =========================================================================

    // Account summary
    const accountSummary = accounts.map(a => ({
      name: a.name,
      type: a.type,
      subtype: a.subtype,
      current_balance: a.current_balance,
      available_balance: a.available_balance,
    }))

    // Calculate total checking balance
    const totalChecking = accounts
      .filter(a => a.type === 'depository' && a.subtype === 'checking')
      .reduce((sum, a) => sum + (a.current_balance || 0), 0)

    const totalSavings = accounts
      .filter(a => a.type === 'depository' && a.subtype !== 'checking')
      .reduce((sum, a) => sum + (a.current_balance || 0), 0)

    // Recent transactions (last 30 for context)
    const recentTransactions = transactions.slice(0, 30).map(t => ({
      date: t.date,
      name: t.merchant_name || t.name,
      amount: t.amount,
      category: t.category,
      is_income: t.is_income,
    }))

    // Spending pattern insights
    const patternInsights: string[] = []

    // Day of week patterns
    const weekdayPatterns = spendingPatterns.filter(p => p.pattern_type === 'day_of_week')
    if (weekdayPatterns.length > 0) {
      const highest = weekdayPatterns.reduce((max, p) => p.average_amount > max.average_amount ? p : max)
      const lowest = weekdayPatterns.reduce((min, p) => p.average_amount < min.average_amount ? p : min)
      patternInsights.push(`Highest spending day: ${highest.dimension_key} ($${highest.average_amount.toFixed(2)} avg)`)
      patternInsights.push(`Lowest spending day: ${lowest.dimension_key} ($${lowest.average_amount.toFixed(2)} avg)`)
    }

    // Category patterns
    const categoryPatterns = spendingPatterns.filter(p => p.pattern_type === 'category' && p.category)
    const topCategories = categoryPatterns
      .sort((a, b) => b.average_amount - a.average_amount)
      .slice(0, 5)
      .map(p => `${p.category}: $${p.average_amount.toFixed(2)}/occurrence`)
    if (topCategories.length > 0) {
      patternInsights.push(`Top spending categories: ${topCategories.join(', ')}`)
    }

    // Week of month patterns
    const weekPatterns = spendingPatterns.filter(p => p.pattern_type === 'week_of_month')
    if (weekPatterns.length > 0) {
      const highestWeek = weekPatterns.reduce((max, p) => p.average_amount > max.average_amount ? p : max)
      patternInsights.push(`Highest spending week: ${highestWeek.dimension_key} ($${highestWeek.average_amount.toFixed(2)} avg)`)
    }

    // Income patterns
    const incomeInfo = incomePatterns.map(i => ({
      source: i.source_name,
      frequency: i.frequency,
      average_amount: i.average_amount,
      next_expected: i.next_expected,
    }))

    // Cash flow forecast summary
    const forecastSummary = cashFlowPredictions.map(p => ({
      date: p.prediction_date,
      predicted_balance: p.predicted_balance,
      predicted_expenses: p.predicted_expenses,
    }))

    // Find lowest projected balance in next 7 days
    let lowestProjectedBalance = totalChecking
    let lowestBalanceDate = todayStr
    for (const pred of cashFlowPredictions) {
      if (pred.predicted_balance < lowestProjectedBalance) {
        lowestProjectedBalance = pred.predicted_balance
        lowestBalanceDate = pred.prediction_date
      }
    }

    // Past actions for learning
    const approvedActions = pastActions
      .filter(a => a.status === 'approved' || a.status === 'executed')
      .map(a => ({
        type: a.action_type,
        title: a.details?.title,
        wasExecuted: a.status === 'executed',
      }))

    const dismissedActions = pastActions
      .filter(a => a.status === 'dismissed')
      .map(a => ({
        type: a.action_type,
        title: a.details?.title,
      }))

    // Format anomalies for AI
    const anomalyInfo = pendingAnomalies.map(a => ({
      type: a.anomaly_type,
      severity: a.severity,
      title: a.title,
      description: a.description,
      merchant: a.merchant_name,
      amount: a.amount,
      expected: a.expected_amount,
      deviation: a.deviation_percent,
    }))

    // =========================================================================
    // BUILD COMPREHENSIVE PROMPT
    // =========================================================================
    const userMessage = `Analyze this user's complete financial picture and provide personalized suggestions:

## ACCOUNTS
${JSON.stringify(accountSummary, null, 2)}

Total Checking: $${totalChecking.toFixed(2)}
Total Savings: $${totalSavings.toFixed(2)}

## PERSONALIZED THRESHOLDS (based on their spending patterns)
- Their average daily spending: $${avgDailySpending.toFixed(2)}
- Low balance warning threshold: $${lowBalanceThreshold.toFixed(2)} (5 days of their spending)
- Urgent balance threshold: $${urgentBalanceThreshold.toFixed(2)} (2 days of their spending)
- Comfortable balance target: $${comfortableBalance.toFixed(2)} (2 weeks of their spending)

## SPENDING PATTERNS (learned from their history)
${patternInsights.length > 0 ? patternInsights.join('\n') : 'No patterns learned yet'}

## INCOME SOURCES
${incomeInfo.length > 0 ? JSON.stringify(incomeInfo, null, 2) : 'No income patterns detected'}

## BUDGET STATUS
${budgetStatus.length > 0 ? JSON.stringify(budgetStatus, null, 2) : 'No active budgets'}

## UPCOMING BILLS (next 14 days)
${upcomingBills.length > 0 ? JSON.stringify(upcomingBills, null, 2) : 'No upcoming bills detected'}

## CASH FLOW FORECAST (next 7 days)
${forecastSummary.length > 0 ? JSON.stringify(forecastSummary, null, 2) : 'No forecast available'}
Lowest projected balance: $${lowestProjectedBalance.toFixed(2)} on ${lowestBalanceDate}

## RECENT TRANSACTIONS
${JSON.stringify(recentTransactions, null, 2)}

## DETECTED ANOMALIES (flagged by our detection system)
${anomalyInfo.length > 0 ? JSON.stringify(anomalyInfo, null, 2) : 'No anomalies detected'}
${anomalyInfo.length > 0 ? 'IMPORTANT: If there are critical or high severity anomalies, you MUST include them in your suggestions with appropriate priority.' : ''}

## PAST FEEDBACK (learn from this!)
${approvedActions.length > 0 ? `Suggestions they LIKED: ${JSON.stringify(approvedActions)}` : ''}
${dismissedActions.length > 0 ? `Suggestions they DISMISSED (avoid similar): ${JSON.stringify(dismissedActions)}` : ''}

Based on ALL of this data, provide highly personalized suggestions. Be specific - reference actual numbers, dates, and patterns from their data. Generic advice is not helpful.`

    // =========================================================================
    // CALL AI
    // =========================================================================
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-20250514', // Using Haiku for cost efficiency
      max_tokens: 2048, // Increased for more detailed suggestions
      system: SUGGESTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '[]'

    // Parse suggestions
    let suggestions: Array<{
      type: string
      priority: string
      title: string
      description: string
      action?: { from_account: string; to_account: string; amount: number }
    }> = []

    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0])
      }
    } catch (parseError) {
      console.error('Error parsing AI suggestions:', parseError)
    }

    // =========================================================================
    // STORE SUGGESTIONS
    // =========================================================================

    // Clear old pending suggestions
    await supabase
      .from('ai_actions')
      .delete()
      .eq('user_id', user.id)
      .eq('status', 'pending')

    if (suggestions.length > 0) {
      const actionsToInsert = suggestions.map(s => ({
        user_id: user.id,
        action_type: s.type,
        status: 'pending',
        details: {
          priority: s.priority,
          title: s.title,
          description: s.description,
          action: s.action,
        },
        requires_approval: true,
      }))

      await supabase.from('ai_actions').insert(actionsToInsert)
    }

    // Fetch newly created suggestions
    const { data: newSuggestions } = await supabase
      .from('ai_actions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    return NextResponse.json({
      suggestions: newSuggestions || [],
      context: {
        avgDailySpending: Math.round(avgDailySpending * 100) / 100,
        lowBalanceThreshold: Math.round(lowBalanceThreshold * 100) / 100,
        upcomingBillsCount: upcomingBills.length,
        budgetsTracked: budgetStatus.length,
        patternsLearned: spendingPatterns.length,
        anomaliesDetected: pendingAnomalies.length,
        criticalAnomalies: pendingAnomalies.filter(a => a.severity === 'critical' || a.severity === 'high').length,
      }
    })
  } catch (error) {
    console.error('Error generating suggestions:', error)
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, status } = await request.json()

    const updateData: { status: string; approved_at?: string; executed_at?: string } = { status }

    if (status === 'approved') {
      updateData.approved_at = new Date().toISOString()
    } else if (status === 'executed') {
      updateData.executed_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('ai_actions')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating suggestion:', error)
    return NextResponse.json({ error: 'Failed to update suggestion' }, { status: 500 })
  }
}
