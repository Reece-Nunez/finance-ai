import { createClient } from '@/lib/supabase/server'
import { getApiUser } from '@/lib/supabase/api'
import { NextRequest, NextResponse } from 'next/server'

interface Transaction {
  id: string
  name: string
  merchant_name: string | null
  display_name: string | null
  amount: number
  date: string
  category: string | null
  is_income: boolean
  ignore_type: string
  plaid_account_id: string
}

interface MonthlyData {
  month: string
  year: number
  income: number
  bills: number
  spending: number
}

interface CategoryData {
  category: string
  amount: number
  percentage: number
  change: number
  transactionCount: number
}

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

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || 'this_month'
  const category = searchParams.get('category')
  const customStartDate = searchParams.get('start_date')
  const customEndDate = searchParams.get('end_date')

  // Calculate date ranges
  const now = new Date()
  let startDate: Date
  let endDate: Date = new Date(now.getFullYear(), now.getMonth() + 1, 0) // End of current month

  if (period === 'custom' && customStartDate && customEndDate) {
    // Custom date range
    startDate = new Date(customStartDate)
    endDate = new Date(customEndDate)
  } else if (period === 'last_month') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    endDate = new Date(now.getFullYear(), now.getMonth(), 0)
  } else if (period === 'this_month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  } else if (period === 'last_7_days') {
    startDate = new Date(now)
    startDate.setDate(startDate.getDate() - 7)
    endDate = now
  } else if (period === 'last_30_days') {
    startDate = new Date(now)
    startDate.setDate(startDate.getDate() - 30)
    endDate = now
  } else if (period === 'last_90_days') {
    startDate = new Date(now)
    startDate.setDate(startDate.getDate() - 90)
    endDate = now
  } else if (period === 'this_year') {
    startDate = new Date(now.getFullYear(), 0, 1)
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  // Get transactions for the period (excluding ignored transfers)
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0])
    .neq('ignore_type', 'all')
    .or('ignored.is.null,ignored.eq.false')
    .order('date', { ascending: false })

  if (category) {
    query = query.ilike('category', category)
  }

  const { data: transactions, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const txs = transactions || []

  // Get previous period for comparison
  const periodLength = endDate.getTime() - startDate.getTime()
  const prevStartDate = new Date(startDate.getTime() - periodLength)
  const prevEndDate = new Date(startDate.getTime() - 1)

  let prevQuery = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', prevStartDate.toISOString().split('T')[0])
    .lte('date', prevEndDate.toISOString().split('T')[0])
    .neq('ignore_type', 'all')
    .or('ignored.is.null,ignored.eq.false')

  if (category) {
    prevQuery = prevQuery.ilike('category', category)
  }

  const { data: prevTransactions } = await prevQuery
  const prevTxs = prevTransactions || []

  // Calculate current period totals
  const income = txs
    .filter((t: Transaction) => t.amount < 0 || t.is_income)
    .reduce((sum: number, t: Transaction) => sum + Math.abs(t.amount), 0)

  const bills = txs
    .filter((t: Transaction) => {
      const cat = (t.category || '').toLowerCase()
      return t.amount > 0 && (cat.includes('bill') || cat.includes('utilit'))
    })
    .reduce((sum: number, t: Transaction) => sum + t.amount, 0)

  const spending = txs
    .filter((t: Transaction) => t.amount > 0 && !t.is_income)
    .reduce((sum: number, t: Transaction) => sum + t.amount, 0)

  // Calculate previous period totals
  const prevSpending = prevTxs
    .filter((t: Transaction) => t.amount > 0 && !t.is_income)
    .reduce((sum: number, t: Transaction) => sum + t.amount, 0)

  // Calculate spending change percentage
  const spendingChange = prevSpending > 0
    ? Math.round(((spending - prevSpending) / prevSpending) * 100)
    : 0

  // Get uncategorized transactions count
  const uncategorizedCount = txs.filter(
    (t: Transaction) => !t.category || t.category.toLowerCase() === 'uncategorized'
  ).length

  // Calculate category breakdown
  const categoryMap = new Map<string, { amount: number; count: number }>()
  const prevCategoryMap = new Map<string, number>()

  txs.forEach((t: Transaction) => {
    if (t.amount > 0 && !t.is_income) {
      const cat = t.category || 'Uncategorized'
      const existing = categoryMap.get(cat) || { amount: 0, count: 0 }
      categoryMap.set(cat, {
        amount: existing.amount + t.amount,
        count: existing.count + 1,
      })
    }
  })

  prevTxs.forEach((t: Transaction) => {
    if (t.amount > 0 && !t.is_income) {
      const cat = t.category || 'Uncategorized'
      prevCategoryMap.set(cat, (prevCategoryMap.get(cat) || 0) + t.amount)
    }
  })

  const categories: CategoryData[] = Array.from(categoryMap.entries())
    .map(([cat, data]) => {
      const prevAmount = prevCategoryMap.get(cat) || 0
      const change = prevAmount > 0
        ? Math.round(((data.amount - prevAmount) / prevAmount) * 100)
        : 0

      return {
        category: cat,
        amount: data.amount,
        percentage: spending > 0 ? Math.round((data.amount / spending) * 100) : 0,
        change,
        transactionCount: data.count,
      }
    })
    .sort((a, b) => b.amount - a.amount)

  // Get monthly data for the bar chart (last 6 months)
  const monthlyData: MonthlyData[] = []
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)

    const { data: monthTxs } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', monthDate.toISOString().split('T')[0])
      .lte('date', monthEnd.toISOString().split('T')[0])
      .neq('ignore_type', 'all')

    const mtxs = monthTxs || []

    const monthIncome = mtxs
      .filter((t: Transaction) => t.amount < 0 || t.is_income)
      .reduce((sum: number, t: Transaction) => sum + Math.abs(t.amount), 0)

    const monthBills = mtxs
      .filter((t: Transaction) => {
        const cat = (t.category || '').toLowerCase()
        return t.amount > 0 && (cat.includes('bill') || cat.includes('utilit'))
      })
      .reduce((sum: number, t: Transaction) => sum + t.amount, 0)

    const monthSpending = mtxs
      .filter((t: Transaction) => t.amount > 0 && !t.is_income)
      .reduce((sum: number, t: Transaction) => sum + t.amount, 0)

    monthlyData.push({
      month: monthDate.toLocaleDateString('en-US', { month: 'short' }),
      year: monthDate.getFullYear(),
      income: monthIncome,
      bills: monthBills,
      spending: monthSpending,
    })
  }

  // Get frequent spending merchants
  const merchantCounts = new Map<string, { count: number; total: number }>()
  txs.forEach((t: Transaction) => {
    if (t.amount > 0) {
      const name = t.display_name || t.merchant_name || t.name
      const existing = merchantCounts.get(name) || { count: 0, total: 0 }
      merchantCounts.set(name, {
        count: existing.count + 1,
        total: existing.total + t.amount,
      })
    }
  })

  const frequentMerchants = Array.from(merchantCounts.entries())
    .map(([name, data]) => ({
      name,
      count: data.count,
      total: data.total,
      average: data.total / data.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Get largest purchases
  const largestPurchases = txs
    .filter((t: Transaction) => t.amount > 0)
    .sort((a: Transaction, b: Transaction) => b.amount - a.amount)
    .slice(0, 5)
    .map((t: Transaction) => ({
      id: t.id,
      name: t.display_name || t.merchant_name || t.name,
      amount: t.amount,
      date: t.date,
    }))

  return NextResponse.json({
    period: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    },
    summary: {
      income,
      bills,
      spending,
      spendingChange,
    },
    uncategorizedCount,
    categories,
    monthlyData,
    frequentMerchants,
    largestPurchases,
    transactions: txs,
  })
}
