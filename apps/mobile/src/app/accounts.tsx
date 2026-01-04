import { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

import { useAccounts, useSyncTransactions } from '@/hooks/useApi'
import { PlaidLinkButton } from '@/components/PlaidLinkButton'
import { formatCurrency } from '@/utils/format'
import { api } from '@/services/api'
import type { Account } from '@sterling/shared'

export default function AccountsScreen() {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  const { data, isLoading, refetch } = useAccounts()
  const syncTransactions = useSyncTransactions()

  const accounts = data?.accounts || []

  // Group accounts by institution
  const accountsByInstitution = accounts.reduce((acc, account) => {
    const key = account.institution_name || 'Unknown Institution'
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(account)
    return acc
  }, {} as Record<string, Account[]>)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleSync = async () => {
    try {
      await syncTransactions.mutateAsync(undefined)
      await refetch()
      Alert.alert('Sync Complete', 'Your transactions have been updated.')
    } catch (error) {
      Alert.alert('Sync Failed', 'Unable to sync transactions. Please try again.')
    }
  }

  const handleDisconnect = (itemId: string, institutionName: string) => {
    Alert.alert(
      'Disconnect Account',
      `Are you sure you want to disconnect ${institutionName}? This will remove all accounts and transaction history from this institution.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setDisconnecting(itemId)
            try {
              await api.disconnectItem(itemId)
              await refetch()
              Alert.alert('Disconnected', `${institutionName} has been disconnected.`)
            } catch (error) {
              Alert.alert('Error', 'Failed to disconnect account. Please try again.')
            } finally {
              setDisconnecting(null)
            }
          },
        },
      ]
    )
  }

  const getAccountIcon = (type: string | null, subtype: string | null) => {
    if (type === 'credit') return 'card-outline'
    if (type === 'loan') return 'cash-outline'
    if (subtype === 'checking') return 'wallet-outline'
    if (subtype === 'savings') return 'trending-up-outline'
    return 'business-outline'
  }

  const getAccountTypeLabel = (type: string | null, subtype: string | null) => {
    if (subtype) {
      return subtype.charAt(0).toUpperCase() + subtype.slice(1)
    }
    if (type) {
      return type.charAt(0).toUpperCase() + type.slice(1)
    }
    return 'Account'
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
      <View className="px-5 pt-4 pb-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-3 w-10 h-10 bg-slate-900 rounded-full items-center justify-center"
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text className="text-white text-2xl font-bold">Accounts</Text>
        </View>
        {accounts.length > 0 && (
          <TouchableOpacity
            onPress={handleSync}
            disabled={syncTransactions.isPending}
            className="bg-slate-900 rounded-full px-4 py-2 flex-row items-center"
          >
            {syncTransactions.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="sync-outline" size={16} color="#fff" />
                <Text className="text-white text-sm ml-1.5">Sync</Text>
              </>
            )}
          </TouchableOpacity>
        )}
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
        {/* Connect Bank Button */}
        <View className="px-5 mb-6">
          <PlaidLinkButton onSuccess={refetch} />
        </View>

        {accounts.length === 0 ? (
          <View className="px-5 py-12 items-center">
            <View className="w-20 h-20 bg-slate-900 rounded-full items-center justify-center mb-4">
              <Ionicons name="business-outline" size={40} color="#475569" />
            </View>
            <Text className="text-white text-lg font-semibold mb-2">
              No accounts connected
            </Text>
            <Text className="text-slate-400 text-center">
              Connect your bank accounts to start tracking your finances automatically.
            </Text>
          </View>
        ) : (
          <>
            {/* Total Balance */}
            <View className="mx-5 mb-6 bg-slate-900 rounded-2xl p-5 border border-slate-800">
              <Text className="text-slate-400 text-sm mb-1">Total Balance</Text>
              <Text className="text-white text-3xl font-bold">
                {formatCurrency(
                  accounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0)
                )}
              </Text>
              <Text className="text-slate-500 text-sm mt-2">
                Across {accounts.length} account{accounts.length !== 1 ? 's' : ''}
              </Text>
            </View>

            {/* Accounts by Institution */}
            {Object.entries(accountsByInstitution).map(([institution, instAccounts]) => (
              <View key={institution} className="mb-6">
                <View className="px-5 flex-row items-center justify-between mb-3">
                  <Text className="text-white text-lg font-semibold">{institution}</Text>
                  <TouchableOpacity
                    onPress={() =>
                      handleDisconnect(
                        instAccounts[0].plaid_item_id || '',
                        institution
                      )
                    }
                    disabled={disconnecting === instAccounts[0].plaid_item_id}
                  >
                    {disconnecting === instAccounts[0].plaid_item_id ? (
                      <ActivityIndicator color="#ef4444" size="small" />
                    ) : (
                      <Text className="text-red-400 text-sm">Disconnect</Text>
                    )}
                  </TouchableOpacity>
                </View>

                <View className="mx-5 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                  {instAccounts.map((account, index) => (
                    <View
                      key={account.id}
                      className={`flex-row items-center p-4 ${
                        index > 0 ? 'border-t border-slate-800' : ''
                      }`}
                    >
                      <View className="w-11 h-11 bg-slate-800 rounded-full items-center justify-center">
                        <Ionicons
                          name={getAccountIcon(account.type, account.subtype) as any}
                          size={22}
                          color="#94a3b8"
                        />
                      </View>
                      <View className="flex-1 ml-3">
                        <Text className="text-white text-base font-medium">
                          {account.name}
                        </Text>
                        <Text className="text-slate-500 text-sm">
                          {getAccountTypeLabel(account.type, account.subtype)}
                          {account.mask && ` •••• ${account.mask}`}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text
                          className={`text-lg font-semibold ${
                            (account.current_balance || 0) < 0
                              ? 'text-red-500'
                              : 'text-white'
                          }`}
                        >
                          {formatCurrency(account.current_balance || 0)}
                        </Text>
                        {account.available_balance !== null &&
                          account.available_balance !== account.current_balance && (
                            <Text className="text-slate-500 text-xs">
                              {formatCurrency(account.available_balance)} available
                            </Text>
                          )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </>
        )}

        {/* Bottom Padding */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  )
}
