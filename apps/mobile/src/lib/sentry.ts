import * as Sentry from '@sentry/react-native'

// Initialize Sentry for the mobile app
export function initSentry() {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,

    // Environment
    environment: __DEV__ ? 'development' : 'production',

    // Performance Monitoring
    tracesSampleRate: __DEV__ ? 1.0 : 0.1,

    // Debug (disable in production)
    debug: __DEV__,

    // Enabled in production only
    enabled: !__DEV__,

    // Before sending events
    beforeSend(event, hint) {
      // Don't send events in development
      if (__DEV__) {
        console.log('[Sentry] Would send event:', event.message || event.exception)
        return null
      }

      // Filter out certain errors
      const error = hint.originalException
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as Error).message

        // Skip network errors that are expected
        if (
          message.includes('Network request failed') ||
          message.includes('Failed to fetch')
        ) {
          return null
        }

        // Skip 401/403 errors (expected auth failures)
        if (message.includes('401') || message.includes('403')) {
          return null
        }
      }

      return event
    },

    // Ignore common errors
    ignoreErrors: [
      // Network errors
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      // User navigation
      'Aborted',
      'cancelled',
      // React Native specific
      'Non-Error promise rejection',
    ],
  })
}

// Helper to capture exceptions with context
export function captureException(
  error: Error,
  context?: Record<string, unknown>
) {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context)
    }
    Sentry.captureException(error)
  })
}

// Helper to capture messages
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info'
) {
  Sentry.captureMessage(message, level)
}

// Helper to set user context
export function setUser(user: { id: string; email?: string } | null) {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
    })
  } else {
    Sentry.setUser(null)
  }
}

// Helper to add breadcrumb
export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
  Sentry.addBreadcrumb(breadcrumb)
}

// Export Sentry for direct access when needed
export { Sentry }
