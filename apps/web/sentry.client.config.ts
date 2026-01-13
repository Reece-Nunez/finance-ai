import * as Sentry from '@sentry/nextjs'

// Check for analytics consent before initializing Sentry
function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false

  try {
    const stored = localStorage.getItem('sterling_cookie_consent')
    if (!stored) return false

    const consent = JSON.parse(stored)
    return consent.analytics === true
  } catch {
    return false
  }
}

// Only initialize Sentry if user has given analytics consent
// or if we're in development (for testing)
const shouldInitSentry =
  process.env.NODE_ENV === 'development' || hasAnalyticsConsent()

if (shouldInitSentry) {
  Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Debug (disable in production)
  debug: process.env.NODE_ENV === 'development',

  // Filtering
  ignoreErrors: [
    // Browser extensions
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    // Network errors
    'Network request failed',
    'Failed to fetch',
    'Load failed',
    // User-generated
    'ResizeObserver loop',
    'Non-Error promise rejection',
  ],

  // Release tracking
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'development',

  // Before sending events
  beforeSend(event, hint) {
    // Don't send events in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Sentry] Would send event:', event)
      return null
    }

    // Filter out certain errors
    const error = hint.originalException
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as Error).message

      // Skip 401/403 errors (expected auth failures)
      if (message.includes('401') || message.includes('403')) {
        return null
      }
    }

    return event
  },

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  })
} else {
  console.log('[Sentry] Not initialized - analytics consent not given')
}
