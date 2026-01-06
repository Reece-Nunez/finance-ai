import { useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'

import { api } from '@/services/api'
import { MerchantLogo } from '@/components/MerchantLogo'
import { TransactionSheet } from '@/components/TransactionSheet'
import { formatCurrency, formatDate } from '@/utils/format'
import { formatCategoryName } from '@sterling/shared'
import type { Transaction } from '@sterling/shared'

type DateFilterType = 'this_month' | 'last_month' | 'last_90_days' | 'this_year' | 'all'

const DATE_FILTERS: { value: DateFilterType; label: string }[] = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_90_days', label: 'Last 3 Months' },
  { value: 'this_year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
]

// Map spending page periods to our date filter
function mapPeriodToDateFilter(period?: string): DateFilterType {
  switch (period) {
    case 'last_month': return 'last_month'
    case 'last_90_days': return 'last_90_days'
    case 'this_year': return 'this_year'
    default: return 'this_month'
  }
}

interface MonthlyData {
  month: string
  year: number
  amount: number
}

export default function CategoryDetailScreen() {
  const router = useRouter()
  const { category, period: initialPeriod } = useLocalSearchParams<{ category: string; period?: string }>()

  const [refreshing, setRefreshing] = useState(false)
  const [dateFilter, setDateFilter] = useState<DateFilterType>(() => mapPeriodToDateFilter(initialPeriod))
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['categorySpending', category, initialPeriod || 'this_month'],
    queryFn: async () => {
      const result = await api.getSpending(initialPeriod || 'this_month')

      // Filter transactions for this category
      const transactions = await api.getTransactions({ limit: 500 })
      const categoryTransactions = transactions.transactions.filter(
        (tx) => tx.category === category
      )

      // Build monthly data for chart
      const monthlyData: MonthlyData[] = []
      const now = new Date()
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthTxs = categoryTransactions.filter((t) => {
          const txDate = new Date(t.date)
          return txDate.getMonth() === monthDate.getMonth() && txDate.getFullYear() === monthDate.getFullYear()
        })
        const amount = monthTxs
          .filter((t) => !t.is_income)
          .reduce((sum, t) => sum + Math.abs(t.amount), 0)

        monthlyData.push({
          month: monthDate.toLocaleDateString('en-US', { month: 'short' }),
          year: monthDate.getFullYear(),
          amount,
        })
      }

      // Get category stats from spending data
      const categoryStats = result.categories?.find((c) => c.category === category)

      return {
        transactions: categoryTransactions,
        monthlyData,
        totalSpend: categoryStats?.amount || 0,
        change: categoryStats?.change || 0,
        transactionCount: categoryStats?.transactionCount || categoryTransactions.length,
      }
    },
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  // Filter transactions by date
  const filteredTransactions = useMemo(() => {
    if (!data?.transactions) return []

    return data.transactions.filter((tx) => {
      const txDate = new Date(tx.date)
      const now = new Date()

      switch (dateFilter) {
        case 'last_month':
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
          return txDate >= lastMonth && txDate <= lastMonthEnd
        case 'last_90_days':
          const ninetyDaysAgo = new Date(now)
          ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
          return txDate >= ninetyDaysAgo
        case 'this_year':
          return txDate.getFullYear() === now.getFullYear()
        case 'all':
          return true
        default: // this_month
          return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear()
      }
    })
  }, [data?.transactions, dateFilter])

  // Calculate filtered total
  const filteredTotal = useMemo(() => {
    return filteredTransactions
      .filter((t) => !t.is_income)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
  }, [filteredTransactions])

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    let currentDate = ''
    return filteredTransactions.map((transaction, index) => {
      const date = new Date(transaction.date).toDateString()
      const showHeader = date !== currentDate
      currentDate = date
      return { transaction, showHeader, dateLabel: formatDate(transaction.date, 'long') }
    })
  }, [filteredTransactions])

  const maxBarValue = useMemo(() => {
    if (!data?.monthlyData) return 0
    return Math.max(...data.monthlyData.map((d) => d.amount)) * 1.1 || 1
  }, [data?.monthlyData])

  if (isLoading && !refreshing) {
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
        <View className="flex-1">
          <Text className="text-white text-xl font-bold">
            {formatCategoryName(category || '')}
          </Text>
          <View className="flex-row items-center">
            <Text className="text-white text-lg font-semibold">
              {formatCurrency(filteredTotal)}
            </Text>
            {data?.change !== undefined && data.change !== 0 && (
              <View className="flex-row items-center ml-2">
                <Ionicons
                  name={data.change > 0 ? 'arrow-up' : 'arrow-down'}
                  size={12}
                  color={data.change > 0 ? '#ef4444' : '#22c55e'}
                />
                <Text
                  className={`text-xs ml-0.5 ${
                    data.change > 0 ? 'text-red-400' : 'text-emerald-400'
                  }`}
                >
                  {Math.abs(data.change)}%
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <FlatList
        data={groupedTransactions}
        keyExtractor={(item) => item.transaction.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
          />
        }
        ListHeaderComponent={
          <>
            {/* Monthly Bar Chart */}
            {data?.monthlyData && data.monthlyData.length > 0 && (
              <View className="mx-5 mb-4 bg-slate-900 rounded-2xl p-4 border border-slate-800">
                <Text className="text-slate-400 text-sm mb-4">Monthly Spending</Text>
                <View className="flex-row items-end justify-between" style={{ height: 140 }}>
                  {data.monthlyData.map((month, index) => {
                    const heightPercent = maxBarValue > 0 ? (month.amount / maxBarValue) * 100 : 0
                    const barHeight = (heightPercent / 100) * 80
                    return (
                      <View key={index} className="items-center flex-1">
                        <Text className="text-slate-500 text-[10px] mb-1" numberOfLines={1}>
                          {month.amount > 0 ? `$${Math.round(month.amount)}` : ''}
                        </Text>
                        <View style={{ height: 80, width: '100%', paddingHorizontal: 4, justifyContent: 'flex-end' }}>
                          <View
                            style={{
                              width: '100%',
                              height: month.amount > 0 ? Math.max(barHeight, 4) : 0,
                              backgroundColor: '#3b82f6',
                              borderTopLeftRadius: 4,
                              borderTopRightRadius: 4,
                            }}
                          />
                        </View>
                        <Text className="text-slate-400 text-xs mt-2">{month.month}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>
            )}

            {/* Date Filter */}
            <View className="mx-5 mb-4 flex-row items-center justify-between">
              <Text className="text-white font-semibold">
                {filteredTransactions.length} Transaction{filteredTransactions.length !== 1 ? 's' : ''}
              </Text>
              <TouchableOpacity
                className="flex-row items-center bg-slate-800 rounded-full px-3 py-2"
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={14} color="#94a3b8" />
                <Text className="text-slate-300 text-xs font-medium ml-1.5">
                  {DATE_FILTERS.find((f) => f.value === dateFilter)?.label}
                </Text>
                <Ionicons name="chevron-down" size={12} color="#64748b" style={{ marginLeft: 2 }} />
              </TouchableOpacity>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <>
            {item.showHeader && (
              <View className="bg-slate-950 px-5 py-2 border-b border-slate-800">
                <Text className="text-slate-400 text-sm font-medium">{item.dateLabel}</Text>
              </View>
            )}
            <TouchableOpacity
              className="flex-row items-center px-5 py-4 bg-slate-950"
              activeOpacity={0.7}
              onPress={() => setSelectedTransaction(item.transaction)}
            >
              <MerchantLogo
                name={item.transaction.merchant_name || item.transaction.name}
                size={44}
              />
              <View className="flex-1 ml-3 mr-3" style={{ flexShrink: 1 }}>
                <Text className="text-white text-base font-medium" numberOfLines={1} ellipsizeMode="tail">
                  {item.transaction.display_name || item.transaction.merchant_name || item.transaction.name}
                </Text>
                <Text className="text-slate-500 text-sm">
                  {formatDate(item.transaction.date, 'short')}
                </Text>
              </View>
              <View className="items-end" style={{ flexShrink: 0 }}>
                <Text
                  className={`text-base font-semibold ${
                    item.transaction.is_income ? 'text-emerald-500' : 'text-white'
                  }`}
                >
                  {item.transaction.is_income ? '+' : '-'}
                  {formatCurrency(Math.abs(item.transaction.amount))}
                </Text>
                {item.transaction.pending && (
                  <View className="bg-amber-500/20 rounded px-1.5 py-0.5 mt-1">
                    <Text className="text-amber-500 text-xs">Pending</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </>
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-12">
            <Ionicons name="receipt-outline" size={48} color="#475569" />
            <Text className="text-slate-400 text-base mt-3 text-center">
              No transactions in this category
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Transaction Detail Sheet */}
      <TransactionSheet
        transaction={selectedTransaction}
        visible={selectedTransaction !== null}
        onClose={() => setSelectedTransaction(null)}
      />

      {/* Date Filter Picker Modal */}
      <Modal
        visible={showDatePicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDatePicker(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/50 justify-end"
          activeOpacity={1}
          onPress={() => setShowDatePicker(false)}
        >
          <View className="bg-slate-900 rounded-t-3xl">
            <View className="p-5 border-b border-slate-800">
              <Text className="text-white text-lg font-semibold text-center">
                Filter by Date
              </Text>
            </View>
            <ScrollView className="max-h-80">
              {DATE_FILTERS.map((option, index) => (
                <TouchableOpacity
                  key={option.value}
                  className={`flex-row items-center justify-between px-5 py-4 ${
                    index < DATE_FILTERS.length - 1 ? 'border-b border-slate-800' : ''
                  }`}
                  onPress={() => {
                    setDateFilter(option.value)
                    setShowDatePicker(false)
                  }}
                >
                  <Text
                    className={`text-base ${
                      dateFilter === option.value ? 'text-white font-medium' : 'text-slate-400'
                    }`}
                  >
                    {option.label}
                  </Text>
                  {dateFilter === option.value && (
                    <Ionicons name="checkmark" size={20} color="#22c55e" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View className="p-5">
              <TouchableOpacity
                className="bg-slate-800 rounded-xl py-4 items-center"
                onPress={() => setShowDatePicker(false)}
              >
                <Text className="text-white font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}
