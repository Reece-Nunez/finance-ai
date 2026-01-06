import * as Sentry from '@sentry/nextjs'

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
