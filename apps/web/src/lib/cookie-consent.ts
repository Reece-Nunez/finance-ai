// Cookie consent configuration and utilities

export const CONSENT_STORAGE_KEY = 'sterling_cookie_consent'
export const CONSENT_VERSION = 1
export const CONSENT_EXPIRY_DAYS = 365 // 12 months

export interface CookieConsent {
  essential: boolean // Always true, cannot be disabled
  analytics: boolean // Sentry, future Google Analytics
  marketing: boolean // Future marketing pixels
  timestamp: number
  version: number
}

export const DEFAULT_CONSENT: CookieConsent = {
  essential: true,
  analytics: false,
  marketing: false,
  timestamp: 0,
  version: CONSENT_VERSION,
}

export const CONSENT_CATEGORIES = {
  essential: {
    name: 'Essential',
    description:
      'Required for the app to function. Includes authentication, security, and payment processing.',
    required: true,
  },
  analytics: {
    name: 'Analytics',
    description:
      'Help us understand how you use the app to improve your experience. Includes error tracking.',
    required: false,
  },
  marketing: {
    name: 'Marketing',
    description:
      'Allow us to show you relevant offers and measure advertising effectiveness.',
    required: false,
  },
} as const

export function getStoredConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!stored) return null

    const consent = JSON.parse(stored) as CookieConsent

    // Check if consent has expired (12 months)
    const expiryMs = CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    if (Date.now() - consent.timestamp > expiryMs) {
      localStorage.removeItem(CONSENT_STORAGE_KEY)
      return null
    }

    // Check if consent version matches
    if (consent.version !== CONSENT_VERSION) {
      localStorage.removeItem(CONSENT_STORAGE_KEY)
      return null
    }

    return consent
  } catch {
    return null
  }
}

export function setStoredConsent(consent: Partial<CookieConsent>): void {
  if (typeof window === 'undefined') return

  try {
    const fullConsent: CookieConsent = {
      essential: true, // Always true
      analytics: consent.analytics ?? false,
      marketing: consent.marketing ?? false,
      timestamp: Date.now(),
      version: CONSENT_VERSION,
    }
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(fullConsent))
  } catch {
    // Ignore storage errors
  }
}

export function clearStoredConsent(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(CONSENT_STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}

export function hasAnalyticsConsent(): boolean {
  const consent = getStoredConsent()
  return consent?.analytics ?? false
}

export function hasMarketingConsent(): boolean {
  const consent = getStoredConsent()
  return consent?.marketing ?? false
}
