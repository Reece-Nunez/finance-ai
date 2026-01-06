import { useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useInfiniteQuery } from '@tanstack/react-query'

import { api } from '@/services/api'
import { MerchantLogo } from '@/components/MerchantLogo'
import { TransactionSheet } from '@/components/TransactionSheet'
import { formatCurrency, formatDate } from '@/utils/format'
import { formatCategoryName } from '@sterling/shared'
import type { Transaction } from '@sterling/shared'

type FilterType = 'all' | 'income' | 'expense'
type DateFilterType = 'today' | 'this_week' | 'this_month' | 'last_3_months' | 'this_year' | 'all_time'

const DATE_FILTERS: { value: DateFilterType; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'this_year', label: 'This Year' },
  { value: 'all_time', label: 'All Time' },
]

const PAGE_SIZE = 20

export default function TransactionsScreen() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [dateFilter, setDateFilter] = useState<DateFilterType>('this_month')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)

  // Use infinite query for pagination
  const {
    data,
    isLoading,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['transactions', filter, search, dateFilter],
    queryFn: async ({ pageParam = 0 }) => {
      const result = await api.getTransactions({
        limit: PAGE_SIZE,
        offset: pageParam,
        filter,
        search: search || undefined,
      })
      return result
    },
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce(
        (sum, page) => sum + page.transactions.length,
        0
      )
      return lastPage.hasMore ? totalFetched : undefined
    },
    initialPageParam: 0,
  })

  // Flatten all pages into a single array
  const allTransactions = useMemo(() => {
    return data?.pages.flatMap((page) => page.transactions) || []
  }, [data])

  // Apply date filter client-side
  const transactions = useMemo(() => {
    if (dateFilter === 'all_time') return allTransactions

    const now = new Date()
    return allTransactions.filter((tx) => {
      const txDate = new Date(tx.date)
      switch (dateFilter) {
        case 'today':
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          return txDate >= today
        case 'this_week':
          const weekAgo = new Date(now)
          weekAgo.setDate(weekAgo.getDate() - 7)
          return txDate >= weekAgo
        case 'this_month':
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          return txDate >= monthStart
        case 'last_3_months':
          const threeMonthsAgo = new Date(now)
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
          return txDate >= threeMonthsAgo
        case 'this_year':
          const yearStart = new Date(now.getFullYear(), 0, 1)
          return txDate >= yearStart
        default:
          return true
      }
    })
  }, [allTransactions, dateFilter])

  // Calculate totals for summary bar
  const totals = useMemo(() => {
    const income = transactions
      .filter((tx) => tx.is_income)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
    const expenses = transactions
      .filter((tx) => !tx.is_income)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
    return { income, expenses, count: transactions.length }
  }, [transactions])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: { title: string; data: Transaction[] }[] = []
    let currentDate = ''

    transactions.forEach((transaction) => {
      const date = new Date(transaction.date).toDateString()
      if (date !== currentDate) {
        currentDate = date
        groups.push({
          title: formatDate(transaction.date, 'long'),
          data: [transaction],
        })
      } else {
        groups[groups.length - 1].data.push(transaction)
      }
    })

    return groups
  }, [transactions])

  const renderTransaction = ({ item: transaction }: { item: Transaction }) => (
    <TouchableOpacity
      className="flex-row items-center px-5 py-4 bg-slate-950"
      activeOpacity={0.7}
      onPress={() => setSelectedTransaction(transaction)}
    >
      <MerchantLogo
        name={transaction.merchant_name || transaction.name}
        size={44}
      />
      <View className="flex-1 ml-3">
        <Text className="text-white text-base font-medium" numberOfLines={1}>
          {transaction.display_name || transaction.merchant_name || transaction.name}
        </Text>
        <View className="flex-row items-center mt-0.5">
          {transaction.category ? (
            <Text className="text-slate-500 text-sm">{formatCategoryName(transaction.category)}</Text>
          ) : (
            <Text className="text-amber-500 text-sm">Uncategorized</Text>
          )}
        </View>
      </View>
      <View className="items-end">
        <Text
          className={`text-base font-semibold ${
            transaction.is_income ? 'text-emerald-500' : 'text-white'
          }`}
        >
          {transaction.is_income ? '+' : '-'}
          {formatCurrency(Math.abs(transaction.amount))}
        </Text>
        {transaction.pending && (
          <View className="bg-amber-500/20 rounded px-1.5 py-0.5 mt-1">
            <Text className="text-amber-500 text-xs">Pending</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )

  const renderSectionHeader = (title: string) => (
    <View className="bg-slate-950 px-5 py-2 border-b border-slate-800">
      <Text className="text-slate-400 text-sm font-medium">{title}</Text>
    </View>
  )

  const FilterButton = ({
    type,
    label,
  }: {
    type: FilterType
    label: string
  }) => (
    <TouchableOpacity
      className={`px-4 py-2 rounded-full mr-2 ${
        filter === type ? 'bg-white' : 'bg-slate-800'
      }`}
      onPress={() => setFilter(type)}
    >
      <Text
        className={`text-sm font-medium ${
          filter === type ? 'text-slate-950' : 'text-slate-400'
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )

  // Render flat list with section headers
  const renderItem = useCallback(
    ({ item, index }: { item: Transaction; index: number }) => {
      // Find if this is the first item of a new date group
      const currentDate = new Date(item.date).toDateString()
      const prevItem = transactions[index - 1]
      const prevDate = prevItem ? new Date(prevItem.date).toDateString() : null
      const showHeader = currentDate !== prevDate

      return (
        <>
          {showHeader && renderSectionHeader(formatDate(item.date, 'long'))}
          {renderTransaction({ item })}
        </>
      )
    },
    [transactions]
  )

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={['top']}>
      {/* Header */}
      <View className="px-5 pt-4 pb-4">
        <Text className="text-white text-2xl font-bold">Transactions</Text>
      </View>

      {/* Search Bar */}
      <View className="px-5 pb-3">
        <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-xl px-4">
          <Ionicons name="search-outline" size={20} color="#64748b" />
          <TextInput
            className="flex-1 text-white py-3.5 px-3"
            placeholder="Search transactions..."
            placeholderTextColor="#475569"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={20} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Buttons */}
      <View className="px-5 pb-3">
        <View className="flex-row items-center">
          <View className="flex-row">
            <FilterButton type="all" label="All" />
            <FilterButton type="expense" label="Expenses" />
            <FilterButton type="income" label="Income" />
          </View>
          <View className="flex-1" />
          {/* Date Filter Button */}
          <TouchableOpacity
            className="flex-row items-center bg-slate-800 rounded-full px-3 py-2"
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={14} color="#94a3b8" />
            <Text className="text-slate-300 text-xs font-medium ml-1.5">
              {DATE_FILTERS.find(f => f.value === dateFilter)?.label}
            </Text>
            <Ionicons name="chevron-down" size={12} color="#64748b" style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Bar */}
      <View className="mx-5 mb-3 flex-row items-center justify-between py-2 px-1">
        <Text className="text-slate-500 text-sm">
          {totals.count} transaction{totals.count !== 1 ? 's' : ''}
        </Text>
        <View className="flex-row items-center">
          <View className="items-end mr-4">
            <Text className="text-slate-500 text-xs">Income</Text>
            <Text className="text-emerald-500 text-sm font-semibold">
              +{formatCurrency(totals.income)}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-slate-500 text-xs">Expenses</Text>
            <Text className="text-white text-sm font-semibold">
              -{formatCurrency(totals.expenses)}
            </Text>
          </View>
        </View>
      </View>

      {/* Transaction List */}
      {isLoading && !refreshing ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : transactions.length === 0 ? (
        <View className="flex-1 items-center justify-center px-5">
          <Ionicons name="receipt-outline" size={48} color="#475569" />
          <Text className="text-slate-400 text-base mt-3 text-center">
            {search ? 'No transactions found' : 'No transactions yet'}
          </Text>
          <Text className="text-slate-500 text-sm mt-1 text-center">
            {search
              ? 'Try a different search term'
              : 'Connect a bank account to see your transactions'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#fff"
            />
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4">
                <ActivityIndicator color="#64748b" />
              </View>
            ) : hasNextPage ? (
              <View className="py-4">
                <Text className="text-slate-500 text-center text-sm">
                  Pull to load more
                </Text>
              </View>
            ) : transactions.length > 0 ? (
              <View className="py-4">
                <Text className="text-slate-500 text-center text-sm">
                  {transactions.length} transactions
                </Text>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}

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
