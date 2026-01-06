import { useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import Svg, { Circle, G, Path } from 'react-native-svg'

import { useSpending } from '@/hooks/useApi'
import { formatCurrency, formatPercent } from '@/utils/format'
import { CATEGORY_COLORS, formatCategoryName } from '@sterling/shared'

type Period = 'this_month' | 'last_month' | 'last_90_days' | 'this_year'

const periodLabels: Record<Period, string> = {
  this_month: 'This Month',
  last_month: 'Last Month',
  last_90_days: 'Last 3 Months',
  this_year: 'This Year',
}

// Fallback color palette for categories
const CHART_COLORS = [
  '#f97316', // orange
  '#3b82f6', // blue
  '#22c55e', // green
  '#a855f7', // purple
  '#ec4899', // pink
  '#eab308', // yellow
  '#14b8a6', // teal
  '#ef4444', // red
]

// Generate donut chart segments
function getDonutSegments(categories: { category: string; amount: number; percentage: number }[], radius: number, strokeWidth: number) {
  const circumference = 2 * Math.PI * radius
  let currentOffset = 0

  return categories.slice(0, 6).map((cat, index) => {
    const segmentLength = (cat.percentage / 100) * circumference
    const offset = currentOffset
    currentOffset += segmentLength

    return {
      ...cat,
      offset,
      segmentLength,
      circumference,
      chartColor: CHART_COLORS[index % CHART_COLORS.length],
    }
  })
}

export default function SpendingScreen() {
  const router = useRouter()
  const [period, setPeriod] = useState<Period>('this_month')
  const [refreshing, setRefreshing] = useState(false)

  const { data, isLoading, refetch } = useSpending(period)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const getCategoryColor = (category: string) => {
    return (CATEGORY_COLORS as Record<string, string>)[category] || '#64748b'
  }

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-slate-950 items-center justify-center">
        <ActivityIndicator color="#fff" size="large" />
      </SafeAreaView>
    )
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
        <View className="px-5 pt-4 pb-2">
          <Text className="text-white text-2xl font-bold">Spending</Text>
        </View>

        {/* Period Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-5 py-3"
        >
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              className={`px-4 py-2 rounded-full mr-2 ${
                period === p ? 'bg-white' : 'bg-slate-800'
              }`}
              onPress={() => setPeriod(p)}
            >
              <Text
                className={`text-sm font-medium ${
                  period === p ? 'text-slate-950' : 'text-slate-400'
                }`}
              >
                {periodLabels[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Summary Cards */}
        <View className="px-5 py-2">
          <View className="flex-row space-x-3">
            {/* Income */}
            <View className="flex-1 bg-slate-900 rounded-xl p-4 border border-slate-800">
              <View className="flex-row items-center justify-between">
                <Text className="text-slate-400 text-sm">Income</Text>
                <Ionicons name="arrow-up" size={16} color="#22c55e" />
              </View>
              <Text className="text-emerald-500 text-xl font-bold mt-1">
                {formatCurrency(data?.summary?.income || 0)}
              </Text>
            </View>

            {/* Spending */}
            <View className="flex-1 bg-slate-900 rounded-xl p-4 border border-slate-800 ml-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-slate-400 text-sm">Spending</Text>
                <Ionicons name="arrow-down" size={16} color="#ef4444" />
              </View>
              <Text className="text-white text-xl font-bold mt-1">
                {formatCurrency(data?.summary?.spending || 0)}
              </Text>
              {data?.summary?.spendingChange !== undefined && (
                <Text
                  className={`text-xs mt-1 ${
                    data.summary.spendingChange >= 0 ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {formatPercent(data.summary.spendingChange)} vs last period
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Uncategorized Alert */}
        {(data?.uncategorizedCount ?? 0) > 0 && (
          <TouchableOpacity
            className="mx-5 mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex-row items-center"
            onPress={() => router.push('/spending/uncategorized' as never)}
          >
            <View className="w-10 h-10 bg-amber-500/20 rounded-full items-center justify-center">
              <Ionicons name="alert" size={20} color="#f59e0b" />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-amber-500 font-medium">
                {data?.uncategorizedCount} uncategorized
              </Text>
              <Text className="text-amber-500/70 text-sm">
                Tap to review and categorize
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#f59e0b" />
          </TouchableOpacity>
        )}

        {/* Donut Chart */}
        {data?.categories && data.categories.length > 0 && (() => {
          const segments = getDonutSegments(data.categories, 70, 24)
          return (
            <View className="mx-5 mt-6 bg-slate-900 rounded-2xl p-5 border border-slate-800 items-center">
              <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={200} height={200} style={{ position: 'absolute' }}>
                  {/* Background circle */}
                  <Circle
                    cx={100}
                    cy={100}
                    r={70}
                    stroke="#1e293b"
                    strokeWidth={24}
                    fill="transparent"
                  />
                  {/* Category segments */}
                  {segments.map((segment) => (
                    <Circle
                      key={segment.category}
                      cx={100}
                      cy={100}
                      r={70}
                      stroke={segment.chartColor}
                      strokeWidth={24}
                      fill="transparent"
                      strokeDasharray={`${segment.segmentLength} ${segment.circumference - segment.segmentLength}`}
                      strokeDashoffset={-segment.offset}
                      rotation={-90}
                      origin="100, 100"
                    />
                  ))}
                </Svg>
                {/* Center Content */}
                <View style={{ alignItems: 'center' }}>
                  <Text className="text-slate-400 text-xs uppercase">Total</Text>
                  <Text className="text-white text-xl font-bold">
                    {formatCurrency(data?.summary?.spending || 0)}
                  </Text>
                  {data?.summary?.spendingChange !== undefined && (
                    <View className="flex-row items-center mt-1">
                      <Ionicons
                        name={data.summary.spendingChange >= 0 ? 'arrow-up' : 'arrow-down'}
                        size={12}
                        color={data.summary.spendingChange >= 0 ? '#ef4444' : '#22c55e'}
                      />
                      <Text
                        className={`text-xs ${
                          data.summary.spendingChange >= 0 ? 'text-red-400' : 'text-emerald-400'
                        }`}
                      >
                        {Math.abs(data.summary.spendingChange).toFixed(0)}%
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Legend */}
              <View className="flex-row flex-wrap justify-center mt-4 gap-x-4 gap-y-2">
                {segments.map((segment) => (
                  <View key={segment.category} className="flex-row items-center">
                    <View
                      className="w-2.5 h-2.5 rounded-full mr-1.5"
                      style={{ backgroundColor: segment.chartColor }}
                    />
                    <Text className="text-slate-400 text-xs">
                      {formatCategoryName(segment.category)} ({segment.percentage?.toFixed(0)}%)
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )
        })()}

        {/* Categories */}
        <View className="px-5 mt-6 mb-2">
          <Text className="text-white text-lg font-semibold">By Category</Text>
        </View>

        <View className="mx-5 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          {data?.categories && data.categories.length > 0 ? (
            data.categories.map((category, index) => (
              <TouchableOpacity
                key={category.category}
                className={`p-4 ${index > 0 ? 'border-t border-slate-800' : ''}`}
                onPress={() => router.push({
                  pathname: '/category/[category]',
                  params: { category: category.category, period }
                })}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center flex-1">
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center"
                      style={{ backgroundColor: getCategoryColor(category.category) + '20' }}
                    >
                      <View
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getCategoryColor(category.category) }}
                      />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white text-base font-medium">
                        {formatCategoryName(category.category)}
                      </Text>
                      <Text className="text-slate-500 text-xs">
                        {category.transactionCount} transactions
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="text-white text-base font-semibold">
                      {formatCurrency(category.amount)}
                    </Text>
                    <View className="flex-row items-center">
                      {category.change !== undefined && category.change !== 0 && (
                        <View className="flex-row items-center mr-1">
                          <Ionicons
                            name={category.change > 0 ? 'arrow-up' : 'arrow-down'}
                            size={10}
                            color={category.change > 0 ? '#ef4444' : '#22c55e'}
                          />
                          <Text
                            className={`text-xs ${
                              category.change > 0 ? 'text-red-400' : 'text-emerald-400'
                            }`}
                          >
                            {Math.abs(category.change)}%
                          </Text>
                        </View>
                      )}
                      <Ionicons name="chevron-forward" size={16} color="#475569" />
                    </View>
                  </View>
                </View>
                {/* Progress Bar */}
                <View className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${category.percentage ?? 0}%`,
                      backgroundColor: getCategoryColor(category.category),
                    }}
                  />
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View className="p-6 items-center">
              <Ionicons name="pie-chart-outline" size={32} color="#475569" />
              <Text className="text-slate-500 text-sm mt-2">
                No spending data yet
              </Text>
            </View>
          )}
        </View>

        {/* Largest Purchases */}
        {data?.largestPurchases && data.largestPurchases.length > 0 && (
          <>
            <View className="px-5 mt-6 mb-2">
              <Text className="text-white text-lg font-semibold">Largest Purchases</Text>
            </View>

            <View className="mx-5 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              {data.largestPurchases.slice(0, 5).map((purchase, index) => (
                <View
                  key={purchase.id}
                  className={`flex-row items-center p-4 ${
                    index > 0 ? 'border-t border-slate-800' : ''
                  }`}
                >
                  <View className="w-8 h-8 bg-slate-800 rounded-full items-center justify-center">
                    <Text className="text-amber-500 text-sm font-bold">
                      {index + 1}
                    </Text>
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-white text-base font-medium" numberOfLines={1}>
                      {purchase.name}
                    </Text>
                    <Text className="text-slate-500 text-sm">
                      {new Date(purchase.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                  <Text className="text-white text-base font-semibold">
                    {formatCurrency(purchase.amount)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Top Merchants */}
        {data?.frequentMerchants && data.frequentMerchants.length > 0 && (
          <>
            <View className="px-5 mt-6 mb-2">
              <Text className="text-white text-lg font-semibold">
                Top Merchants
              </Text>
            </View>

            <View className="mx-5 mb-8 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              {data.frequentMerchants.slice(0, 5).map((merchant, index) => (
                <View
                  key={merchant.name}
                  className={`flex-row items-center p-4 ${
                    index > 0 ? 'border-t border-slate-800' : ''
                  }`}
                >
                  <View className="w-8 h-8 bg-slate-800 rounded-full items-center justify-center">
                    <Text className="text-slate-400 text-sm font-medium">
                      {index + 1}
                    </Text>
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-white text-base font-medium">
                      {merchant.name}
                    </Text>
                    <Text className="text-slate-500 text-sm">
                      {merchant.count} visits
                    </Text>
                  </View>
                  <Text className="text-white text-base font-semibold">
                    {formatCurrency(merchant.total)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
