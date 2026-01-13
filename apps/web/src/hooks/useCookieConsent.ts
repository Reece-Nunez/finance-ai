'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CookieConsent,
  DEFAULT_CONSENT,
  getStoredConsent,
  setStoredConsent,
} from '@/lib/cookie-consent'

interface UseCookieConsentReturn {
  consent: CookieConsent | null
  showBanner: boolean
  isLoading: boolean
  acceptAll: () => void
  rejectAll: () => void
  updateConsent: (updates: Partial<CookieConsent>) => void
  resetConsent: () => void
}

export function useCookieConsent(): UseCookieConsentReturn {
  const [consent, setConsent] = useState<CookieConsent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Load consent from localStorage on mount
  useEffect(() => {
    const stored = getStoredConsent()
    if (stored) {
      setConsent(stored)
      setShowBanner(false)
    } else {
      setConsent(null)
      setShowBanner(true)
    }
    setIsLoading(false)
  }, [])

  const acceptAll = useCallback(() => {
    const newConsent: CookieConsent = {
      essential: true,
      analytics: true,
      marketing: true,
      timestamp: Date.now(),
      version: DEFAULT_CONSENT.version,
    }
    setStoredConsent(newConsent)
    setConsent(newConsent)
    setShowBanner(false)

    // Reload to initialize analytics
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }, [])

  const rejectAll = useCallback(() => {
    const newConsent: CookieConsent = {
      essential: true,
      analytics: false,
      marketing: false,
      timestamp: Date.now(),
      version: DEFAULT_CONSENT.version,
    }
    setStoredConsent(newConsent)
    setConsent(newConsent)
    setShowBanner(false)
  }, [])

  const updateConsent = useCallback((updates: Partial<CookieConsent>) => {
    const newConsent: CookieConsent = {
      essential: true, // Always true
      analytics: updates.analytics ?? consent?.analytics ?? false,
      marketing: updates.marketing ?? consent?.marketing ?? false,
      timestamp: Date.now(),
      version: DEFAULT_CONSENT.version,
    }
    setStoredConsent(newConsent)
    setConsent(newConsent)
    setShowBanner(false)

    // Reload if analytics consent changed
    if (updates.analytics !== undefined && updates.analytics !== consent?.analytics) {
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
    }
  }, [consent])

  const resetConsent = useCallback(() => {
    setConsent(null)
    setShowBanner(true)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sterling_cookie_consent')
    }
  }, [])

  return {
    consent,
    showBanner,
    isLoading,
    acceptAll,
    rejectAll,
    updateConsent,
    resetConsent,
  }
}
