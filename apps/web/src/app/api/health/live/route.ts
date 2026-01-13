import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Kubernetes liveness probe - minimal check
// Returns 200 if process is alive and can handle requests
export async function GET() {
  return NextResponse.json(
    {
      status: 'alive',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}
