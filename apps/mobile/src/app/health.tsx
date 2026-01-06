import { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Circle } from 'react-native-svg'

import { useInsights } from '@/hooks/useApi'
import { formatCurrency } from '@/utils/format'
import { formatCategoryName } from '@sterling/shared'

export default function HealthScreen() {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const { data: insights, isLoading, refetch } = useInsights()

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22c55e'
    if (score >= 60) return '#eab308'
    if (score >= 40) return '#f97316'
    return '#ef4444'
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'excellent': return 'Excellent'
      case 'good': return 'Good'
      case 'fair': return 'Fair'
      case 'needs_attention': return 'Needs Attention'
      default: return status
    }
  }

  const score = insights?.healthScore ?? 0
  const scoreColor = getScoreColor(score)
  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference - (score / 100) * circumference

  // Calculate individual factor scores
  const stats = insights?.stats || {}
  const budgetPercentUsed = stats.budgetPercentUsed ?? 0
  const spendingChange = stats.spendingChange ?? 0
  const netCashFlow = stats.netCashFlow ?? 0
  const categoriesOverBudget = stats.categoriesOverBudget ?? []

  // Factor breakdown
  const factors = [
    {
      name: 'Budget Adherence',
      score: budgetPercentUsed <= 80 ? 100 : budgetPercentUsed <= 100 ? 70 : 40,
      status: budgetPercentUsed <= 80 ? 'On Track' : budgetPercentUsed <= 100 ? 'Near Limit' : 'Over Budget',
      detail: stats.totalBudgeted > 0
        ? `${Math.round(budgetPercentUsed)}% of budget used`
        : 'No budget set',
      icon: 'wallet-outline' as const,
      color: budgetPercentUsed <= 80 ? '#22c55e' : budgetPercentUsed <= 100 ? '#eab308' : '#ef4444',
    },
    {
      name: 'Cash Flow',
      score: netCashFlow >= 0 ? 100 : 25,
      status: netCashFlow >= 0 ? 'Positive' : 'Negative',
      detail: netCashFlow >= 0
        ? `+${formatCurrency(netCashFlow)} this month`
        : `${formatCurrency(netCashFlow)} this month`,
      icon: 'trending-up-outline' as const,
      color: netCashFlow >= 0 ? '#22c55e' : '#ef4444',
    },
    {
      name: 'Spending Trend',
      score: spendingChange <= 5 ? 100 : spendingChange <= 20 ? 70 : 40,
      status: spendingChange <= 0 ? 'Decreasing' : spendingChange <= 20 ? 'Stable' : 'Increasing',
      detail: `${spendingChange >= 0 ? '+' : ''}${Math.round(spendingChange)}% vs last month`,
      icon: 'analytics-outline' as const,
      color: spendingChange <= 5 ? '#22c55e' : spendingChange <= 20 ? '#eab308' : '#ef4444',
    },
    {
      name: 'Category Control',
      score: categoriesOverBudget.length === 0 ? 100 : Math.max(0, 100 - categoriesOverBudget.length * 30),
      status: categoriesOverBudget.length === 0 ? 'All Good' : `${categoriesOverBudget.length} Over`,
      detail: categoriesOverBudget.length === 0
        ? 'All categories within budget'
        : `${categoriesOverBudget.map(c => formatCategoryName(c)).join(', ')} over budget`,
      icon: 'pie-chart-outline' as const,
      color: categoriesOverBudget.length === 0 ? '#22c55e' : '#ef4444',
    },
  ]

  if (isLoading && !insights) {
    return (
      <SafeAreaView className="flex-1 bg-slate-950 items-center justify-center">
        <ActivityIndicator color="#fff" size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={['top']}>
      {/* Header */}
      <View className="px-5 pt-4 pb-4 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3 w-10 h-10 bg-slate-900 rounded-full items-center justify-center"
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">Financial Health</Text>
      </View>

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
        {/* Score Circle */}
        <View className="items-center py-6">
          <View className="relative">
            <Svg width={140} height={140} className="-rotate-90">
              {/* Background circle */}
              <Circle
                cx={70}
                cy={70}
                r={45}
                stroke="#1e293b"
                strokeWidth={12}
                fill="transparent"
              />
              {/* Progress circle */}
              <Circle
                cx={70}
                cy={70}
                r={45}
                stroke={scoreColor}
                strokeWidth={12}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </Svg>
            <View className="absolute inset-0 items-center justify-center">
              <Text className="text-4xl font-bold" style={{ color: scoreColor }}>
                {score}
              </Text>
              <Text className="text-slate-400 text-xs">/ 100</Text>
            </View>
          </View>
          <Text className="text-white text-xl font-semibold mt-4">
            {getStatusLabel(insights?.healthStatus || 'unknown')}
          </Text>
          <Text className="text-slate-400 text-sm mt-1">
            {insights?.period?.month} {insights?.period?.year}
          </Text>
        </View>

        {/* Score Factors */}
        <View className="mx-5 mb-4">
          <Text className="text-white text-lg font-semibold mb-3">Score Breakdown</Text>
          <View className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            {factors.map((factor, index) => (
              <View
                key={factor.name}
                className={`p-4 ${index > 0 ? 'border-t border-slate-800' : ''}`}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center"
                      style={{ backgroundColor: factor.color + '20' }}
                    >
                      <Ionicons name={factor.icon} size={20} color={factor.color} />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-medium">{factor.name}</Text>
                      <Text className="text-slate-400 text-xs mt-0.5" numberOfLines={1}>
                        {factor.detail}
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="font-semibold" style={{ color: factor.color }}>
                      {factor.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Monthly Stats */}
        <View className="mx-5 mb-4">
          <Text className="text-white text-lg font-semibold mb-3">This Month's Stats</Text>
          <View className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <View className="flex-row flex-wrap">
              <View className="w-1/2 mb-4">
                <Text className="text-slate-400 text-xs">Income</Text>
                <Text className="text-emerald-500 text-lg font-semibold">
                  +{formatCurrency(stats.currentIncome ?? 0)}
                </Text>
              </View>
              <View className="w-1/2 mb-4">
                <Text className="text-slate-400 text-xs">Spending</Text>
                <Text className="text-white text-lg font-semibold">
                  {formatCurrency(stats.currentSpending ?? 0)}
                </Text>
              </View>
              <View className="w-1/2">
                <Text className="text-slate-400 text-xs">Net Cash Flow</Text>
                <Text
                  className="text-lg font-semibold"
                  style={{ color: netCashFlow >= 0 ? '#22c55e' : '#ef4444' }}
                >
                  {netCashFlow >= 0 ? '+' : ''}{formatCurrency(netCashFlow)}
                </Text>
              </View>
              <View className="w-1/2">
                <Text className="text-slate-400 text-xs">Daily Average</Text>
                <Text className="text-white text-lg font-semibold">
                  {formatCurrency(stats.dailyAverage ?? 0)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Budget Overview */}
        {(stats.totalBudgeted ?? 0) > 0 && (
          <View className="mx-5 mb-4">
            <Text className="text-white text-lg font-semibold mb-3">Budget Status</Text>
            <View className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
              <View className="flex-row justify-between mb-3">
                <Text className="text-slate-400">Total Budget</Text>
                <Text className="text-white font-semibold">
                  {formatCurrency(stats.totalBudgeted ?? 0)}
                </Text>
              </View>
              <View className="flex-row justify-between mb-3">
                <Text className="text-slate-400">Spent</Text>
                <Text className="text-white font-semibold">
                  {formatCurrency(stats.currentSpending ?? 0)}
                </Text>
              </View>
              <View className="flex-row justify-between mb-4">
                <Text className="text-slate-400">Remaining</Text>
                <Text
                  className="font-semibold"
                  style={{ color: (stats.budgetRemaining ?? 0) >= 0 ? '#22c55e' : '#ef4444' }}
                >
                  {formatCurrency(stats.budgetRemaining ?? 0)}
                </Text>
              </View>
              {/* Progress bar */}
              <View className="h-3 bg-slate-800 rounded-full overflow-hidden">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(budgetPercentUsed, 100)}%`,
                    backgroundColor: budgetPercentUsed > 100 ? '#ef4444' : budgetPercentUsed > 80 ? '#f59e0b' : '#22c55e',
                  }}
                />
              </View>
              <Text className="text-slate-400 text-xs text-center mt-2">
                {Math.round(budgetPercentUsed)}% used • {insights?.period?.daysLeft ?? 0} days left
              </Text>
            </View>
          </View>
        )}

        {/* Tips to Improve */}
        <View className="mx-5 mb-8">
          <Text className="text-white text-lg font-semibold mb-3">Tips to Improve</Text>
          <View className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            {score >= 80 ? (
              <View className="p-4 flex-row items-center">
                <View className="w-10 h-10 bg-emerald-500/20 rounded-full items-center justify-center">
                  <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-white font-medium">Great job!</Text>
                  <Text className="text-slate-400 text-sm">
                    Your financial health is excellent. Keep it up!
                  </Text>
                </View>
              </View>
            ) : (
              <>
                {netCashFlow < 0 && (
                  <View className="p-4 border-b border-slate-800 flex-row">
                    <View className="w-10 h-10 bg-red-500/20 rounded-full items-center justify-center">
                      <Ionicons name="alert-circle" size={24} color="#ef4444" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-medium">Improve Cash Flow</Text>
                      <Text className="text-slate-400 text-sm">
                        You're spending more than you're earning. Look for areas to cut back.
                      </Text>
                    </View>
                  </View>
                )}
                {budgetPercentUsed > 100 && (
                  <View className="p-4 border-b border-slate-800 flex-row">
                    <View className="w-10 h-10 bg-orange-500/20 rounded-full items-center justify-center">
                      <Ionicons name="wallet" size={24} color="#f97316" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-medium">Stay Within Budget</Text>
                      <Text className="text-slate-400 text-sm">
                        You've exceeded your budget. Review your spending categories.
                      </Text>
                    </View>
                  </View>
                )}
                {spendingChange > 20 && (
                  <View className="p-4 border-b border-slate-800 flex-row">
                    <View className="w-10 h-10 bg-yellow-500/20 rounded-full items-center justify-center">
                      <Ionicons name="trending-up" size={24} color="#eab308" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-medium">Control Spending Growth</Text>
                      <Text className="text-slate-400 text-sm">
                        Your spending increased {Math.round(spendingChange)}% from last month.
                      </Text>
                    </View>
                  </View>
                )}
                {categoriesOverBudget.length > 0 && (
                  <View className="p-4 flex-row">
                    <View className="w-10 h-10 bg-purple-500/20 rounded-full items-center justify-center">
                      <Ionicons name="pie-chart" size={24} color="#a855f7" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-medium">Watch These Categories</Text>
                      <Text className="text-slate-400 text-sm">
                        {categoriesOverBudget.map(c => formatCategoryName(c)).join(', ')} are over budget.
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Ask AI Button */}
        <View className="mx-5 mb-8">
          <TouchableOpacity
            className="bg-white rounded-xl py-4 flex-row items-center justify-center"
            onPress={() => router.push('/chat')}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#020617" />
            <Text className="text-slate-950 font-semibold ml-2">
              Ask Sterling for Advice
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
