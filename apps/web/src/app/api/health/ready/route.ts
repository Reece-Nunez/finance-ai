import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCircuitStatus } from '@/lib/circuit-breaker'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTimeMs?: number
  error?: string
}

interface ServiceStatus {
  state: string
  failures: number
}

interface ReadinessResponse {
  status: 'ready' | 'not_ready'
  timestamp: string
  checks: {
    database: HealthCheck
    services: {
      plaid: ServiceStatus
      stripe: ServiceStatus
      anthropic: ServiceStatus
    }
  }
  responseTimeMs: number
}

export async function GET(): Promise<NextResponse<ReadinessResponse>> {
  const startTime = Date.now()

  // Database health check
  const dbCheck = await checkDatabase()

  // Get circuit breaker status for external services
  const plaidStatus = getCircuitStatus('plaid')
  const stripeStatus = getCircuitStatus('stripe')
  const anthropicStatus = getCircuitStatus('anthropic')

  // Determine overall status - ready if database is not unhealthy
  const isReady = dbCheck.status !== 'unhealthy'

  const response: ReadinessResponse = {
    status: isReady ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks: {
      database: dbCheck,
      services: {
        plaid: { state: plaidStatus.state, failures: plaidStatus.failures },
        stripe: { state: stripeStatus.state, failures: stripeStatus.failures },
        anthropic: {
          state: anthropicStatus.state,
          failures: anthropicStatus.failures,
        },
      },
    },
    responseTimeMs: Date.now() - startTime,
  }

  return NextResponse.json(response, {
    status: isReady ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}

async function checkDatabase(): Promise<HealthCheck> {
  const startTime = Date.now()

  try {
    const supabase = await createClient()

    // Simple query to verify database connectivity
    const { error } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1)

    if (error) {
      return {
        status: 'unhealthy',
        responseTimeMs: Date.now() - startTime,
        error: error.message,
      }
    }

    const responseTimeMs = Date.now() - startTime

    // Degraded if response is slow (> 1 second)
    if (responseTimeMs > 1000) {
      return {
        status: 'degraded',
        responseTimeMs,
      }
    }

    return {
      status: 'healthy',
      responseTimeMs,
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
