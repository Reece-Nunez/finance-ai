// Sentry temporarily disabled for Amplify deployment compatibility
// TODO: Re-enable once AWS fixes OpenTelemetry bundling issues

// No-op helper functions that maintain the same API
export function captureException(
  _error: Error,
  _context?: Record<string, unknown>
) {
  // No-op: Sentry disabled
  if (process.env.NODE_ENV === 'development') {
    console.error('[Sentry disabled]', _error)
  }
}

export function captureMessage(
  _message: string,
  _level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'info'
) {
  // No-op: Sentry disabled
  if (process.env.NODE_ENV === 'development') {
    console.log('[Sentry disabled]', _message)
  }
}

export function setUser(_user: { id: string; email?: string } | null) {
  // No-op: Sentry disabled
}

export function addBreadcrumb(_breadcrumb: {
  category?: string
  message?: string
  level?: string
  data?: Record<string, unknown>
}) {
  // No-op: Sentry disabled
}

// Export a mock Sentry object for direct access compatibility
export const Sentry = {
  captureException,
  captureMessage,
  setUser,
  addBreadcrumb,
  withScope: (callback: (scope: unknown) => void) => {
    callback({
      setExtras: () => {},
      setExtra: () => {},
      setTag: () => {},
      setTags: () => {},
    })
  },
}
