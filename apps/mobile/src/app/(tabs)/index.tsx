import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Image, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useCallback, useState, useMemo } from 'react'
import Svg, { Circle } from 'react-native-svg'

import { useAccounts, useTransactions, useInsights, useRecurring, useSubscription } from '@/hooks/useApi'
import { useAuth } from '@/hooks/useAuth'
import { MerchantLogo } from '@/components/MerchantLogo'
import { AnomalyAlerts } from '@/components/AnomalyAlerts'
import { CashFlowForecast } from '@/components/CashFlowForecast'
import { formatCurrency, formatDate } from '@/utils/format'
import { formatCategoryName } from '@sterling/shared'
import { api } from '@/services/api'

// Sterling logo
const sterlingLogo = require('../../../assets/sterlinglogo.png')

// Time-based greeting
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const { data: accountsData, refetch: refetchAccounts } = useAccounts()
  const { data: transactionsData, refetch: refetchTransactions } = useTransactions({ limit: 5 })
  const { data: insightsData, refetch: refetchInsights, isLoading: insightsLoading } = useInsights()
  const { data: recurringData, refetch: refetchRecurring } = useRecurring()
  const { data: subscriptionData } = useSubscription()

  const isPro = subscriptionData?.tier === 'pro'

  const accounts = accountsData?.accounts || []
  const transactions = transactionsData?.transactions || []
  const insights = insightsData

  // Sync all accounts
  const handleSync = async () => {
    setSyncing(true)
    try {
      await api.syncTransactions()
      await Promise.all([refetchAccounts(), refetchTransactions(), refetchInsights()])
    } catch (error) {
      console.error('Sync failed:', error)
    }
    setSyncing(false)
  }

  // Calculate upcoming bills (next 14 days)
  const upcomingBills = useMemo(() => {
    if (!recurringData?.recurring) return []

    const now = new Date()
    const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

    return recurringData.recurring
      .filter((item: { nextDate?: string; isIncome?: boolean; averageAmount?: number; displayName?: string }) => {
        if (!item.nextDate || item.isIncome || !item.displayName) return false
        if ((item.averageAmount ?? 0) === 0) return false
        const nextDate = new Date(item.nextDate)
        return nextDate >= now && nextDate <= fourteenDaysFromNow
      })
      .sort((a: { nextDate?: string }, b: { nextDate?: string }) => {
        const dateA = new Date(a.nextDate || 0)
        const dateB = new Date(b.nextDate || 0)
        return dateA.getTime() - dateB.getTime()
      })
      .slice(0, 3)
  }, [recurringData?.recurring])

  // Calculate balances by account type
  const cashBalance = accounts
    .filter(acc => acc.type === 'depository')
    .reduce((sum, acc) => sum + (acc.current_balance || 0), 0)

  const investmentBalance = accounts
    .filter(acc => acc.type === 'investment')
    .reduce((sum, acc) => sum + (acc.current_balance || 0), 0)

  const debtBalance = accounts
    .filter(acc => acc.type === 'credit' || acc.type === 'loan')
    .reduce((sum, acc) => sum + Math.abs(acc.current_balance || 0), 0)

  // Net worth = assets - liabilities
  const netWorth = cashBalance + investmentBalance - debtBalance

  // Cash flow this month
  const cashFlow = (insights?.stats?.currentIncome || 0) - (insights?.stats?.currentSpending || 0)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([refetchAccounts(), refetchTransactions(), refetchInsights(), refetchRecurring()])
    setRefreshing(false)
  }, [refetchAccounts, refetchTransactions, refetchInsights, refetchRecurring])

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
        {/* Header with Logo */}
        <View className="px-5 pt-4 pb-4">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <Image
                source={sterlingLogo}
                className="w-10 h-10 rounded-xl"
                resizeMode="contain"
              />
              <Text className="text-white text-xl font-bold ml-2">Sterling</Text>
            </View>
            <View className="flex-row items-center">
              {/* Sync Button */}
              <TouchableOpacity
                onPress={handleSync}
                disabled={syncing}
                className="w-10 h-10 bg-slate-900 rounded-full items-center justify-center mr-2"
              >
                {syncing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="sync-outline" size={20} color="#94a3b8" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/profile')}
                className="w-10 h-10 bg-slate-900 rounded-full items-center justify-center"
              >
                <Ionicons name="person-outline" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>
          <Text className="text-slate-400 text-sm">{getGreeting()},</Text>
          <Text className="text-white text-2xl font-bold">
            {(() => {
              const name = user?.user_metadata?.firstName ||
                user?.user_metadata?.first_name ||
                user?.user_metadata?.full_name?.split(' ')[0] ||
                user?.email?.split('@')[0] ||
                'User'
              return name.charAt(0).toUpperCase() + name.slice(1)
            })()}
          </Text>
        </View>

        {/* Net Worth Card with Gradient */}
        <View className="mx-5 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-5 overflow-hidden">
          <View className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
          <Text className="text-emerald-100 text-sm mb-1">Net Worth</Text>
          <Text className="text-white text-3xl font-bold">
            {formatCurrency(netWorth)}
          </Text>
          <View className="flex-row items-center mt-3 flex-wrap">
            <View className="flex-row items-center bg-white/20 rounded-full px-3 py-1 mr-2 mb-1">
              <Ionicons name="wallet-outline" size={12} color="#fff" />
              <Text className="text-white text-xs ml-1">
                Cash: {formatCurrency(cashBalance, { compact: true })}
              </Text>
            </View>
            {investmentBalance > 0 && (
              <View className="flex-row items-center bg-white/20 rounded-full px-3 py-1 mr-2 mb-1">
                <Ionicons name="trending-up-outline" size={12} color="#fff" />
                <Text className="text-white text-xs ml-1">
                  Invest: {formatCurrency(investmentBalance, { compact: true })}
                </Text>
              </View>
            )}
            {debtBalance > 0 && (
              <View className="flex-row items-center bg-red-500/30 rounded-full px-3 py-1 mb-1">
                <Ionicons name="card-outline" size={12} color="#fca5a5" />
                <Text className="text-red-200 text-xs ml-1">
                  Debt: {formatCurrency(debtBalance, { compact: true })}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Health Score with Ring */}
        <TouchableOpacity
          className="mx-5 mt-4 bg-slate-900 rounded-2xl p-4 border border-slate-800 flex-row items-center"
          onPress={() => router.push('/health')}
        >
          {/* Health Ring */}
          <View style={{ width: 70, height: 70, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={70} height={70} style={{ position: 'absolute' }}>
              <Circle
                cx={35}
                cy={35}
                r={28}
                stroke="#1e293b"
                strokeWidth={6}
                fill="transparent"
              />
              <Circle
                cx={35}
                cy={35}
                r={28}
                stroke={getHealthScoreColor(insights?.healthScore || 0)}
                strokeWidth={6}
                fill="transparent"
                strokeDasharray={2 * Math.PI * 28}
                strokeDashoffset={2 * Math.PI * 28 * (1 - (insights?.healthScore || 0) / 100)}
                strokeLinecap="round"
                rotation={-90}
                origin="35, 35"
              />
            </Svg>
            <Text
              className="text-xl font-bold"
              style={{ color: getHealthScoreColor(insights?.healthScore || 0) }}
            >
              {insights?.healthScore || '--'}
            </Text>
          </View>
          <View className="flex-1 ml-4">
            <Text className="text-white text-lg font-semibold">Financial Health</Text>
            <Text className="text-slate-400 text-sm capitalize mt-0.5">
              {insights?.healthStatus?.replace('_', ' ') || 'Loading...'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#475569" />
        </TouchableOpacity>

        {/* Stats Grid */}
        <View className="flex-row mx-5 mt-3">
          {/* Monthly Spending */}
          <View className="flex-1 bg-slate-900 rounded-xl p-3.5 border border-slate-800">
            <View className="flex-row items-center justify-between">
              <Text className="text-slate-400 text-xs">Spending</Text>
              <Ionicons
                name={(insights?.stats?.spendingChange ?? 0) >= 0 ? 'arrow-up' : 'arrow-down'}
                size={12}
                color={(insights?.stats?.spendingChange ?? 0) >= 0 ? '#ef4444' : '#22c55e'}
              />
            </View>
            <Text className="text-white text-lg font-bold mt-1">
              {formatCurrency(insights?.stats?.currentSpending || 0, { compact: true })}
            </Text>
            <Text className={`text-xs mt-0.5 ${(insights?.stats?.spendingChange ?? 0) >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {insights?.stats?.spendingChange !== undefined
                ? `${insights.stats.spendingChange >= 0 ? '+' : ''}${insights.stats.spendingChange.toFixed(0)}%`
                : ''}
            </Text>
          </View>

          {/* Income */}
          <View className="flex-1 bg-slate-900 rounded-xl p-3.5 border border-slate-800 ml-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-slate-400 text-xs">Income</Text>
              <Ionicons name="arrow-up" size={12} color="#22c55e" />
            </View>
            <Text className="text-emerald-500 text-lg font-bold mt-1">
              {formatCurrency(insights?.stats?.currentIncome || 0, { compact: true })}
            </Text>
            <Text className="text-slate-500 text-xs mt-0.5">This month</Text>
          </View>

          {/* Cash Flow */}
          <View className="flex-1 bg-slate-900 rounded-xl p-3.5 border border-slate-800 ml-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-slate-400 text-xs">Cash Flow</Text>
              <Ionicons
                name={cashFlow >= 0 ? 'trending-up' : 'trending-down'}
                size={12}
                color={cashFlow >= 0 ? '#22c55e' : '#ef4444'}
              />
            </View>
            <Text
              className={`text-lg font-bold mt-1 ${cashFlow >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
            >
              {cashFlow >= 0 ? '+' : ''}{formatCurrency(cashFlow, { compact: true })}
            </Text>
            <Text className="text-slate-500 text-xs mt-0.5">Net</Text>
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

        {/* Pro Features - Anomaly Detection & Cash Flow */}
        {isPro && (
          <View className="mx-5 mt-4 gap-4">
            <AnomalyAlerts />
            <CashFlowForecast />
          </View>
        )}

        {/* Upcoming Bills */}
        {upcomingBills.length > 0 && (
          <View className="mt-6">
            <View className="flex-row items-center justify-between px-5 mb-3">
              <Text className="text-white text-lg font-semibold">Upcoming Bills</Text>
              <TouchableOpacity onPress={() => router.push('/recurring')}>
                <Text className="text-slate-400 text-sm">See All</Text>
              </TouchableOpacity>
            </View>
            <View className="mx-5 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              {upcomingBills.map((item: { id: string; displayName: string; nextDate: string; averageAmount: number }, index: number) => (
                <TouchableOpacity
                  key={item.id}
                  className={`flex-row items-center p-4 ${
                    index > 0 ? 'border-t border-slate-800' : ''
                  }`}
                  onPress={() => router.push('/recurring')}
                >
                  <MerchantLogo name={item.displayName} size={40} />
                  <View className="flex-1 ml-3">
                    <Text className="text-white text-sm font-medium" numberOfLines={1}>
                      {item.displayName}
                    </Text>
                    <Text className="text-slate-500 text-xs mt-0.5">
                      {formatDate(item.nextDate)}
                    </Text>
                  </View>
                  <Text className="text-white text-sm font-semibold">
                    {formatCurrency(Math.abs(item.averageAmount ?? 0))}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

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
