import { getAccessToken } from './supabase'
import type {
  Transaction,
  Account,
  UserSubscription,
  BudgetAnalytics,
  RecurringResponse,
} from '@sterling/shared'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://joinsterling.com'

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

async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken()

  if (!token) {
    throw new ApiError(401, 'Not authenticated')
  }

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
    throw new ApiError(response.status, data.error || 'Request failed', data)
  }

  return data
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
}
