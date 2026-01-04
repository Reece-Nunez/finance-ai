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
import { formatCurrency, formatDate } from '@/utils/format'
import type { RecurringTransaction } from '@sterling/shared'

type TabType = 'subscriptions' | 'bills' | 'income'

export default function RecurringScreen() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('subscriptions')
  const [refreshing, setRefreshing] = useState(false)

  const { data, isLoading, refetch } = useRecurring()

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  // Filter recurring by type
  const filtered = useMemo(() => {
    if (!data?.recurring) return []

    return data.recurring.filter((item) => {
      if (activeTab === 'subscriptions') {
        return !item.is_income && item.frequency !== 'once'
      }
      if (activeTab === 'bills') {
        return !item.is_income && item.frequency === 'once'
      }
      return item.is_income
    })
  }, [data?.recurring, activeTab])

  // Calculate totals
  const totals = useMemo(() => {
    if (!data?.recurring) return { monthly: 0, yearly: 0 }

    const monthlyItems = data.recurring.filter(
      (item) => !item.is_income && item.frequency !== 'once'
    )
    const monthly = monthlyItems.reduce((sum, item) => {
      const amount = Math.abs(item.average_amount)
      if (item.frequency === 'weekly') return sum + amount * 4.33
      if (item.frequency === 'biweekly') return sum + amount * 2.17
      if (item.frequency === 'yearly') return sum + amount / 12
      return sum + amount
    }, 0)

    return { monthly, yearly: monthly * 12 }
  }, [data?.recurring])

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'weekly':
        return 'Weekly'
      case 'biweekly':
        return 'Every 2 weeks'
      case 'monthly':
        return 'Monthly'
      case 'yearly':
        return 'Yearly'
      default:
        return 'One-time'
    }
  }

  const TabButton = ({ type, label }: { type: TabType; label: string }) => (
    <TouchableOpacity
      className={`flex-1 py-3 items-center rounded-lg ${
        activeTab === type ? 'bg-white' : ''
      }`}
      onPress={() => setActiveTab(type)}
    >
      <Text
        className={`font-medium ${
          activeTab === type ? 'text-slate-950' : 'text-slate-400'
        }`}
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
            {filtered.map((item, index) => (
              <View
                key={item.id}
                className={`flex-row items-center p-4 ${
                  index > 0 ? 'border-t border-slate-800' : ''
                }`}
              >
                <MerchantLogo
                  name={item.merchant_name || item.description}
                  size={44}
                />
                <View className="flex-1 ml-3">
                  <Text className="text-white text-base font-medium">
                    {item.merchant_name || item.description}
                  </Text>
                  <View className="flex-row items-center mt-0.5">
                    <Text className="text-slate-500 text-sm">
                      {getFrequencyLabel(item.frequency)}
                    </Text>
                    {item.next_date && (
                      <>
                        <Text className="text-slate-600 mx-1.5">•</Text>
                        <Text className="text-slate-500 text-sm">
                          Next: {formatDate(item.next_date)}
                        </Text>
                      </>
                    )}
                  </View>
                </View>
                <Text
                  className={`text-base font-semibold ${
                    item.is_income ? 'text-emerald-500' : 'text-white'
                  }`}
                >
                  {item.is_income ? '+' : ''}
                  {formatCurrency(Math.abs(item.average_amount))}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Upcoming Section */}
        {data?.upcoming && data.upcoming.length > 0 && (
          <View className="mt-6 mb-8">
            <Text className="text-white text-lg font-semibold px-5 mb-3">
              Coming Up
            </Text>
            <View className="mx-5 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              {data.upcoming.slice(0, 5).map((item, index) => (
                <View
                  key={`${item.merchant_name}-${item.expected_date}`}
                  className={`flex-row items-center p-4 ${
                    index > 0 ? 'border-t border-slate-800' : ''
                  }`}
                >
                  <View className="w-11 h-11 bg-slate-800 rounded-full items-center justify-center">
                    <Text className="text-white text-sm font-bold">
                      {new Date(item.expected_date).getDate()}
                    </Text>
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-white text-base font-medium">
                      {item.merchant_name}
                    </Text>
                    <Text className="text-slate-500 text-sm">
                      {formatDate(item.expected_date)}
                    </Text>
                  </View>
                  <Text className="text-white text-base font-semibold">
                    {formatCurrency(Math.abs(item.expected_amount))}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Bottom Padding */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  )
}
