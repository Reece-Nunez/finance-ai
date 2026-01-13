import { log } from './logger'

export type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerConfig {
  failureThreshold: number
  recoveryTimeout: number
  halfOpenMaxAttempts: number
  monitoringWindow: number
}

export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeout: 30000,
  halfOpenMaxAttempts: 3,
  monitoringWindow: 60000,
}

interface CircuitStats {
  failures: number[]
  state: CircuitState
  lastStateChange: number
  halfOpenSuccesses: number
}

// In-memory circuit state
const circuits = new Map<string, CircuitStats>()

export class CircuitOpenError extends Error {
  constructor(
    public readonly service: string,
    public readonly timeUntilRetry: number
  ) {
    super(
      `Circuit breaker is open for ${service}. Retry in ${Math.ceil(timeUntilRetry / 1000)}s`
    )
    this.name = 'CircuitOpenError'
  }
}

function getCircuit(service: string): CircuitStats {
  if (!circuits.has(service)) {
    circuits.set(service, {
      failures: [],
      state: 'closed',
      lastStateChange: Date.now(),
      halfOpenSuccesses: 0,
    })
  }
  return circuits.get(service)!
}

function cleanOldFailures(
  stats: CircuitStats,
  config: CircuitBreakerConfig
): void {
  const cutoff = Date.now() - config.monitoringWindow
  stats.failures = stats.failures.filter((ts) => ts > cutoff)
}

export function getCircuitState(service: string): CircuitState {
  return getCircuit(service).state
}

export function checkCircuit(
  service: string,
  config: Partial<CircuitBreakerConfig> = {}
): void {
  const finalConfig = { ...DEFAULT_CIRCUIT_CONFIG, ...config }
  const stats = getCircuit(service)

  cleanOldFailures(stats, finalConfig)

  if (stats.state === 'open') {
    const timeSinceOpen = Date.now() - stats.lastStateChange
    if (timeSinceOpen >= finalConfig.recoveryTimeout) {
      stats.state = 'half-open'
      stats.halfOpenSuccesses = 0
      stats.lastStateChange = Date.now()
      log.info(`Circuit breaker for ${service} transitioning to half-open`)
    } else {
      throw new CircuitOpenError(
        service,
        finalConfig.recoveryTimeout - timeSinceOpen
      )
    }
  }
}

export function recordSuccess(
  service: string,
  config: Partial<CircuitBreakerConfig> = {}
): void {
  const finalConfig = { ...DEFAULT_CIRCUIT_CONFIG, ...config }
  const stats = getCircuit(service)

  if (stats.state === 'half-open') {
    stats.halfOpenSuccesses++
    if (stats.halfOpenSuccesses >= finalConfig.halfOpenMaxAttempts) {
      stats.state = 'closed'
      stats.failures = []
      stats.lastStateChange = Date.now()
      log.info(`Circuit breaker for ${service} closed after recovery`)
    }
  }
}

export function recordFailure(
  service: string,
  config: Partial<CircuitBreakerConfig> = {}
): void {
  const finalConfig = { ...DEFAULT_CIRCUIT_CONFIG, ...config }
  const stats = getCircuit(service)

  stats.failures.push(Date.now())
  cleanOldFailures(stats, finalConfig)

  if (stats.state === 'half-open') {
    stats.state = 'open'
    stats.lastStateChange = Date.now()
    log.warn(`Circuit breaker for ${service} re-opened from half-open`)
    return
  }

  if (
    stats.state === 'closed' &&
    stats.failures.length >= finalConfig.failureThreshold
  ) {
    stats.state = 'open'
    stats.lastStateChange = Date.now()
    log.warn(
      `Circuit breaker for ${service} opened after ${stats.failures.length} failures`
    )
  }
}

export async function withCircuitBreaker<T>(
  service: string,
  fn: () => Promise<T>,
  config: Partial<CircuitBreakerConfig> = {}
): Promise<T> {
  checkCircuit(service, config)

  try {
    const result = await fn()
    recordSuccess(service, config)
    return result
  } catch (error) {
    recordFailure(service, config)
    throw error
  }
}

export function getCircuitStatus(service: string): {
  state: CircuitState
  failures: number
  lastStateChange: number
} {
  const stats = getCircuit(service)
  return {
    state: stats.state,
    failures: stats.failures.length,
    lastStateChange: stats.lastStateChange,
  }
}

// Reset circuit for testing purposes
export function resetCircuit(service: string): void {
  circuits.delete(service)
}

// Get all circuit statuses for health checks
export function getAllCircuitStatuses(): Record<
  string,
  { state: CircuitState; failures: number }
> {
  const statuses: Record<string, { state: CircuitState; failures: number }> = {}
  for (const [service, stats] of circuits) {
    statuses[service] = {
      state: stats.state,
      failures: stats.failures.length,
    }
  }
  return statuses
}
