import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useCallback, useState } from 'react'

import { useAccounts, useTransactions, useInsights } from '@/hooks/useApi'
import { useAuth } from '@/hooks/useAuth'
import { MerchantLogo } from '@/components/MerchantLogo'
import { formatCurrency, formatDate } from '@/utils/format'
import { formatCategoryName } from '@sterling/shared'

export default function DashboardScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const [refreshing, setRefreshing] = useState(false)

  const { data: accountsData, refetch: refetchAccounts } = useAccounts()
  const { data: transactionsData, refetch: refetchTransactions } = useTransactions({ limit: 5 })
  const { data: insightsData, refetch: refetchInsights } = useInsights()

  const accounts = accountsData?.accounts || []
  const transactions = transactionsData?.transactions || []
  const insights = insightsData

  // Calculate balances by account type
  // Depository (checking/savings) = spendable cash
  // Credit/Loan = debt (shown as negative in Plaid)
  // Investment = assets
  const cashBalance = accounts
    .filter(acc => acc.type === 'depository')
    .reduce((sum, acc) => sum + (acc.current_balance || 0), 0)

  const investmentBalance = accounts
    .filter(acc => acc.type === 'investment')
    .reduce((sum, acc) => sum + (acc.current_balance || 0), 0)

  const debtBalance = accounts
    .filter(acc => acc.type === 'credit' || acc.type === 'loan')
    .reduce((sum, acc) => sum + Math.abs(acc.current_balance || 0), 0)

  // Total balance = cash + investments (what user "has")
  const totalBalance = cashBalance + investmentBalance

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([refetchAccounts(), refetchTransactions(), refetchInsights()])
    setRefreshing(false)
  }, [refetchAccounts, refetchTransactions, refetchInsights])

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return '#22c55e'
    if (score >= 60) return '#eab308'
    if (score >= 40) return '#f97316'
    return '#ef4444'
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={['top']}>
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
          />
        }
      >
        {/* Header */}
        <View className="px-5 pt-4 pb-6">
          <Text className="text-slate-400 text-sm">Welcome back,</Text>
          <Text className="text-white text-2xl font-bold">
            {user?.user_metadata?.firstName || 'User'}
          </Text>
        </View>

        {/* Total Balance Card */}
        <View className="mx-5 bg-slate-900 rounded-2xl p-5 border border-slate-800">
          <Text className="text-slate-400 text-sm mb-1">Total Balance</Text>
          <Text className="text-white text-3xl font-bold">
            {formatCurrency(totalBalance)}
          </Text>
          <View className="flex-row items-center mt-3">
            <View className="flex-row items-center bg-slate-800 rounded-full px-3 py-1">
              <Ionicons name="trending-up" size={14} color="#22c55e" />
              <Text className="text-emerald-500 text-xs ml-1 font-medium">
                {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'} linked
              </Text>
            </View>
          </View>
        </View>

        {/* Health Score & Quick Stats */}
        <View className="flex-row mx-5 mt-4 space-x-3">
          {/* Health Score */}
          <TouchableOpacity
            className="flex-1 bg-slate-900 rounded-2xl p-4 border border-slate-800"
            onPress={() => router.push('/chat')}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-slate-400 text-sm">Health Score</Text>
              <Ionicons name="heart" size={16} color={getHealthScoreColor(insights?.healthScore || 0)} />
            </View>
            <Text
              className="text-3xl font-bold mt-2"
              style={{ color: getHealthScoreColor(insights?.healthScore || 0) }}
            >
              {insights?.healthScore || '--'}
            </Text>
            <Text className="text-slate-500 text-xs capitalize mt-1">
              {insights?.healthStatus?.replace('_', ' ') || 'Loading...'}
            </Text>
          </TouchableOpacity>

          {/* Monthly Spending */}
          <View className="flex-1 bg-slate-900 rounded-2xl p-4 border border-slate-800 ml-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-slate-400 text-sm">This Month</Text>
              <Ionicons name="arrow-down" size={16} color="#ef4444" />
            </View>
            <Text className="text-white text-2xl font-bold mt-2">
              {formatCurrency(insights?.stats?.currentSpending || 0, { compact: true })}
            </Text>
            <Text className="text-slate-500 text-xs mt-1">
              {insights?.stats?.spendingChange !== undefined
                ? `${insights.stats.spendingChange >= 0 ? '+' : ''}${insights.stats.spendingChange.toFixed(0)}% vs last month`
                : 'Spending'}
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="mx-5 mt-4">
          <View className="flex-row space-x-3">
            <TouchableOpacity
              className="flex-1 bg-white rounded-xl py-3.5 items-center"
              onPress={() => router.push('/accounts')}
            >
              <Ionicons name="add" size={20} color="#020617" />
              <Text className="text-slate-950 text-xs font-medium mt-1">
                Add Account
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-slate-900 rounded-xl py-3.5 items-center border border-slate-800 ml-3"
              onPress={() => router.push('/chat')}
            >
              <Ionicons name="chatbubble-outline" size={20} color="#fff" />
              <Text className="text-white text-xs font-medium mt-1">
                AI Chat
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-slate-900 rounded-xl py-3.5 items-center border border-slate-800 ml-3"
              onPress={() => router.push('/recurring')}
            >
              <Ionicons name="repeat-outline" size={20} color="#fff" />
              <Text className="text-white text-xs font-medium mt-1">
                Recurring
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Accounts */}
        {accounts.length > 0 && (
          <View className="mt-6">
            <View className="flex-row items-center justify-between px-5 mb-3">
              <Text className="text-white text-lg font-semibold">Accounts</Text>
              <TouchableOpacity onPress={() => router.push('/accounts')}>
                <Text className="text-slate-400 text-sm">See All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20 }}
            >
              {accounts.slice(0, 4).map((account, index) => (
                <View
                  key={account.id}
                  className={`bg-slate-900 rounded-xl p-4 border border-slate-800 w-40 ${
                    index > 0 ? 'ml-3' : ''
                  }`}
                >
                  <Text className="text-slate-400 text-xs" numberOfLines={1}>
                    {account.institution_name || 'Account'}
                  </Text>
                  <Text className="text-white text-sm font-medium mt-1" numberOfLines={1}>
                    {account.name}
                  </Text>
                  <Text className="text-white text-lg font-bold mt-2">
                    {formatCurrency(account.current_balance || 0)}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Recent Transactions */}
        <View className="mt-6 mb-8">
          <View className="flex-row items-center justify-between px-5 mb-3">
            <Text className="text-white text-lg font-semibold">Recent Transactions</Text>
            <Link href="/(tabs)/transactions" asChild>
              <TouchableOpacity>
                <Text className="text-slate-400 text-sm">See All</Text>
              </TouchableOpacity>
            </Link>
          </View>
          <View className="mx-5 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            {transactions.length === 0 ? (
              <View className="p-6 items-center">
                <Ionicons name="receipt-outline" size={32} color="#475569" />
                <Text className="text-slate-500 text-sm mt-2">
                  No transactions yet
                </Text>
                <TouchableOpacity
                  className="mt-3 bg-white rounded-lg px-4 py-2"
                  onPress={() => router.push('/accounts')}
                >
                  <Text className="text-slate-950 text-sm font-medium">
                    Connect a Bank
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              transactions.map((transaction, index) => (
                <TouchableOpacity
                  key={transaction.id}
                  className={`flex-row items-center p-4 ${
                    index > 0 ? 'border-t border-slate-800' : ''
                  }`}
                >
                  <MerchantLogo
                    name={transaction.merchant_name || transaction.name}
                    size={40}
                  />
                  <View className="flex-1 ml-3">
                    <Text className="text-white text-sm font-medium" numberOfLines={1}>
                      {transaction.display_name || transaction.merchant_name || transaction.name}
                    </Text>
                    <Text className="text-slate-500 text-xs mt-0.5">
                      {formatDate(transaction.date)}
                      {transaction.category && ` • ${formatCategoryName(transaction.category)}`}
                    </Text>
                  </View>
                  <Text
                    className={`text-sm font-semibold ${
                      transaction.is_income ? 'text-emerald-500' : 'text-white'
                    }`}
                  >
                    {transaction.is_income ? '+' : '-'}
                    {formatCurrency(Math.abs(transaction.amount))}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
