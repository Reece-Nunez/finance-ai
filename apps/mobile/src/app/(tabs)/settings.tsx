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
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'

import { useAuth } from '@/hooks/useAuth'
import { useProfile, useSubscription } from '@/hooks/useApi'

type IconName = keyof typeof Ionicons.glyphMap

interface SettingsItemProps {
  icon: IconName
  label: string
  value?: string
  showChevron?: boolean
  onPress?: () => void
  destructive?: boolean
  badge?: string
}

function SettingsItem({
  icon,
  label,
  value,
  showChevron = true,
  onPress,
  destructive,
  badge,
}: SettingsItemProps) {
  return (
    <TouchableOpacity
      className="flex-row items-center px-4 py-4 border-b border-slate-800"
      onPress={onPress}
      disabled={!onPress}
    >
      <View
        className={`w-9 h-9 rounded-lg items-center justify-center ${
          destructive ? 'bg-red-500/20' : 'bg-slate-800'
        }`}
      >
        <Ionicons
          name={icon}
          size={20}
          color={destructive ? '#ef4444' : '#94a3b8'}
        />
      </View>
      <Text
        className={`flex-1 ml-3 text-base ${
          destructive ? 'text-red-500' : 'text-white'
        }`}
      >
        {label}
      </Text>
      {badge && (
        <View className="bg-amber-500 rounded-full px-2 py-0.5 mr-2">
          <Text className="text-slate-950 text-xs font-semibold">{badge}</Text>
        </View>
      )}
      {value && <Text className="text-slate-500 mr-2">{value}</Text>}
      {showChevron && onPress && (
        <Ionicons name="chevron-forward" size={20} color="#475569" />
      )}
    </TouchableOpacity>
  )
}

export default function SettingsScreen() {
  const router = useRouter()
  const { user, signOut, hasBiometrics } = useAuth()
  const [refreshing, setRefreshing] = useState(false)

  const { data: profileData, refetch: refetchProfile } = useProfile()
  const { data: subscriptionData, refetch: refetchSubscription } = useSubscription()

  const profile = profileData?.profile
  const subscription = subscriptionData

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([refetchProfile(), refetchSubscription()])
    setRefreshing(false)
  }, [refetchProfile, refetchSubscription])

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: signOut,
      },
    ])
  }

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Failed to open link')
    })
  }

  const isPro = subscription?.tier === 'pro'

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
        <View className="px-5 pt-4 pb-4">
          <Text className="text-white text-2xl font-bold">Settings</Text>
        </View>

        {/* Profile Card */}
        <TouchableOpacity
          className="mx-5 bg-slate-900 rounded-2xl p-4 border border-slate-800 flex-row items-center"
          onPress={() => router.push('/profile')}
        >
          <View className="w-14 h-14 bg-slate-800 rounded-full items-center justify-center">
            <Text className="text-white text-xl font-bold">
              {profile?.first_name?.[0]?.toUpperCase() ||
                user?.email?.[0]?.toUpperCase() ||
                '?'}
            </Text>
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-white text-lg font-semibold">
              {profile?.first_name && profile?.last_name
                ? `${profile.first_name} ${profile.last_name}`
                : 'Set up profile'}
            </Text>
            <Text className="text-slate-400 text-sm">{user?.email}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#475569" />
        </TouchableOpacity>

        {/* Subscription */}
        <TouchableOpacity
          className={`mx-5 mt-4 rounded-2xl p-4 border flex-row items-center ${
            isPro
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-slate-900 border-slate-800'
          }`}
          onPress={() => router.push('/billing')}
        >
          <View
            className={`w-12 h-12 rounded-full items-center justify-center ${
              isPro ? 'bg-amber-500/20' : 'bg-slate-800'
            }`}
          >
            <Ionicons
              name={isPro ? 'star' : 'star-outline'}
              size={24}
              color={isPro ? '#f59e0b' : '#94a3b8'}
            />
          </View>
          <View className="flex-1 ml-3">
            <Text className={`text-lg font-semibold ${isPro ? 'text-amber-500' : 'text-white'}`}>
              {isPro ? 'Sterling Pro' : 'Free Plan'}
            </Text>
            <Text className="text-slate-400 text-sm">
              {isPro ? 'All features unlocked' : 'Upgrade for AI features'}
            </Text>
          </View>
          {!isPro && (
            <View className="bg-amber-500 rounded-lg px-3 py-1.5">
              <Text className="text-slate-950 text-sm font-semibold">Upgrade</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Account Section */}
        <View className="mt-6">
          <Text className="text-slate-500 text-xs font-semibold uppercase px-5 mb-2">
            Account
          </Text>
          <View className="mx-5 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <SettingsItem
              icon="person-outline"
              label="Edit Profile"
              onPress={() => router.push('/profile')}
            />
            <SettingsItem
              icon="card-outline"
              label="Connected Accounts"
              onPress={() => router.push('/accounts')}
            />
            <SettingsItem
              icon="receipt-outline"
              label="Billing"
              onPress={() => router.push('/billing')}
            />
          </View>
        </View>

        {/* Security Section */}
        <View className="mt-6">
          <Text className="text-slate-500 text-xs font-semibold uppercase px-5 mb-2">
            Security
          </Text>
          <View className="mx-5 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <SettingsItem
              icon="finger-print"
              label="Biometric Login"
              value={hasBiometrics ? 'Available' : 'Not available'}
              showChevron={false}
            />
            <SettingsItem
              icon="key-outline"
              label="Change Password"
              onPress={() =>
                Alert.alert('Info', 'Password reset email will be sent to your email address')
              }
            />
          </View>
        </View>

        {/* Support Section */}
        <View className="mt-6">
          <Text className="text-slate-500 text-xs font-semibold uppercase px-5 mb-2">
            Support
          </Text>
          <View className="mx-5 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <SettingsItem
              icon="help-circle-outline"
              label="Help Center"
              onPress={() => openUrl('https://joinsterling.com/help')}
            />
            <SettingsItem
              icon="chatbubble-outline"
              label="Contact Support"
              onPress={() => openUrl('mailto:support@joinsterling.com')}
            />
            <SettingsItem
              icon="document-text-outline"
              label="Privacy Policy"
              onPress={() => openUrl('https://joinsterling.com/privacy')}
            />
            <SettingsItem
              icon="shield-checkmark-outline"
              label="Terms of Service"
              onPress={() => openUrl('https://joinsterling.com/terms')}
            />
          </View>
        </View>

        {/* Sign Out */}
        <View className="mt-6 mb-8">
          <View className="mx-5 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <SettingsItem
              icon="log-out-outline"
              label="Sign Out"
              showChevron={false}
              destructive
              onPress={handleSignOut}
            />
          </View>
        </View>

        {/* Version */}
        <Text className="text-slate-600 text-xs text-center mb-8">
          Sterling v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}
