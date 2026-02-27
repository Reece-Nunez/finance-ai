// Sentry disabled for Amplify deployment compatibility
export function captureException(
  _error: Error,
  _context?: Record<string, unknown>
) {
  if (process.env.NODE_ENV === 'development') {
    console.error('[Sentry disabled]', _error)
  }
}
