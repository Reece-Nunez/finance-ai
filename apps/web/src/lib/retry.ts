import { log } from './logger'

export interface RetryConfig {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  jitterFactor: number
  retryableStatuses: number[]
  onRetry?: (attempt: number, error: Error, delayMs: number) => void
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterFactor: 0.3,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
}

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(message)
    this.name = 'RetryError'
  }
}

export function isRetryableError(
  error: unknown,
  config: RetryConfig
): boolean {
  // Network errors are retryable
  if (error instanceof TypeError) {
    const message = error.message.toLowerCase()
    if (
      message.includes('fetch') ||
      message.includes('network') ||
      message.includes('failed to fetch')
    ) {
      return true
    }
  }

  // Check for errors with status codes
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status
    return config.retryableStatuses.includes(status)
  }

  // Check error messages for known retryable patterns
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('socket hang up') ||
      message.includes('enotfound') ||
      message.includes('econnrefused')
    ) {
      return true
    }
  }

  return false
}

export function calculateDelay(attempt: number, config: RetryConfig): number {
  // Exponential backoff: baseDelay * 2^(attempt-1)
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt - 1)

  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs)

  // Add jitter to prevent thundering herd
  const jitter = cappedDelay * config.jitterFactor * Math.random()

  return Math.floor(cappedDelay + jitter)
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: Error = new Error('Unknown error')

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry if error is not retryable
      if (!isRetryableError(error, finalConfig)) {
        throw lastError
      }

      // Don't wait after last attempt
      if (attempt === finalConfig.maxAttempts) {
        break
      }

      const delayMs = calculateDelay(attempt, finalConfig)

      // Log retry attempt
      log.warn(`Retry attempt ${attempt}/${finalConfig.maxAttempts}`, {
        error: lastError.message,
        delayMs,
        attempt,
      })

      // Callback for custom handling
      finalConfig.onRetry?.(attempt, lastError, delayMs)

      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw new RetryError(
    `Operation failed after ${finalConfig.maxAttempts} attempts: ${lastError.message}`,
    finalConfig.maxAttempts,
    lastError
  )
}

// Convenience wrapper for fetch with retry
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retryConfig?: Partial<RetryConfig>
): Promise<Response> {
  return withRetry(async () => {
    const response = await fetch(url, options)

    // Throw error for retryable status codes
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
      ;(error as Error & { status: number }).status = response.status
      throw error
    }

    return response
  }, retryConfig)
}
