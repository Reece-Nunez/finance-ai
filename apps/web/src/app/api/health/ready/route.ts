import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const startTime = Date.now()
  const dbCheck = await checkDatabase()

  const isReady = dbCheck.status !== 'unhealthy'

  return NextResponse.json(
    {
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: { database: dbCheck },
      responseTimeMs: Date.now() - startTime,
    },
    {
      status: isReady ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    }
  )
}

async function checkDatabase() {
  const startTime = Date.now()

  try {
    const supabase = await createClient()
    const { error } = await supabase.from('user_profiles').select('id').limit(1)

    if (error) {
      return { status: 'unhealthy' as const, responseTimeMs: Date.now() - startTime, error: error.message }
    }

    const responseTimeMs = Date.now() - startTime
    return {
      status: (responseTimeMs > 1000 ? 'degraded' : 'healthy') as 'degraded' | 'healthy',
      responseTimeMs,
    }
  } catch (error) {
    return {
      status: 'unhealthy' as const,
      responseTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
