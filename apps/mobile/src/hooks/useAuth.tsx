import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter, useSegments } from 'expo-router'
import { Session, User } from '@supabase/supabase-js'
import * as LocalAuthentication from 'expo-local-authentication'

import { supabase } from '@/services/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (
    email: string,
    password: string,
    metadata?: { firstName?: string; lastName?: string; phone?: string }
  ) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  authenticateWithBiometrics: () => Promise<boolean>
  hasBiometrics: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasBiometrics, setHasBiometrics] = useState(false)

  const router = useRouter()
  const segments = useSegments()

  // Check biometric availability
  useEffect(() => {
    async function checkBiometrics() {
      const compatible = await LocalAuthentication.hasHardwareAsync()
      const enrolled = await LocalAuthentication.isEnrolledAsync()
      setHasBiometrics(compatible && enrolled)
    }
    checkBiometrics()
  }, [])

  // Listen for auth state changes
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession)
        setUser(newSession?.user ?? null)
        setIsLoading(false)
      }
    )

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession)
      setUser(initialSession?.user ?? null)
      setIsLoading(false)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  // Handle navigation based on auth state
  useEffect(() => {
    if (isLoading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!user && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/(auth)/login')
    } else if (user && inAuthGroup) {
      // Redirect to home if authenticated
      router.replace('/(tabs)')
    }
  }, [user, segments, isLoading])

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { error: error ? new Error(error.message) : null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  const signUp = async (
    email: string,
    password: string,
    metadata?: { firstName?: string; lastName?: string; phone?: string }
  ) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      })
      return { error: error ? new Error(error.message) : null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.replace('/(auth)/login')
  }

  const authenticateWithBiometrics = async () => {
    if (!hasBiometrics) return false

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to access Sterling',
      fallbackLabel: 'Use password',
    })

    return result.success
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        signIn,
        signUp,
        signOut,
        authenticateWithBiometrics,
        hasBiometrics,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
