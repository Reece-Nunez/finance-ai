import pino from 'pino'

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: { env: process.env.NODE_ENV, service: 'sterling-web' },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
    },
  }),
  redact: {
    paths: [
      'password', 'token', 'accessToken', 'refreshToken',
      'apiKey', 'secret', 'authorization', 'cookie',
      'req.headers.authorization', 'req.headers.cookie',
    ],
    remove: true,
  },
})

type LogContext = Record<string, unknown>

export function createLogger(module: string) {
  return logger.child({ module })
}

export const log = {
  debug: (message: string, context?: LogContext) => logger.debug(context || {}, message),
  info: (message: string, context?: LogContext) => logger.info(context || {}, message),
  warn: (message: string, context?: LogContext) => logger.warn(context || {}, message),

  error: (message: string, error?: Error | unknown, context?: LogContext) => {
    const errorContext = error instanceof Error
      ? { error: { message: error.message, name: error.name, stack: error.stack }, ...context }
      : { error, ...context }
    logger.error(errorContext, message)
  },

  request: (method: string, path: string, statusCode: number, durationMs: number, context?: LogContext) => {
    logger.info({ type: 'request', method, path, statusCode, durationMs, ...context }, `${method} ${path} ${statusCode} ${durationMs}ms`)
  },

  api: (service: string, operation: string, success: boolean, durationMs: number, context?: LogContext) => {
    const level = success ? 'info' : 'error'
    logger[level]({ type: 'api_call', service, operation, success, durationMs, ...context }, `${service}.${operation} ${success ? 'succeeded' : 'failed'} in ${durationMs}ms`)
  },

  action: (userId: string, action: string, context?: LogContext) => {
    logger.info({ type: 'user_action', userId, action, ...context }, `User ${userId} performed ${action}`)
  },

  perf: (operation: string, durationMs: number, context?: LogContext) => {
    logger.info({ type: 'performance', operation, durationMs, ...context }, `${operation} completed in ${durationMs}ms`)
  },
}

export { logger }
