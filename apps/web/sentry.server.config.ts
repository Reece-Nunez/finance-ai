import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV,

  // Disable tracing entirely to avoid OpenTelemetry/Amplify bundling issues
  tracesSampleRate: 0,

  // Debug (disable in production)
  debug: process.env.NODE_ENV === 'development',

  // Release tracking
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'development',

  // Disable ESM loader hooks to fix Amplify bundling issues
  registerEsmLoaderHooks: false,

  // Empty integrations to prevent any auto-instrumentation
  integrations: [],

  // Before sending events
  beforeSend(event, hint) {
    // Don't send events in development
    if (process.env.NODE_ENV === 'development') {
      return null
    }

    return event
  },
})
