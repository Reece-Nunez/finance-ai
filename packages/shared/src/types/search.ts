export interface ParsedFilters {
  summary: string
  resultType: 'transactions' | 'summary' | 'comparison'

  dateRange?: {
    start: string
    end: string
  }

  amount?: {
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'between'
    value: number
    value2?: number
  }

  merchant?: string
  category?: string[]
  transactionType?: 'income' | 'expense' | 'all'
  aggregation?: 'none' | 'sum' | 'average' | 'count'
  groupBy?: 'category' | 'merchant' | 'month'

  compareTo?: {
    start: string
    end: string
  }

  limit?: number
  sortBy?: 'date' | 'amount'
  sortOrder?: 'asc' | 'desc'
}

export interface CategoryBreakdown {
  category: string
  total: number
  count: number
  percentage: number
}

export interface SearchSummary {
  total: number
  average?: number
  count: number
  breakdown?: CategoryBreakdown[]
}

export interface SearchComparison {
  period1: {
    label: string
    start: string
    end: string
    total: number
    count: number
  }
  period2: {
    label: string
    start: string
    end: string
    total: number
    count: number
  }
  difference: number
  percentageChange: number
}

export interface SearchResponse {
  interpretation: {
    summary: string
    filters: ParsedFilters
  }
  resultType: 'transactions' | 'summary' | 'comparison'
  transactions?: {
    items: Array<{
      id: string
      name: string
      merchant_name: string | null
      display_name: string | null
      amount: number
      date: string
      category: string | null
      ai_category: string | null
      is_income: boolean
      pending: boolean
      plaid_account_id: string
    }>
    total: number
    hasMore: boolean
  }
  summary?: SearchSummary
  comparison?: SearchComparison
  error?: string
}
