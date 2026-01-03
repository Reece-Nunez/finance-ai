import { SupabaseClient } from '@supabase/supabase-js'
import {
  ParsedFilters,
  SearchTransaction,
  SearchSummary,
  SearchComparison,
  CategoryBreakdown,
} from '@/types/search'

export const SEARCH_PARSER_SYSTEM_PROMPT = `You are a financial data query parser. Your job is to convert natural language questions about transactions into structured search filters.

Today's date is: {{CURRENT_DATE}}

When parsing queries:
1. For "December" or other months without a year, assume the most recent occurrence (current year, or last year if the month hasn't occurred yet this year)
2. Merchant matching should be case-insensitive and partial (e.g., "Amazon" matches "AMAZON.COM" and "Amazon Prime")
3. For spending queries, default to expenses only (positive amounts = expenses in this system)
4. For income queries, filter to negative amounts or is_income=true
5. When users ask "how much", they want a total (sum aggregation)
6. When users ask "show me" or "list", they want individual transactions
7. When users ask "average" or "typical", they want the average aggregation
8. For comparison queries like "vs" or "compared to", identify both time periods
9. Common date phrases:
   - "last month" = the previous calendar month
   - "this month" = current calendar month
   - "this year" = January 1 to today
   - "last year" = previous calendar year
   - "last week" = previous 7 days
   - "last 30 days" = previous 30 days

Return structured filters using the extract_search_filters tool. Always include a human-readable summary of what you understood.`

export const SEARCH_FILTER_TOOL = {
  name: 'extract_search_filters',
  description:
    'Extract structured search filters from a natural language query about transactions',
  input_schema: {
    type: 'object' as const,
    properties: {
      summary: {
        type: 'string',
        description:
          'A brief human-readable summary of what the query is asking for (e.g., "Amazon spending in December 2025")',
      },
      resultType: {
        type: 'string',
        enum: ['transactions', 'summary', 'comparison'],
        description:
          'transactions = list of individual transactions, summary = aggregated total/average, comparison = comparing two time periods',
      },
      dateRange: {
        type: 'object',
        properties: {
          start: {
            type: 'string',
            description: 'Start date in YYYY-MM-DD format',
          },
          end: { type: 'string', description: 'End date in YYYY-MM-DD format' },
        },
        required: ['start', 'end'],
      },
      amount: {
        type: 'object',
        properties: {
          operator: {
            type: 'string',
            enum: ['gt', 'lt', 'eq', 'gte', 'lte', 'between'],
          },
          value: { type: 'number' },
          value2: {
            type: 'number',
            description: 'Second value for between operator',
          },
        },
        required: ['operator', 'value'],
      },
      merchant: {
        type: 'string',
        description: 'Merchant name to search for (partial match)',
      },
      category: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Categories to filter by (e.g., ["Food & Dining", "Groceries"])',
      },
      transactionType: {
        type: 'string',
        enum: ['income', 'expense', 'all'],
        description: 'Filter by income or expense transactions',
      },
      aggregation: {
        type: 'string',
        enum: ['none', 'sum', 'average', 'count'],
        description: 'How to aggregate results',
      },
      groupBy: {
        type: 'string',
        enum: ['category', 'merchant', 'month'],
        description: 'Group results by this field',
      },
      compareTo: {
        type: 'object',
        properties: {
          start: { type: 'string' },
          end: { type: 'string' },
        },
        required: ['start', 'end'],
        description: 'Second time period for comparison queries',
      },
      sortBy: {
        type: 'string',
        enum: ['date', 'amount'],
      },
      sortOrder: {
        type: 'string',
        enum: ['asc', 'desc'],
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default 50)',
      },
    },
    required: ['summary', 'resultType'],
  },
}

export function parseToolResult(input: unknown): ParsedFilters {
  const data = input as Record<string, unknown>

  return {
    summary: (data.summary as string) || 'Transaction search',
    resultType: (data.resultType as ParsedFilters['resultType']) || 'transactions',
    dateRange: data.dateRange as ParsedFilters['dateRange'],
    amount: data.amount as ParsedFilters['amount'],
    merchant: data.merchant as string | undefined,
    category: data.category as string[] | undefined,
    transactionType: data.transactionType as ParsedFilters['transactionType'],
    aggregation: data.aggregation as ParsedFilters['aggregation'],
    groupBy: data.groupBy as ParsedFilters['groupBy'],
    compareTo: data.compareTo as ParsedFilters['compareTo'],
    sortBy: data.sortBy as ParsedFilters['sortBy'],
    sortOrder: data.sortOrder as ParsedFilters['sortOrder'],
    limit: data.limit as number | undefined,
  }
}

