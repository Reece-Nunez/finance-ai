import { withRetry, RetryConfig } from './retry'
import {
  withCircuitBreaker,
  CircuitBreakerConfig,
  CircuitOpenError,
} from './circuit-breaker'
import { log } from './logger'
import { captureException } from './sentry'

type ServiceName = 'plaid' | 'stripe' | 'anthropic'

interface ServiceConfig {
  retry: Partial<RetryConfig>
  circuit: Partial<CircuitBreakerConfig>
}

const SERVICE_CONFIGS: Record<ServiceName, ServiceConfig> = {
  plaid: {
    retry: {
      maxAttempts: 3,
      baseDelayMs: 1000,
      onRetry: (attempt, error, delayMs) => {
        log.warn(`Plaid retry attempt ${attempt}`, {
          error: error.message,
          delayMs,
        })
      },
    },
    circuit: {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
    },
  },
  stripe: {
    retry: {
      maxAttempts: 2,
      baseDelayMs: 500,
      onRetry: (attempt, error, delayMs) => {
        log.warn(`Stripe retry attempt ${attempt}`, {
          error: error.message,
          delayMs,
        })
      },
    },
    circuit: {
      failureThreshold: 10,
      recoveryTimeout: 30000, // 30 seconds
    },
  },
  anthropic: {
    retry: {
      maxAttempts: 2,
      baseDelayMs: 2000,
      retryableStatuses: [429, 500, 502, 503, 529], // 529 = Anthropic overloaded
      onRetry: (attempt, error, delayMs) => {
        log.warn(`Anthropic retry attempt ${attempt}`, {
          error: error.message,
          delayMs,
        })
      },
    },
    circuit: {
      failureThreshold: 3,
      recoveryTimeout: 120000, // 2 minutes
    },
  },
}

export async function callExternalService<T>(
  service: ServiceName,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const config = SERVICE_CONFIGS[service]
  const startTime = Date.now()

  try {
    const result = await withCircuitBreaker(
      service,
      () => withRetry(fn, config.retry),
      config.circuit
    )

    log.api(service, operation, true, Date.now() - startTime)
    return result
  } catch (error) {
    const duration = Date.now() - startTime
    log.api(service, operation, false, duration, {
      error: error instanceof Error ? error.message : String(error),
    })

    // Don't report circuit open errors to Sentry (expected behavior)
    if (!(error instanceof CircuitOpenError) && error instanceof Error) {
      captureException(error, { service, operation, duration })
    }

    throw error
  }
}

// Convenience wrappers for each service
export const resilientPlaid = {
  call: <T>(operation: string, fn: () => Promise<T>) =>
    callExternalService('plaid', operation, fn),
}

export const resilientStripe = {
  call: <T>(operation: string, fn: () => Promise<T>) =>
    callExternalService('stripe', operation, fn),
}

export const resilientAnthropic = {
  call: <T>(operation: string, fn: () => Promise<T>) =>
    callExternalService('anthropic', operation, fn),
}

// Re-export CircuitOpenError for handling in API routes
export { CircuitOpenError }
