import { getAccessToken } from './supabase'
import type {
  Transaction,
  Account,
  UserSubscription,
  BudgetAnalytics,
  RecurringResponse,
} from '@sterling/shared'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://joinsterling.com'

// Retry configuration
const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterFactor: 0.3,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
}

class ApiError extends Error {
  status: number
  data: unknown

  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

function isRetryableError(error: unknown): boolean {
  // Network errors are retryable
  if (error instanceof TypeError) {
    const message = error.message.toLowerCase()
    if (
      message.includes('fetch') ||
      message.includes('network') ||
      message.includes('failed to fetch')
    ) {
      return true
    }
  }

  // Check ApiError status codes
  if (error instanceof ApiError) {
    return RETRY_CONFIG.retryableStatuses.includes(error.status)
  }

  return false
}

function calculateDelay(attempt: number): number {
  const exponentialDelay =
    RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1)
  const cappedDelay = Math.min(exponentialDelay, RETRY_CONFIG.maxDelayMs)
  const jitter = cappedDelay * RETRY_CONFIG.jitterFactor * Math.random()
  return Math.floor(cappedDelay + jitter)
}

async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken()

  if (!token) {
    throw new ApiError(401, 'Not authenticated')
  }

  let lastError: Error = new Error('Unknown error')

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      const response = await fetch(`${API_URL}/api${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new ApiError(
          response.status,
          data.error || 'Request failed',
          data
        )
      }

      return data
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry non-retryable errors
      if (!isRetryableError(error)) {
        throw lastError
      }

      // Don't wait after last attempt
      if (attempt === RETRY_CONFIG.maxAttempts) {
        break
      }

      const delayMs = calculateDelay(attempt)
      console.log(
        `[API] Retry attempt ${attempt}/${RETRY_CONFIG.maxAttempts} for ${endpoint} after ${delayMs}ms:`,
        lastError.message
      )

      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}

// API methods
export const api = {
  // Accounts
  getAccounts: () =>
    apiClient<{ accounts: Account[] }>('/accounts'),

  // Transactions
  getTransactions: (params?: {
    limit?: number
    offset?: number
    filter?: 'all' | 'income' | 'expense'
    period?: string
    search?: string
  }) => {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.offset) searchParams.set('offset', String(params.offset))
    if (params?.filter) searchParams.set('filter', params.filter)
    if (params?.period) searchParams.set('period', params.period)
    if (params?.search) searchParams.set('search', params.search)

    const query = searchParams.toString()
    return apiClient<{
      transactions: Transaction[]
      total: number
      hasMore: boolean
    }>(`/transactions${query ? `?${query}` : ''}`)
  },

  updateTransaction: (id: string, updates: Partial<Transaction>) =>
    apiClient<{ transaction: Transaction }>('/transactions', {
      method: 'PATCH',
      body: JSON.stringify({ id, ...updates }),
    }),

  // Spending
  getSpending: (period = 'this_month') =>
    apiClient<{
      period: { start: string; end: string }
      summary: {
        income: number
        bills: number
        spending: number
        spendingChange: number
      }
      uncategorizedCount: number
      categories: Array<{
        category: string
        amount: number
        percentage: number
        change: number
        transactionCount: number
      }>
      monthlyData: Array<{
        month: number
        year: number
        income: number
        bills: number
        spending: number
      }>
      frequentMerchants: Array<{
        name: string
        count: number
        total: number
        average: number
      }>
      largestPurchases: Array<{
        id: string
        name: string
        amount: number
        date: string
      }>
    }>(`/spending?period=${period}`),

  // Budgets
  getBudgets: () =>
    apiClient<BudgetAnalytics>('/budgets/analytics'),

  createBudget: (category: string, amount: number) =>
    apiClient<{ budget: { id: string; category: string; amount: number } }>(
      '/budgets',
      {
        method: 'POST',
        body: JSON.stringify({ category, amount }),
      }
    ),

  deleteBudget: (id: string) =>
    apiClient<{ success: boolean }>(`/budgets?id=${id}`, {
      method: 'DELETE',
    }),

  // Recurring
  getRecurring: () =>
    apiClient<RecurringResponse>('/recurring'),

  updateRecurring: (id: string, updates: { frequency?: string; amount?: number; nextDate?: string }) =>
    apiClient<{ success: boolean; pattern: unknown }>('/recurring', {
      method: 'PATCH',
      body: JSON.stringify({ id, ...updates }),
    }),

  deleteRecurring: (merchantPattern: string, originalName?: string) =>
    apiClient<{ success: boolean }>('/recurring', {
      method: 'DELETE',
      body: JSON.stringify({ merchantPattern, originalName, reason: 'User deleted from mobile' }),
    }),

  // Transaction Rules
  getTransactionRules: () =>
    apiClient<{ rules: Array<{
      id: string
      match_field: string
      match_pattern: string
      display_name: string | null
      set_category: string | null
      set_as_income: boolean
      is_active: boolean
      priority: number
    }> }>('/transaction-rules'),

  createTransactionRule: (rule: {
    match_pattern: string
    match_field?: string
    display_name?: string
    set_category?: string
    set_as_income?: boolean
    apply_to_existing?: boolean
  }) =>
    apiClient<{ rule: unknown }>('/transaction-rules', {
      method: 'POST',
      body: JSON.stringify(rule),
    }),

  deleteTransactionRule: (id: string) =>
    apiClient<{ success: boolean }>(`/transaction-rules?id=${id}`, {
      method: 'DELETE',
    }),

  // AI (Pro features)
  getInsights: () =>
    apiClient<{
      period: {
        month: number
        year: number
        daysLeft: number
        daysPassed: number
        daysInMonth: number
      }
      stats: {
        currentSpending: number
        currentIncome: number
        lastMonthSpending: number
        spendingChange: number
        netCashFlow: number
        totalBalance: number
        totalBudgeted: number
        budgetRemaining: number
        budgetPercentUsed: number
        dailyAverage: number
        projectedSpending: number
        topCategory: string | null
        categoriesOverBudget: number
      }
      healthScore: number
      healthStatus: 'excellent' | 'good' | 'fair' | 'needs_attention'
      insights: Array<{
        title: string
        value: string
        trend?: 'up' | 'down' | 'neutral'
        subtitle?: string
      }>
      suggestions: Array<{
        text: string
        priority: 'high' | 'medium' | 'low'
        type: string
      }>
    }>('/ai/insights'),

  sendChatMessage: (messages: Array<{ role: string; content: string }>, sessionId?: string) =>
    apiClient<{ message: string; session_id: string }>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, session_id: sessionId }),
    }),

  getChatSessions: () =>
    apiClient<{ sessions: Array<{ id: string; title: string; updated_at: string }> }>(
      '/ai/chat'
    ),

  // Subscription
  getSubscription: () =>
    apiClient<UserSubscription>('/subscription'),

  // Plaid
  createLinkToken: () =>
    apiClient<{ link_token: string }>('/plaid/create-link-token', {
      method: 'POST',
    }),

  exchangeToken: (publicToken: string, metadata: unknown) =>
    apiClient<{ success: boolean; item_id: string }>('/plaid/exchange-token', {
      method: 'POST',
      body: JSON.stringify({ public_token: publicToken, metadata }),
    }),

  syncTransactions: (itemId?: string) =>
    apiClient<{ success: boolean; added: number }>('/plaid/sync-transactions', {
      method: 'POST',
      body: JSON.stringify({ item_id: itemId }),
    }),

  disconnectItem: (itemId: string) =>
    apiClient<{ success: boolean }>('/plaid/disconnect', {
      method: 'POST',
      body: JSON.stringify({ item_id: itemId }),
    }),

  // User Profile
  getProfile: () =>
    apiClient<{
      profile: {
        first_name: string
        last_name: string
        phone?: string
        currency: string
        timezone: string
      } | null
      email: string
    }>('/user/profile'),

  updateProfile: (updates: {
    first_name?: string
    last_name?: string
    phone?: string
    currency?: string
    timezone?: string
  }) =>
    apiClient<{ profile: unknown }>('/user/profile', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  // Anomaly Detection (Pro feature)
  getAnomalies: (status = 'pending') =>
    apiClient<{
      anomalies: Array<{
        id: string
        transaction_id: string | null
        anomaly_type: string
        severity: 'low' | 'medium' | 'high' | 'critical'
        title: string
        description: string
        merchant_name: string | null
        amount: number | null
        expected_amount: number | null
        deviation_percent: number | null
        status: string
        detected_at: string
      }>
    }>(`/anomalies?status=${status}`),

  updateAnomaly: (id: string, status: string, feedback?: string) =>
    apiClient<{ success: boolean }>('/anomalies', {
      method: 'PATCH',
      body: JSON.stringify({ id, status, user_feedback: feedback }),
    }),

  // Cash Flow Forecast (Pro feature)
  getCashFlowForecast: (days = 30) =>
    apiClient<{
      forecast: {
        currentBalance: number
        projectedEndBalance: number
        lowestBalance: number
        lowestBalanceDate: string
        totalIncome: number
        totalExpenses: number
        netCashFlow: number
        dailyForecasts: Array<{
          date: string
          projectedBalance: number
          isLowBalance: boolean
          isNegative: boolean
        }>
        alerts: Array<{
          type: string
          message: string
          severity: 'warning' | 'critical'
        }>
        confidence: 'high' | 'medium' | 'low'
      }
      summary: string
      dailySpendingRate: number
      upcomingRecurring: Array<{
        id: string
        name: string
        amount: number
        nextDate: string
        isIncome: boolean
      }>
    }>(`/cash-flow/forecast?days=${days}`),
}
