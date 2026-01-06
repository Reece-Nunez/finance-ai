import pino from 'pino'

// Determine log level based on environment
const getLogLevel = () => {
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug'
}

// Create the base logger
const logger = pino({
  level: getLogLevel(),

  // Base configuration
  base: {
    env: process.env.NODE_ENV,
    service: 'sterling-web',
  },

  // Timestamp formatting
  timestamp: pino.stdTimeFunctions.isoTime,

  // Format options for development
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),

  // Redact sensitive fields
  redact: {
    paths: [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'apiKey',
      'secret',
      'authorization',
      'cookie',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    remove: true,
  },
})

// Type for log context
type LogContext = Record<string, unknown>

// Create child logger for specific modules
export function createLogger(module: string) {
  return logger.child({ module })
}

// Convenience methods with context
export const log = {
  debug: (message: string, context?: LogContext) => {
    logger.debug(context || {}, message)
  },

  info: (message: string, context?: LogContext) => {
    logger.info(context || {}, message)
  },

  warn: (message: string, context?: LogContext) => {
    logger.warn(context || {}, message)
  },

  error: (message: string, error?: Error | unknown, context?: LogContext) => {
    const errorContext = error instanceof Error
      ? {
          error: {
            message: error.message,
            name: error.name,
            stack: error.stack,
          },
          ...context,
        }
      : { error, ...context }

    logger.error(errorContext, message)
  },

  // Request logging helper
  request: (
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    context?: LogContext
  ) => {
    logger.info(
      {
        type: 'request',
        method,
        path,
        statusCode,
        durationMs,
        ...context,
      },
      `${method} ${path} ${statusCode} ${durationMs}ms`
    )
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
    logger[level](
      {
        type: 'api_call',
        service,
        operation,
        success,
        durationMs,
        ...context,
      },
      `${service}.${operation} ${success ? 'succeeded' : 'failed'} in ${durationMs}ms`
    )
  },

  // User action logging helper
  action: (
    userId: string,
    action: string,
    context?: LogContext
  ) => {
    logger.info(
      {
        type: 'user_action',
        userId,
        action,
        ...context,
      },
      `User ${userId} performed ${action}`
    )
  },

  // Performance logging helper
  perf: (
    operation: string,
    durationMs: number,
    context?: LogContext
  ) => {
    logger.info(
      {
        type: 'performance',
        operation,
        durationMs,
        ...context,
      },
      `${operation} completed in ${durationMs}ms`
    )
  },
}

// Export base logger for advanced usage
export { logger }