export async function executeSearch(
  supabase: SupabaseClient,
  userId: string,
  filters: ParsedFilters
): Promise<{
  transactions?: SearchTransaction[]
  summary?: SearchSummary
  comparison?: SearchComparison
}> {
  if (filters.resultType === 'comparison' && filters.compareTo) {
    return executeComparisonQuery(supabase, userId, filters)
  }

  if (
    filters.resultType === 'summary' ||
    filters.aggregation === 'sum' ||
    filters.aggregation === 'average'
  ) {
    return executeSummaryQuery(supabase, userId, filters)
  }

  return executeTransactionQuery(supabase, userId, filters)
}

async function executeTransactionQuery(
  supabase: SupabaseClient,
  userId: string,
  filters: ParsedFilters
): Promise<{ transactions: SearchTransaction[] }> {
  let query = supabase
    .from('transactions')
    .select(
      'id, name, merchant_name, display_name, amount, date, category, ai_category, is_income, pending, plaid_account_id'
    )
    .eq('user_id', userId)
    .neq('ignore_type', 'all')

  // Apply date filter
  if (filters.dateRange) {
    query = query
      .gte('date', filters.dateRange.start)
      .lte('date', filters.dateRange.end)
  }

  // Apply merchant filter (case-insensitive partial match)
  if (filters.merchant) {
    query = query.or(
      `name.ilike.%${filters.merchant}%,merchant_name.ilike.%${filters.merchant}%,display_name.ilike.%${filters.merchant}%`
    )
  }

  // Apply category filter
  if (filters.category && filters.category.length > 0) {
    const categoryFilters = filters.category
      .map((cat) => `category.ilike.%${cat}%`)
      .join(',')
    query = query.or(categoryFilters)
  }

  // Apply transaction type filter
  if (filters.transactionType === 'expense') {
    query = query.gt('amount', 0).eq('is_income', false)
  } else if (filters.transactionType === 'income') {
    query = query.or('amount.lt.0,is_income.eq.true')
  }

  // Apply amount filter
  if (filters.amount) {
    const absValue = Math.abs(filters.amount.value)
    switch (filters.amount.operator) {
      case 'gt':
        query = query.gt('amount', absValue)
        break
      case 'gte':
        query = query.gte('amount', absValue)
        break
      case 'lt':
        query = query.lt('amount', absValue)
        break
      case 'lte':
        query = query.lte('amount', absValue)
        break
      case 'eq':
        query = query.eq('amount', absValue)
        break
      case 'between':
        if (filters.amount.value2) {
          query = query
            .gte('amount', Math.min(absValue, Math.abs(filters.amount.value2)))
            .lte('amount', Math.max(absValue, Math.abs(filters.amount.value2)))
        }
        break
    }
  }

  // Apply sorting
  const sortField = filters.sortBy || 'date'
  const sortAsc = filters.sortOrder === 'asc'
  query = query.order(sortField, { ascending: sortAsc })

  // Apply limit
  const limit = filters.limit || 50
  query = query.limit(limit)

  const { data, error } = await query

  if (error) {
    console.error('Transaction query error:', error)
    return { transactions: [] }
  }

  return { transactions: data as SearchTransaction[] }
}

