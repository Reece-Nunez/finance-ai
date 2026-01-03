export interface ParsedFilters {
  summary: string
  resultType: 'transactions' | 'summary' | 'comparison'

  // Date filters
  dateRange?: {
    start: string // ISO date YYYY-MM-DD
    end: string
  }

  // Amount filters
  amount?: {
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'between'
    value: number
    value2?: number // For 'between' operator
  }

  // Entity filters
  merchant?: string // Partial match, case-insensitive
  category?: string[] // One or more categories

  // Type filters
  transactionType?: 'income' | 'expense' | 'all'

  // Aggregation
  aggregation?: 'none' | 'sum' | 'average' | 'count'
  groupBy?: 'category' | 'merchant' | 'month'

  // Comparison (second period)
  compareTo?: {
    start: string
    end: string
  }

  // Pagination & sorting
  limit?: number
  sortBy?: 'date' | 'amount'
  sortOrder?: 'asc' | 'desc'
}

export interface SearchTransaction {
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
    items: SearchTransaction[]
    total: number
    hasMore: boolean
  }
  summary?: SearchSummary
  comparison?: SearchComparison
  error?: string
}

export interface SearchRequest {
  query: string
}
