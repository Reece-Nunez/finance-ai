import { useState, useCallback, useMemo } from 'react'
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

import { useRecurring } from '@/hooks/useApi'
import { MerchantLogo } from '@/components/MerchantLogo'
import { RecurringSheet } from '@/components/RecurringSheet'
import { formatCurrency, formatDate } from '@/utils/format'
type TabType = 'subscriptions' | 'bills' | 'income'

// API returns camelCase
interface RecurringItem {
  id: string
  name: string
  displayName: string
  amount: number
  averageAmount: number
  frequency: string
  isIncome: boolean
  nextDate: string | null
  lastDate: string | null
  category: string | null
  confidence: string
  occurrences: number
}

export default function RecurringScreen() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('subscriptions')
  const [refreshing, setRefreshing] = useState(false)
  const [selectedItem, setSelectedItem] = useState<RecurringItem | null>(null)
  const [sheetVisible, setSheetVisible] = useState(false)

  const { data, isLoading, refetch } = useRecurring()

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  // Filter recurring by type - API returns camelCase
  const filtered = useMemo(() => {
    if (!data?.recurring) return []

    return data.recurring.filter((item: RecurringItem) => {
      // Filter out items with no display name or zero amount (bad data)
      if (!item.displayName || (item.averageAmount ?? 0) === 0) return false

      if (activeTab === 'income') {
        return item.isIncome
      }
      // Both subscriptions and bills tabs show all non-income recurring
      return !item.isIncome
    })
  }, [data?.recurring, activeTab])

  // Calculate totals - API returns camelCase
  const totals = useMemo(() => {
    if (!data?.recurring) return { monthly: 0, yearly: 0 }

    const monthlyItems = data.recurring.filter(
      (item: RecurringItem) => !item.isIncome && item.frequency !== 'once' && (item.averageAmount ?? 0) > 0
    )
    const monthly = monthlyItems.reduce((sum: number, item: RecurringItem) => {
      const amount = Math.abs(item.averageAmount ?? 0)
      if (item.frequency === 'weekly') return sum + amount * 4.33
      if (item.frequency === 'bi-weekly') return sum + amount * 2.17
      if (item.frequency === 'yearly') return sum + amount / 12
      return sum + amount
    }, 0)

    return { monthly, yearly: monthly * 12 }
  }, [data?.recurring])

  // Derive upcoming bills from recurring data (next 30 days)
  const upcoming = useMemo(() => {
    if (!data?.recurring) return []

    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    return data.recurring
      .filter((item: RecurringItem) => {
        if (!item.nextDate || item.isIncome || (item.averageAmount ?? 0) === 0) return false
        const nextDate = new Date(item.nextDate)
        return nextDate >= now && nextDate <= thirtyDaysFromNow
      })
      .sort((a: RecurringItem, b: RecurringItem) => {
        const dateA = new Date(a.nextDate || 0)
        const dateB = new Date(b.nextDate || 0)
        return dateA.getTime() - dateB.getTime()
      })
      .slice(0, 5)
  }, [data?.recurring])

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'weekly':
        return 'Weekly'
      case 'bi-weekly':
        return 'Every 2 weeks'
      case 'monthly':
        return 'Monthly'
      case 'quarterly':
        return 'Quarterly'
      case 'yearly':
        return 'Yearly'
      default:
        return frequency || 'One-time'
    }
  }

  const handleItemPress = (item: RecurringItem) => {
    setSelectedItem(item)
    setSheetVisible(true)
  }

  const handleCloseSheet = () => {
    setSheetVisible(false)
    setSelectedItem(null)
  }

  const TabButton = ({ type, label }: { type: TabType; label: string }) => (
    <TouchableOpacity
      className={`flex-1 py-3 items-center justify-center rounded-lg ${
        activeTab === type ? 'bg-white' : ''
      }`}
      onPress={() => setActiveTab(type)}
    >
      <Text
        className={`font-medium text-sm ${
          activeTab === type ? 'text-slate-950' : 'text-slate-400'
        }`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )

  if (isLoading) {
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
        <Text className="text-white text-2xl font-bold">Recurring</Text>
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
        {/* Upcoming Section - At the top */}
        {upcoming.length > 0 && (
          <View className="mb-4">
            <Text className="text-white text-lg font-semibold px-5 mb-3">
              Coming Up
            </Text>
            <View className="mx-5 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              {upcoming.map((item: RecurringItem, index: number) => (
                <TouchableOpacity
                  key={`${item.id}-upcoming`}
                  className={`flex-row items-center p-4 ${
                    index > 0 ? 'border-t border-slate-800' : ''
                  }`}
                  onPress={() => handleItemPress(item)}
                  activeOpacity={0.7}
                >
                  <MerchantLogo name={item.displayName} size={44} />
                  <View className="flex-1 ml-3">
                    <Text className="text-white text-base font-medium" numberOfLines={1}>
                      {item.displayName}
                    </Text>
                    <Text className="text-slate-500 text-sm">
                      {item.nextDate ? formatDate(item.nextDate) : 'Unknown date'}
                    </Text>
                  </View>
                  <Text className="text-white text-base font-semibold">
                    {formatCurrency(Math.abs(item.averageAmount ?? 0))}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Monthly Summary */}
        <View className="mx-5 mb-4 bg-slate-900 rounded-2xl p-5 border border-slate-800">
          <View className="flex-row justify-between">
            <View>
              <Text className="text-slate-400 text-sm">Monthly</Text>
              <Text className="text-white text-2xl font-bold">
                {formatCurrency(totals.monthly)}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-slate-400 text-sm">Yearly</Text>
              <Text className="text-white text-2xl font-bold">
                {formatCurrency(totals.yearly)}
              </Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View className="mx-5 mb-4 bg-slate-900 rounded-xl p-1 flex-row">
          <TabButton type="subscriptions" label="Subscriptions" />
          <TabButton type="bills" label="Bills" />
          <TabButton type="income" label="Income" />
        </View>

        {/* List */}
        {filtered.length === 0 ? (
          <View className="mx-5 py-12 items-center">
            <Ionicons name="repeat-outline" size={48} color="#475569" />
            <Text className="text-slate-400 text-base mt-3">
              No {activeTab} found
            </Text>
            <Text className="text-slate-500 text-sm mt-1 text-center">
              Recurring transactions will appear here automatically
            </Text>
          </View>
        ) : (
          <View className="mx-5 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            {filtered.map((item: RecurringItem, index: number) => (
              <TouchableOpacity
                key={item.id}
                className={`flex-row items-center p-4 ${
                  index > 0 ? 'border-t border-slate-800' : ''
                }`}
                onPress={() => handleItemPress(item)}
                activeOpacity={0.7}
              >
                <MerchantLogo
                  name={item.displayName}
                  size={44}
                />
                <View className="flex-1 ml-3">
                  <Text className="text-white text-base font-medium" numberOfLines={1}>
                    {item.displayName}
                  </Text>
                  <View className="flex-row items-center mt-0.5">
                    <Text className="text-slate-500 text-sm">
                      {getFrequencyLabel(item.frequency)}
                    </Text>
                    {item.nextDate && (
                      <>
                        <Text className="text-slate-600 mx-1.5">•</Text>
                        <Text className="text-slate-500 text-sm">
                          Next: {formatDate(item.nextDate)}
                        </Text>
                      </>
                    )}
                  </View>
                </View>
                <View className="flex-row items-center">
                  <Text
                    className={`text-base font-semibold ${
                      item.isIncome ? 'text-emerald-500' : 'text-white'
                    }`}
                  >
                    {item.isIncome ? '+' : ''}
                    {formatCurrency(Math.abs(item.averageAmount ?? 0))}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#475569" className="ml-2" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Bottom Padding */}
        <View className="h-8" />
      </ScrollView>

      {/* Recurring Detail Sheet */}
      <RecurringSheet
        item={selectedItem}
        visible={sheetVisible}
        onClose={handleCloseSheet}
      />
    </SafeAreaView>
  )
}
