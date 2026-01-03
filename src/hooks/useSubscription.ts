'use client'

import { useState, useEffect, useCallback } from 'react'

export interface SubscriptionState {
  tier: 'free' | 'pro'
  status: 'none' | 'trialing' | 'active' | 'past_due' | 'canceled'
  isPro: boolean
  isTrialing: boolean
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  isLoading: boolean
  error: string | null
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<SubscriptionState>({
    tier: 'free',
    status: 'none',
    isPro: false,
    isTrialing: false,
    trialEndsAt: null,
    currentPeriodEnd: null,
    isLoading: true,
    error: null,
  })

  const fetchSubscription = useCallback(async () => {
    try {
      const response = await fetch('/api/subscription')
      if (!response.ok) {
        throw new Error('Failed to fetch subscription')
      }
      const data = await response.json()
      setSubscription({
        ...data,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      setSubscription((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }))
    }
  }, [])

  useEffect(() => {
    fetchSubscription()
  }, [fetchSubscription])

  const startCheckout = async (plan: 'monthly' | 'yearly') => {
    // Redirect to custom checkout page
    window.location.href = `/checkout?plan=${plan}`
  }

  const openPortal = async () => {
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to open billing portal')
      }

      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      console.error('Portal error:', error)
      throw error
    }
  }

  return {
    ...subscription,
    refresh: fetchSubscription,
    startCheckout,
    openPortal,
  }
}
