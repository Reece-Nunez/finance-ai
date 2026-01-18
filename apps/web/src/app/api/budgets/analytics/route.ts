import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getApiUser } from '@/lib/supabase/api'

export async function GET(request: NextRequest) {
  try {
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

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    const currentDay = now.getDate()
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const daysLeft = daysInMonth - currentDay
    const daysPassed = currentDay

    // Current month date range
    const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0]
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0]

    // Previous month date range
    const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0]
    const endOfLastMonth = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]

    // Fetch budgets
    const { data: budgets } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', user.id)
      .order('category')

    // Fetch current month transactions (expenses only, excluding ignored)
    const { data: currentTransactions } = await supabase
      .from('transactions')
      .select('id, name, merchant_name, amount, date, category, display_name')
      .eq('user_id', user.id)
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)
      .gt('amount', 0) // Expenses are positive
      .or('ignore_type.is.null,ignore_type.neq.all')
      .order('date', { ascending: false })

    // Fetch last month transactions for comparison (excluding ignored)
    const { data: lastMonthTransactions } = await supabase
      .from('transactions')
      .select('category, amount')
      .eq('user_id', user.id)
      .gte('date', startOfLastMonth)
      .lte('date', endOfLastMonth)
      .gt('amount', 0)
      .or('ignore_type.is.null,ignore_type.neq.all')

    // Normalize category for consistent matching (handle Plaid uppercase vs user input)
    const normalizeCategory = (category: string | null): string => {
      if (!category) return 'UNCATEGORIZED'
      return category.toUpperCase().trim()
    }

    // Calculate spending by category for current month
    type TransactionType = NonNullable<typeof currentTransactions>[number]
    const currentSpendingByCategory: Record<string, { spent: number; transactions: TransactionType[] }> = {}
    currentTransactions?.forEach((tx) => {
      const category = normalizeCategory(tx.category)
      if (!currentSpendingByCategory[category]) {
        currentSpendingByCategory[category] = { spent: 0, transactions: [] }
      }
      currentSpendingByCategory[category].spent += tx.amount
      currentSpendingByCategory[category].transactions.push(tx)
    })

    // Calculate spending by category for last month
    const lastMonthSpendingByCategory: Record<string, number> = {}
    lastMonthTransactions?.forEach((tx) => {
      const category = normalizeCategory(tx.category)
      lastMonthSpendingByCategory[category] = (lastMonthSpendingByCategory[category] || 0) + tx.amount
    })

    // Build budget categories with analytics
    // Store both normalized key and original display name
    const budgetMap: Record<string, { id: string; amount: number; displayName: string }> = {}
    budgets?.forEach((b) => {
      const normalizedKey = normalizeCategory(b.category)
      budgetMap[normalizedKey] = { id: b.id, amount: b.amount, displayName: b.category }
    })

    // Get all unique categories (from budgets and spending)
    const allCategories = new Set([
      ...Object.keys(budgetMap),
      ...Object.keys(currentSpendingByCategory),
    ])

    interface BudgetCategory {
      category: string
      budgetId: string | null
      budgeted: number
      spent: number
      remaining: number
      percentUsed: number
      lastMonthSpent: number
      changeFromLastMonth: number
      dailyAverage: number
      projectedSpend: number
      status: 'under' | 'warning' | 'over'
      transactions: TransactionType[]
    }

    // Helper to format category for display (Title Case)
    const formatCategoryDisplay = (normalizedCategory: string): string => {
      return normalizedCategory
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    }

    const budgetCategories: BudgetCategory[] = Array.from(allCategories).map((normalizedCategory) => {
      const budget = budgetMap[normalizedCategory]
      const categoryData = currentSpendingByCategory[normalizedCategory] || { spent: 0, transactions: [] }
      const spent = categoryData.spent
      const budgeted = budget?.amount || 0
      const remaining = budgeted - spent
      const percentUsed = budgeted > 0 ? (spent / budgeted) * 100 : 0
      const lastMonthSpent = lastMonthSpendingByCategory[normalizedCategory] || 0
      const changeFromLastMonth = lastMonthSpent > 0
        ? ((spent - lastMonthSpent) / lastMonthSpent) * 100
        : spent > 0 ? 100 : 0

      const dailyAverage = daysPassed > 0 ? spent / daysPassed : 0
      const projectedSpend = dailyAverage * daysInMonth

      let status: 'under' | 'warning' | 'over' = 'under'
      if (budgeted > 0) {
        if (spent > budgeted) status = 'over'
        else if (percentUsed > 80) status = 'warning'
      }

      // Use budget's original display name if available, otherwise format the normalized category
      const displayCategory = budget?.displayName || formatCategoryDisplay(normalizedCategory)

      return {
        category: displayCategory,
        budgetId: budget?.id || null,
        budgeted,
        spent,
        remaining,
        percentUsed,
        lastMonthSpent,
        changeFromLastMonth,
        dailyAverage,
        projectedSpend,
        status,
        transactions: categoryData.transactions,
      }
    })

    // Sort: budgeted categories first (by % used desc), then unbudgeted by spent
    budgetCategories.sort((a, b) => {
      if (a.budgeted && !b.budgeted) return -1
      if (!a.budgeted && b.budgeted) return 1
      if (a.budgeted && b.budgeted) return b.percentUsed - a.percentUsed
      return b.spent - a.spent
    })

    // Calculate totals
    const totalBudgeted = budgetCategories.reduce((sum, c) => sum + c.budgeted, 0)
    const totalSpent = budgetCategories.reduce((sum, c) => sum + c.spent, 0)
    const totalRemaining = totalBudgeted - totalSpent
    const totalPercentUsed = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0

    const lastMonthTotal = Object.values(lastMonthSpendingByCategory).reduce((sum, v) => sum + v, 0)
    const monthOverMonthChange = lastMonthTotal > 0
      ? ((totalSpent - lastMonthTotal) / lastMonthTotal) * 100
      : 0

    const dailyAverageTotal = daysPassed > 0 ? totalSpent / daysPassed : 0
    const projectedTotal = dailyAverageTotal * daysInMonth
    const projectedRemaining = totalBudgeted - projectedTotal

    // Calculate on-track status
    const expectedSpendByNow = (daysPassed / daysInMonth) * totalBudgeted
    const isOnTrack = totalSpent <= expectedSpendByNow
    const trackingDifference = expectedSpendByNow - totalSpent

    // Alerts for categories over or approaching budget
    interface Alert {
      category: string
      type: 'over' | 'warning' | 'projected_over'
      message: string
      amount: number
    }

    const alerts: Alert[] = []
    budgetCategories.forEach((cat) => {
      if (cat.status === 'over') {
        alerts.push({
          category: cat.category,
          type: 'over',
          message: `Over budget by ${formatCurrency(Math.abs(cat.remaining))}`,
          amount: Math.abs(cat.remaining),
        })
      } else if (cat.status === 'warning') {
        alerts.push({
          category: cat.category,
          type: 'warning',
          message: `${Math.round(cat.percentUsed)}% of budget used`,
          amount: cat.remaining,
        })
      } else if (cat.budgeted > 0 && cat.projectedSpend > cat.budgeted) {
        alerts.push({
          category: cat.category,
          type: 'projected_over',
          message: `Projected to exceed by ${formatCurrency(cat.projectedSpend - cat.budgeted)}`,
          amount: cat.projectedSpend - cat.budgeted,
        })
      }
    })

    // Get suggested categories (categories with spending but no budget)
    const suggestedCategories = budgetCategories
      .filter((c) => !c.budgeted && c.spent > 0)
      .slice(0, 5)
      .map((c) => ({
        category: c.category,
        averageSpend: c.spent, // This month's spending as suggestion
        suggestedBudget: Math.ceil(c.spent / 10) * 10, // Round up to nearest 10
      }))

    return NextResponse.json({
      period: {
        month: now.toLocaleDateString('en-US', { month: 'long' }),
        year: currentYear,
        daysLeft,
        daysPassed,
        daysInMonth,
        startDate: startOfMonth,
        endDate: endOfMonth,
      },
      summary: {
        totalBudgeted,
        totalSpent,
        totalRemaining,
        totalPercentUsed,
        lastMonthTotal,
        monthOverMonthChange,
        dailyAverage: dailyAverageTotal,
        projectedTotal,
        projectedRemaining,
        isOnTrack,
        trackingDifference,
        budgetedCategoriesCount: budgetCategories.filter((c) => c.budgeted > 0).length,
        totalCategoriesCount: budgetCategories.length,
      },
      categories: budgetCategories,
      alerts,
      suggestedCategories,
    })
  } catch (error) {
    console.error('Error fetching budget analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch budget analytics' }, { status: 500 })
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
