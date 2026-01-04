import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatCategory } from '@/lib/format'
import { getUserSubscription, canAccessFeature } from '@/lib/subscription'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check subscription for health score access
    const subscription = await getUserSubscription(user.id)
    if (!canAccessFeature(subscription, 'health_score')) {
      return NextResponse.json(
        { error: 'upgrade_required', message: 'Financial Health Score requires a Pro subscription' },
        { status: 403 }
      )
    }

    // Fetch user's AI preferences
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('ai_preferences')
      .eq('user_id', user.id)
      .maybeSingle()

    const aiPrefs = profile?.ai_preferences || {}

    // Check if transaction analysis is allowed
    if (aiPrefs.allow_transaction_analysis === false) {
      return NextResponse.json({
        period: { month: new Date().toLocaleDateString('en-US', { month: 'long' }), year: new Date().getFullYear() },
        stats: {},
        healthScore: 0,
        healthStatus: 'unknown',
        insights: [],
        suggestions: [],
        message: 'Transaction analysis is disabled in your AI preferences'
      })
    }

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const daysPassed = now.getDate()
    const daysLeft = daysInMonth - daysPassed

    // Date ranges
    const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0]
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0]
    const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0]
    const endOfLastMonth = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]

    // Fetch current month transactions
    const { data: currentTransactions } = await supabase
      .from('transactions')
      .select('amount, category, date, name, merchant_name')
      .eq('user_id', user.id)
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)
      .neq('ignore_type', 'all')

    // Fetch last month transactions
    const { data: lastMonthTransactions } = await supabase
      .from('transactions')
      .select('amount, category')
      .eq('user_id', user.id)
      .gte('date', startOfLastMonth)
      .lte('date', endOfLastMonth)
      .neq('ignore_type', 'all')

    // Fetch budgets
    const { data: budgets } = await supabase
      .from('budgets')
      .select('category, amount')
      .eq('user_id', user.id)

    // Fetch accounts
    const { data: accounts } = await supabase
      .from('accounts')
      .select('current_balance, type')
      .eq('user_id', user.id)

    // Calculate current month stats
    const currentIncome = currentTransactions
      ?.filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0

    const currentSpending = currentTransactions
      ?.filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0) || 0

    // Calculate last month stats
    const lastMonthSpending = lastMonthTransactions
      ?.filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0) || 0

    // Spending by category
    const spendingByCategory: Record<string, number> = {}
    currentTransactions?.filter(t => t.amount > 0).forEach(t => {
      const cat = t.category || 'Uncategorized'
      spendingByCategory[cat] = (spendingByCategory[cat] || 0) + t.amount
    })

    // Top spending category
    let topCategory = { name: 'None', amount: 0 }
    Object.entries(spendingByCategory).forEach(([cat, amount]) => {
      if (amount > topCategory.amount) {
        topCategory = { name: cat, amount }
      }
    })

    // Daily spending rate
    const dailyAverage = daysPassed > 0 ? currentSpending / daysPassed : 0
    const projectedSpending = dailyAverage * daysInMonth

    // Budget status
    const totalBudgeted = budgets?.reduce((sum, b) => sum + b.amount, 0) || 0
    const budgetRemaining = totalBudgeted - currentSpending
    const budgetPercentUsed = totalBudgeted > 0 ? (currentSpending / totalBudgeted) * 100 : 0

    // Spending change from last month
    const spendingChange = lastMonthSpending > 0
      ? ((currentSpending - lastMonthSpending) / lastMonthSpending) * 100
      : 0

    // Net cash flow
    const netCashFlow = currentIncome - currentSpending

    // Total balance
    const totalBalance = accounts?.reduce((sum, a) => sum + (a.current_balance || 0), 0) || 0

    // Categories over budget
    const categoriesOverBudget: string[] = []
    budgets?.forEach(b => {
      const spent = spendingByCategory[b.category] || 0
      if (spent > b.amount) {
        categoriesOverBudget.push(b.category)
      }
    })

    // Generate smart suggestions based on context
    const suggestions: { text: string; priority: 'high' | 'medium' | 'low'; type: string }[] = []

    if (categoriesOverBudget.length > 0) {
      suggestions.push({
        text: `Why am I over budget on ${formatCategory(categoriesOverBudget[0])}?`,
        priority: 'high',
        type: 'budget_alert'
      })
    }

    if (budgetPercentUsed > 80 && daysLeft > 7) {
      suggestions.push({
        text: 'How can I stay within budget for the rest of the month?',
        priority: 'high',
        type: 'budget_warning'
      })
    }

    if (spendingChange > 20) {
      suggestions.push({
        text: 'Why is my spending higher this month?',
        priority: 'medium',
        type: 'spending_increase'
      })
    }

    if (topCategory.amount > currentSpending * 0.4) {
      suggestions.push({
        text: `How can I reduce my ${formatCategory(topCategory.name)} spending?`,
        priority: 'medium',
        type: 'top_category'
      })
    }

    if (netCashFlow < 0) {
      suggestions.push({
        text: 'How can I improve my cash flow?',
        priority: 'high',
        type: 'negative_cash_flow'
      })
    }

    // Default suggestions (filtered by AI preferences)
    if (aiPrefs.spending_insights !== false) {
      suggestions.push({ text: 'What are my biggest expenses this month?', priority: 'low', type: 'expenses' })
    }

    if (aiPrefs.savings_suggestions !== false) {
      suggestions.push({ text: 'Help me create a savings plan', priority: 'low', type: 'savings' })
    }

    if (aiPrefs.detect_subscriptions !== false) {
      suggestions.push({ text: 'Are there any subscriptions I should cancel?', priority: 'low', type: 'subscriptions' })
    }

    if (aiPrefs.budget_recommendations !== false) {
      suggestions.push({ text: 'Give me a financial health check', priority: 'medium', type: 'health_check' })
    }

    if (aiPrefs.bill_negotiation_tips !== false) {
      suggestions.push({ text: 'Which bills could I negotiate to save money?', priority: 'low', type: 'bills' })
    }

    if (aiPrefs.investment_tips === true) {
      suggestions.push({ text: 'How should I think about investing my savings?', priority: 'low', type: 'investment' })
    }

    // Generate quick insights
    const insights: { title: string; value: string; trend?: 'up' | 'down' | 'neutral'; subtitle?: string }[] = []

    insights.push({
      title: 'Spent This Month',
      value: `$${currentSpending.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      trend: spendingChange > 5 ? 'up' : spendingChange < -5 ? 'down' : 'neutral',
      subtitle: spendingChange !== 0 ? `${Math.abs(Math.round(spendingChange))}% ${spendingChange > 0 ? 'more' : 'less'} than last month` : 'Same as last month'
    })

    if (totalBudgeted > 0) {
      insights.push({
        title: 'Budget Status',
        value: budgetRemaining >= 0 ? `$${budgetRemaining.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} left` : `$${Math.abs(budgetRemaining).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} over`,
        trend: budgetRemaining >= 0 ? 'neutral' : 'up',
        subtitle: `${Math.round(budgetPercentUsed)}% used with ${daysLeft} days left`
      })
    }

    insights.push({
      title: 'Daily Average',
      value: `$${dailyAverage.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      trend: 'neutral',
      subtitle: `Projected: $${projectedSpending.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} this month`
    })

    insights.push({
      title: 'Top Category',
      value: formatCategory(topCategory.name),
      trend: 'neutral',
      subtitle: `$${topCategory.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} spent`
    })

    // Health score (simple calculation)
    let healthScore = 100
    if (budgetPercentUsed > 100) healthScore -= 30
    else if (budgetPercentUsed > 80) healthScore -= 15
    if (netCashFlow < 0) healthScore -= 25
    if (spendingChange > 30) healthScore -= 15
    if (categoriesOverBudget.length > 0) healthScore -= 10 * Math.min(categoriesOverBudget.length, 3)
    healthScore = Math.max(0, healthScore)

    let healthStatus: 'excellent' | 'good' | 'fair' | 'needs_attention' = 'excellent'
    if (healthScore < 50) healthStatus = 'needs_attention'
    else if (healthScore < 70) healthStatus = 'fair'
    else if (healthScore < 85) healthStatus = 'good'

    return NextResponse.json({
      period: {
        month: now.toLocaleDateString('en-US', { month: 'long' }),
        year: currentYear,
        daysLeft,
        daysPassed,
        daysInMonth
      },
      stats: {
        currentSpending,
        currentIncome,
        lastMonthSpending,
        spendingChange,
        netCashFlow,
        totalBalance,
        totalBudgeted,
        budgetRemaining,
        budgetPercentUsed,
        dailyAverage,
        projectedSpending,
        topCategory,
        categoriesOverBudget
      },
      healthScore,
      healthStatus,
      insights,
      suggestions: suggestions.slice(0, 6) // Top 6 suggestions
    })
  } catch (error) {
    console.error('Error fetching insights:', error)
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 })
  }
}
