import { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

import { useSubscription } from '@/hooks/useApi'
import { formatCurrency } from '@/utils/format'

const PRO_FEATURES = [
  { icon: 'chatbubbles-outline', title: 'AI Chat', description: 'Ask questions about your finances' },
  { icon: 'search-outline', title: 'Natural Language Search', description: 'Search transactions naturally' },
  { icon: 'pricetags-outline', title: 'AI Categorization', description: 'Automatic smart categorization' },
  { icon: 'alert-circle-outline', title: 'Anomaly Detection', description: 'Unusual spending alerts' },
  { icon: 'trending-up-outline', title: 'Cash Flow Forecasting', description: 'Predict future balances' },
  { icon: 'heart-outline', title: 'Health Score', description: 'Financial wellness tracking' },
  { icon: 'infinite-outline', title: 'Unlimited Accounts', description: 'Connect all your banks' },
]

export default function BillingScreen() {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)

  const { data: subscription, isLoading, refetch } = useSubscription()

  const isPro = subscription?.tier === 'pro'
  const isTrialing = subscription?.status === 'trialing'

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleUpgrade = () => {
    // Open web checkout in browser
    Linking.openURL('https://joinsterling.com/checkout')
  }

  const handleManage = () => {
    // Open Stripe portal in browser
    Linking.openURL('https://joinsterling.com/dashboard/settings/billing')
  }

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
        <Text className="text-white text-2xl font-bold">Billing</Text>
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
        {/* Current Plan */}
        <View
          className={`mx-5 rounded-2xl p-5 border ${
            isPro
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-slate-900 border-slate-800'
          }`}
        >
          <View className="flex-row items-center mb-3">
            <View
              className={`w-12 h-12 rounded-full items-center justify-center ${
                isPro ? 'bg-amber-500/20' : 'bg-slate-800'
              }`}
            >
              <Ionicons
                name={isPro ? 'star' : 'star-outline'}
                size={24}
                color={isPro ? '#f59e0b' : '#64748b'}
              />
            </View>
            <View className="ml-3">
              <Text
                className={`text-xl font-bold ${
                  isPro ? 'text-amber-500' : 'text-white'
                }`}
              >
                {isPro ? 'Sterling Pro' : 'Free Plan'}
              </Text>
              <Text className="text-slate-400 text-sm">
                {isPro
                  ? isTrialing
                    ? 'Trial period'
                    : 'All features unlocked'
                  : 'Basic features'}
              </Text>
            </View>
          </View>

          {isPro && subscription?.currentPeriodEnd && (
            <View className="bg-slate-900/50 rounded-xl p-3 mt-2">
              <Text className="text-slate-400 text-sm">
                {isTrialing ? 'Trial ends' : 'Renews'} on{' '}
                <Text className="text-white">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </Text>
              </Text>
            </View>
          )}

          {!isPro && (
            <TouchableOpacity
              className="bg-amber-500 rounded-xl py-3 items-center mt-4"
              onPress={handleUpgrade}
            >
              <Text className="text-slate-950 font-semibold">
                Upgrade to Pro
              </Text>
            </TouchableOpacity>
          )}

          {isPro && (
            <TouchableOpacity
              className="border border-slate-700 rounded-xl py-3 items-center mt-4"
              onPress={handleManage}
            >
              <Text className="text-white font-medium">Manage Subscription</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Pro Features */}
        <View className="mt-8 px-5">
          <Text className="text-white text-lg font-semibold mb-4">
            {isPro ? 'Your Pro Features' : 'Pro Features'}
          </Text>

          <View className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            {PRO_FEATURES.map((feature, index) => (
              <View
                key={feature.title}
                className={`flex-row items-center p-4 ${
                  index > 0 ? 'border-t border-slate-800' : ''
                }`}
              >
                <View
                  className={`w-10 h-10 rounded-full items-center justify-center ${
                    isPro ? 'bg-amber-500/20' : 'bg-slate-800'
                  }`}
                >
                  <Ionicons
                    name={feature.icon as any}
                    size={20}
                    color={isPro ? '#f59e0b' : '#64748b'}
                  />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-white font-medium">{feature.title}</Text>
                  <Text className="text-slate-500 text-sm">
                    {feature.description}
                  </Text>
                </View>
                {isPro ? (
                  <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                ) : (
                  <Ionicons name="lock-closed" size={20} color="#64748b" />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Pricing */}
        {!isPro && (
          <View className="mt-8 px-5 mb-8">
            <Text className="text-white text-lg font-semibold mb-4">
              Pricing
            </Text>

            <View className="flex-row space-x-3">
              {/* Monthly */}
              <TouchableOpacity
                className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-4"
                onPress={handleUpgrade}
              >
                <Text className="text-slate-400 text-sm">Monthly</Text>
                <Text className="text-white text-2xl font-bold mt-1">$9.99</Text>
                <Text className="text-slate-500 text-xs mt-1">/month</Text>
              </TouchableOpacity>

              {/* Yearly */}
              <TouchableOpacity
                className="flex-1 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 ml-3"
                onPress={handleUpgrade}
              >
                <View className="flex-row items-center">
                  <Text className="text-amber-500 text-sm">Yearly</Text>
                  <View className="bg-amber-500 rounded px-1.5 py-0.5 ml-2">
                    <Text className="text-slate-950 text-xs font-semibold">
                      Save 17%
                    </Text>
                  </View>
                </View>
                <Text className="text-amber-500 text-2xl font-bold mt-1">
                  $99.99
                </Text>
                <Text className="text-amber-500/70 text-xs mt-1">/year</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom Padding */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  )
}