async function executeSummaryQuery(
  supabase: SupabaseClient,
  userId: string,
  filters: ParsedFilters
): Promise<{ summary: SearchSummary }> {
  // First get the raw transactions matching the filter
  let query = supabase
    .from('transactions')
    .select('amount, category, is_income')
    .eq('user_id', userId)
    .neq('ignore_type', 'all')

  if (filters.dateRange) {
    query = query
      .gte('date', filters.dateRange.start)
      .lte('date', filters.dateRange.end)
  }

  if (filters.merchant) {
    query = query.or(
      `name.ilike.%${filters.merchant}%,merchant_name.ilike.%${filters.merchant}%,display_name.ilike.%${filters.merchant}%`
    )
  }

  if (filters.category && filters.category.length > 0) {
    const categoryFilters = filters.category
      .map((cat) => `category.ilike.%${cat}%`)
      .join(',')
    query = query.or(categoryFilters)
  }

  if (filters.transactionType === 'expense') {
    query = query.gt('amount', 0).eq('is_income', false)
  } else if (filters.transactionType === 'income') {
    query = query.or('amount.lt.0,is_income.eq.true')
  }

  if (filters.amount) {
    const absValue = Math.abs(filters.amount.value)
    switch (filters.amount.operator) {
      case 'gt':
        query = query.gt('amount', absValue)
        break
      case 'gte':
        query = query.gte('amount', absValue)
        break
      case 'lt':
        query = query.lt('amount', absValue)
        break
      case 'lte':
        query = query.lte('amount', absValue)
        break
    }
  }

  const { data, error } = await query

  if (error) {
    console.error('Summary query error:', error)
    return { summary: { total: 0, count: 0 } }
  }

  const transactions = data || []
  const count = transactions.length

  // Calculate totals - use absolute values for expenses
  const total = transactions.reduce((sum, tx) => {
    const amt = tx.is_income || tx.amount < 0 ? Math.abs(tx.amount) : tx.amount
    return sum + amt
  }, 0)

  const average = count > 0 ? total / count : 0

  // Calculate category breakdown if groupBy is category or no specific category filter
  let breakdown: CategoryBreakdown[] | undefined
  if (filters.groupBy === 'category' || !filters.category) {
    const categoryMap = new Map<string, { total: number; count: number }>()

    transactions.forEach((tx) => {
      const cat = tx.category || 'Uncategorized'
      const existing = categoryMap.get(cat) || { total: 0, count: 0 }
      const amt = tx.is_income || tx.amount < 0 ? Math.abs(tx.amount) : tx.amount
      categoryMap.set(cat, {
        total: existing.total + amt,
        count: existing.count + 1,
      })
    })

    breakdown = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
        percentage: total > 0 ? Math.round((data.total / total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }

  return {
    summary: {
      total: Math.round(total * 100) / 100,
      average: Math.round(average * 100) / 100,
      count,
      breakdown,
    },
  }
}

async function executeComparisonQuery(
  supabase: SupabaseClient,
  userId: string,
  filters: ParsedFilters
): Promise<{ comparison: SearchComparison }> {
  // Query period 1
  const period1Result = await executeSummaryQuery(supabase, userId, {
    ...filters,
    resultType: 'summary',
  })

  // Query period 2
  const period2Filters: ParsedFilters = {
    ...filters,
    dateRange: filters.compareTo,
    resultType: 'summary',
  }
  const period2Result = await executeSummaryQuery(supabase, userId, period2Filters)

  const p1Total = period1Result.summary?.total || 0
  const p2Total = period2Result.summary?.total || 0
  const difference = p1Total - p2Total
  const percentageChange = p2Total > 0 ? Math.round(((p1Total - p2Total) / p2Total) * 100) : 0

  return {
    comparison: {
      period1: {
        label: formatDateRange(filters.dateRange?.start, filters.dateRange?.end),
        start: filters.dateRange?.start || '',
        end: filters.dateRange?.end || '',
        total: p1Total,
        count: period1Result.summary?.count || 0,
      },
      period2: {
        label: formatDateRange(filters.compareTo?.start, filters.compareTo?.end),
        start: filters.compareTo?.start || '',
        end: filters.compareTo?.end || '',
        total: p2Total,
        count: period2Result.summary?.count || 0,
      },
      difference,
      percentageChange,
    },
  }
}

function formatDateRange(start?: string, end?: string): string {
  if (!start || !end) return 'Unknown period'

  const startDate = new Date(start)
  const endDate = new Date(end)

  const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' })
  const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' })
  const startYear = startDate.getFullYear()
  const endYear = endDate.getFullYear()

  // Same month
  if (startMonth === endMonth && startYear === endYear) {
    return `${startMonth} ${startYear}`
  }

  // Different months, same year
  if (startYear === endYear) {
    return `${startMonth} - ${endMonth} ${startYear}`
  }

  // Different years
  return `${startMonth} ${startYear} - ${endMonth} ${endYear}`
}
