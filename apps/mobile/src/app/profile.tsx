import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

import { useProfile, useUpdateProfile } from '@/hooks/useApi'
import { useAuth } from '@/hooks/useAuth'

export default function ProfileScreen() {
  const router = useRouter()
  const { user } = useAuth()

  const { data, isLoading } = useProfile()
  const updateProfile = useUpdateProfile()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (data?.profile) {
      setFirstName(data.profile.first_name || '')
      setLastName(data.profile.last_name || '')
      setPhone(data.profile.phone || '')
    }
  }, [data])

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        first_name: firstName,
        last_name: lastName,
        phone: phone || undefined,
      })
      Alert.alert('Success', 'Your profile has been updated.')
      router.back()
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile. Please try again.')
    }
  }

  const hasChanges =
    firstName !== (data?.profile?.first_name || '') ||
    lastName !== (data?.profile?.last_name || '') ||
    phone !== (data?.profile?.phone || '')

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-950 items-center justify-center">
        <ActivityIndicator color="#fff" size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="px-5 pt-4 pb-4 flex-row items-center justify-between border-b border-slate-800">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-3 w-10 h-10 bg-slate-900 rounded-full items-center justify-center"
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <Text className="text-white text-xl font-bold">Edit Profile</Text>
          </View>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!hasChanges || updateProfile.isPending}
          >
            {updateProfile.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text
                className={`font-semibold ${
                  hasChanges ? 'text-white' : 'text-slate-500'
                }`}
              >
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-5 py-6">
          {/* Avatar */}
          <View className="items-center mb-8">
            <View className="w-24 h-24 bg-slate-800 rounded-full items-center justify-center mb-3">
              <Text className="text-white text-3xl font-bold">
                {firstName?.[0]?.toUpperCase() ||
                  user?.email?.[0]?.toUpperCase() ||
                  '?'}
              </Text>
            </View>
            <Text className="text-slate-400">{user?.email}</Text>
          </View>

          {/* Form */}
          <View className="space-y-4">
            {/* First Name */}
            <View>
              <Text className="text-slate-400 text-sm mb-2">First Name</Text>
              <TextInput
                className="bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-4"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Enter first name"
                placeholderTextColor="#475569"
                autoCapitalize="words"
              />
            </View>

            {/* Last Name */}
            <View className="mt-4">
              <Text className="text-slate-400 text-sm mb-2">Last Name</Text>
              <TextInput
                className="bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-4"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Enter last name"
                placeholderTextColor="#475569"
                autoCapitalize="words"
              />
            </View>

            {/* Phone */}
            <View className="mt-4">
              <Text className="text-slate-400 text-sm mb-2">
                Phone (optional)
              </Text>
              <TextInput
                className="bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-4"
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 (555) 000-0000"
                placeholderTextColor="#475569"
                keyboardType="phone-pad"
              />
            </View>

            {/* Email (read-only) */}
            <View className="mt-4">
              <Text className="text-slate-400 text-sm mb-2">Email</Text>
              <View className="bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-4">
                <Text className="text-slate-500">{user?.email}</Text>
              </View>
              <Text className="text-slate-500 text-xs mt-1">
                Email cannot be changed
              </Text>
            </View>
          </View>

          {/* Account Info */}
          <View className="mt-8 bg-slate-900 rounded-2xl p-4 border border-slate-800">
            <Text className="text-slate-400 text-sm mb-3">Account Info</Text>
            <View className="flex-row justify-between py-2 border-b border-slate-800">
              <Text className="text-slate-400">Member since</Text>
              <Text className="text-white">
                {user?.created_at
                  ? new Date(user.created_at).toLocaleDateString()
                  : 'Unknown'}
              </Text>
            </View>
            <View className="flex-row justify-between py-2">
              <Text className="text-slate-400">User ID</Text>
              <Text className="text-slate-500 text-xs">
                {user?.id?.slice(0, 8)}...
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
