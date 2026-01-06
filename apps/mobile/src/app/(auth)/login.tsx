import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native'
import { Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

import { useAuth } from '@/hooks/useAuth'

const sterlingLogo = require('../../../assets/sterlinglogo.png')

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const { signIn, authenticateWithBiometrics, hasBiometrics } = useAuth()

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password')
      return
    }

    setIsLoading(true)
    const { error } = await signIn(email, password)
    setIsLoading(false)

    if (error) {
      Alert.alert('Login Failed', error.message)
    }
  }

  const handleBiometricLogin = async () => {
    const success = await authenticateWithBiometrics()
    if (success) {
      // Biometric auth is for app unlock, not initial login
      // User still needs to have a valid session
      Alert.alert('Info', 'Please sign in with your credentials first')
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-6">
          {/* Logo and Title */}
          <View className="items-center mb-10">
            <Image
              source={sterlingLogo}
              className="w-20 h-20 rounded-2xl mb-4"
              resizeMode="contain"
            />
            <Text className="text-3xl font-bold text-white mb-2">Sterling</Text>
            <Text className="text-slate-400 text-center">
              Sign in to manage your finances
            </Text>
          </View>

          {/* Form */}
          <View className="space-y-4">
            {/* Email Input */}
            <View>
              <Text className="text-slate-400 text-sm mb-2 ml-1">Email</Text>
              <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-xl px-4">
                <Ionicons name="mail-outline" size={20} color="#64748b" />
                <TextInput
                  className="flex-1 text-white py-4 px-3"
                  placeholder="you@example.com"
                  placeholderTextColor="#475569"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password Input */}
            <View className="mt-4">
              <Text className="text-slate-400 text-sm mb-2 ml-1">Password</Text>
              <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-xl px-4">
                <Ionicons name="lock-closed-outline" size={20} color="#64748b" />
                <TextInput
                  className="flex-1 text-white py-4 px-3"
                  placeholder="Enter your password"
                  placeholderTextColor="#475569"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              className={`mt-6 py-4 rounded-xl items-center ${
                isLoading ? 'bg-slate-700' : 'bg-white'
              }`}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#020617" />
              ) : (
                <Text className="text-slate-950 font-semibold text-base">
                  Sign In
                </Text>
              )}
            </TouchableOpacity>

            {/* Biometric Login */}
            {hasBiometrics && (
              <TouchableOpacity
                className="mt-4 py-4 rounded-xl items-center border border-slate-700"
                onPress={handleBiometricLogin}
              >
                <View className="flex-row items-center">
                  <Ionicons name="finger-print" size={24} color="#fff" />
                  <Text className="text-white font-medium text-base ml-2">
                    Use Biometrics
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Sign Up Link */}
          <View className="flex-row justify-center mt-8">
            <Text className="text-slate-400">Don't have an account? </Text>
            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity>
                <Text className="text-white font-semibold">Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
