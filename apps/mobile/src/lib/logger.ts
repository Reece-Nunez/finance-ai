import { captureException, captureMessage, addBreadcrumb } from './sentry'

// Log levels
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// Type for log context
type LogContext = Record<string, unknown>

// Get current timestamp in ISO format
const getTimestamp = () => new Date().toISOString()

// Check if we should log at this level
const shouldLog = (level: LogLevel): boolean => {
  if (__DEV__) return true

  // In production, only log warn and error
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
  const minLevelIndex = levels.indexOf('warn')
  const currentLevelIndex = levels.indexOf(level)
  return currentLevelIndex >= minLevelIndex
}

// Format log message for console
const formatMessage = (
  level: LogLevel,
  module: string | null,
  message: string,
  context?: LogContext
): string => {
  const timestamp = getTimestamp()
  const modulePrefix = module ? `[${module}] ` : ''
  const contextStr = context ? ` ${JSON.stringify(context)}` : ''
  return `${timestamp} ${level.toUpperCase()} ${modulePrefix}${message}${contextStr}`
}

// Internal log function
const logInternal = (
  level: LogLevel,
  module: string | null,
  message: string,
  context?: LogContext,
  error?: Error | unknown
) => {
  if (!shouldLog(level)) return

  const formattedMessage = formatMessage(level, module, message, context)

  // Console output
  switch (level) {
    case 'debug':
      console.debug(formattedMessage)
      break
    case 'info':
      console.info(formattedMessage)
      break
    case 'warn':
      console.warn(formattedMessage)
      break
    case 'error':
      console.error(formattedMessage, error)
      break
  }

  // Add breadcrumb to Sentry for tracking
  if (level !== 'debug') {
    addBreadcrumb({
      category: module || 'app',
      message,
      level: level === 'warn' ? 'warning' : level,
      data: context,
    })
  }

  // Send errors to Sentry in production
  if (level === 'error' && !__DEV__) {
    if (error instanceof Error) {
      captureException(error, context)
    } else {
      captureMessage(message, 'error')
    }
  }
}

// Create child logger for specific modules
export function createLogger(module: string) {
  return {
    debug: (message: string, context?: LogContext) =>
      logInternal('debug', module, message, context),

    info: (message: string, context?: LogContext) =>
      logInternal('info', module, message, context),

    warn: (message: string, context?: LogContext) =>
      logInternal('warn', module, message, context),

    error: (message: string, error?: Error | unknown, context?: LogContext) =>
      logInternal('error', module, message, context, error),
  }
}

// Convenience methods with context (matches web API)
export const log = {
  debug: (message: string, context?: LogContext) => {
    logInternal('debug', null, message, context)
  },

  info: (message: string, context?: LogContext) => {
    logInternal('info', null, message, context)
  },

  warn: (message: string, context?: LogContext) => {
    logInternal('warn', null, message, context)
  },

  error: (message: string, error?: Error | unknown, context?: LogContext) => {
    logInternal('error', null, message, context, error)
  },

  // API call logging helper
  api: (
    service: string,
    operation: string,
    success: boolean,
    durationMs: number,
    context?: LogContext
  ) => {
    const level = success ? 'info' : 'error'
    logInternal(
      level,
      null,
      `${service}.${operation} ${success ? 'succeeded' : 'failed'} in ${durationMs}ms`,
      {
        type: 'api_call',
        service,
        operation,
        success,
        durationMs,
        ...context,
      }
    )
  },

  // User action logging helper
  action: (userId: string, action: string, context?: LogContext) => {
    logInternal('info', null, `User ${userId} performed ${action}`, {
      type: 'user_action',
      userId,
      action,
      ...context,
    })
  },

  // Performance logging helper
  perf: (operation: string, durationMs: number, context?: LogContext) => {
    logInternal('info', null, `${operation} completed in ${durationMs}ms`, {
      type: 'performance',
      operation,
      durationMs,
      ...context,
    })
  },

  // Navigation logging helper (mobile specific)
  navigation: (screen: string, params?: LogContext) => {
    logInternal('debug', 'navigation', `Navigated to ${screen}`, {
      type: 'navigation',
      screen,
      params,
    })
  },
}
