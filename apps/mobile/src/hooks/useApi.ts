import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'

// Query keys
export const queryKeys = {
  accounts: ['accounts'] as const,
  transactions: (params?: Parameters<typeof api.getTransactions>[0]) =>
    ['transactions', params] as const,
  spending: (period: string) => ['spending', period] as const,
  budgets: ['budgets'] as const,
  recurring: ['recurring'] as const,
  insights: ['insights'] as const,
  subscription: ['subscription'] as const,
  profile: ['profile'] as const,
  chatSessions: ['chatSessions'] as const,
}

// Accounts
export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: api.getAccounts,
  })
}

// Transactions
export function useTransactions(params?: Parameters<typeof api.getTransactions>[0]) {
  return useQuery({
    queryKey: queryKeys.transactions(params),
    queryFn: () => api.getTransactions(params),
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof api.updateTransaction>[1] }) =>
      api.updateTransaction(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['spending'] })
    },
  })
}

// Spending
export function useSpending(period = 'this_month') {
  return useQuery({
    queryKey: queryKeys.spending(period),
    queryFn: () => api.getSpending(period),
  })
}

// Budgets
export function useBudgets() {
  return useQuery({
    queryKey: queryKeys.budgets,
    queryFn: api.getBudgets,
  })
}

export function useCreateBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ category, amount }: { category: string; amount: number }) =>
      api.createBudget(category, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets })
    },
  })
}

export function useDeleteBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.deleteBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets })
    },
  })
}

// Recurring
export function useRecurring() {
  return useQuery({
    queryKey: queryKeys.recurring,
    queryFn: api.getRecurring,
  })
}

// AI Insights
export function useInsights() {
  return useQuery({
    queryKey: queryKeys.insights,
    queryFn: api.getInsights,
  })
}

// Subscription
export function useSubscription() {
  return useQuery({
    queryKey: queryKeys.subscription,
    queryFn: api.getSubscription,
  })
}

// Profile
export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: api.getProfile,
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile })
    },
  })
}

// Plaid
export function useCreateLinkToken() {
  return useMutation({
    mutationFn: api.createLinkToken,
  })
}

export function useExchangeToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ publicToken, metadata }: { publicToken: string; metadata: unknown }) =>
      api.exchangeToken(publicToken, metadata),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts })
    },
  })
}

export function useSyncTransactions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.syncTransactions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['spending'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts })
    },
  })
}
