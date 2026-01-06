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
  ScrollView,
  Image,
} from 'react-native'
import { Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

import { useAuth } from '@/hooks/useAuth'

const sterlingLogo = require('../../../assets/sterlinglogo.png')

export default function SignupScreen() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const { signUp } = useAuth()

  const handleSignup = async () => {
    if (!firstName || !lastName || !email || !password) {
      Alert.alert('Error', 'Please fill in all required fields')
      return
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match')
      return
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters')
      return
    }

    setIsLoading(true)
    const { error } = await signUp(email, password, {
      firstName,
      lastName,
      phone: phone || undefined,
    })
    setIsLoading(false)

    if (error) {
      Alert.alert('Signup Failed', error.message)
    } else {
      Alert.alert(
        'Check Your Email',
        'We sent you a confirmation email. Please verify your email to continue.',
        [{ text: 'OK' }]
      )
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-6 py-8">
            {/* Logo and Title */}
            <View className="items-center mb-8">
              <Image
                source={sterlingLogo}
                className="w-20 h-20 rounded-2xl mb-4"
                resizeMode="contain"
              />
              <Text className="text-3xl font-bold text-white mb-2">
                Create Account
              </Text>
              <Text className="text-slate-400 text-center">
                Start your journey to financial freedom
              </Text>
            </View>

            {/* Form */}
            <View className="space-y-4">
              {/* Name Row */}
              <View className="flex-row space-x-3">
                <View className="flex-1">
                  <Text className="text-slate-400 text-sm mb-2 ml-1">
                    First Name
                  </Text>
                  <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-xl px-4">
                    <Ionicons name="person-outline" size={20} color="#64748b" />
                    <TextInput
                      className="flex-1 text-white py-4 px-3"
                      placeholder="John"
                      placeholderTextColor="#475569"
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-slate-400 text-sm mb-2 ml-1">
                    Last Name
                  </Text>
                  <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-xl px-4">
                    <TextInput
                      className="flex-1 text-white py-4 px-3"
                      placeholder="Doe"
                      placeholderTextColor="#475569"
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
              </View>

              {/* Email Input */}
              <View className="mt-4">
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

              {/* Phone Input */}
              <View className="mt-4">
                <Text className="text-slate-400 text-sm mb-2 ml-1">
                  Phone (optional)
                </Text>
                <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-xl px-4">
                  <Ionicons name="call-outline" size={20} color="#64748b" />
                  <TextInput
                    className="flex-1 text-white py-4 px-3"
                    placeholder="+1 (555) 000-0000"
                    placeholderTextColor="#475569"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              {/* Password Input */}
              <View className="mt-4">
                <Text className="text-slate-400 text-sm mb-2 ml-1">
                  Password
                </Text>
                <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-xl px-4">
                  <Ionicons name="lock-closed-outline" size={20} color="#64748b" />
                  <TextInput
                    className="flex-1 text-white py-4 px-3"
                    placeholder="At least 8 characters"
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

              {/* Confirm Password Input */}
              <View className="mt-4">
                <Text className="text-slate-400 text-sm mb-2 ml-1">
                  Confirm Password
                </Text>
                <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-xl px-4">
                  <Ionicons name="lock-closed-outline" size={20} color="#64748b" />
                  <TextInput
                    className="flex-1 text-white py-4 px-3"
                    placeholder="Re-enter your password"
                    placeholderTextColor="#475569"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Signup Button */}
              <TouchableOpacity
                className={`mt-6 py-4 rounded-xl items-center ${
                  isLoading ? 'bg-slate-700' : 'bg-white'
                }`}
                onPress={handleSignup}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#020617" />
                ) : (
                  <Text className="text-slate-950 font-semibold text-base">
                    Create Account
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Sign In Link */}
            <View className="flex-row justify-center mt-8">
              <Text className="text-slate-400">Already have an account? </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity>
                  <Text className="text-white font-semibold">Sign In</Text>
                </TouchableOpacity>
              </Link>
            </View>

            {/* Terms */}
            <Text className="text-slate-500 text-xs text-center mt-6 px-4">
              By creating an account, you agree to our{' '}
              <Text className="text-slate-400">Terms of Service</Text> and{' '}
              <Text className="text-slate-400">Privacy Policy</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
