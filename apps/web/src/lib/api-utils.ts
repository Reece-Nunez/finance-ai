import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMITS, type RateLimitConfig } from './rate-limit'
import { auditLog, getRequestMetadata, type AuditAction } from './audit'
import { hasPermission, type Permission } from './rbac'
import { log } from './logger'
import { captureException } from './sentry'

export interface ApiHandlerOptions {
  rateLimit?: RateLimitConfig
  permission?: Permission
  requireAuth?: boolean
  audit?: {
    action: AuditAction
    resourceType?: string
  }
  bodySchema?: z.ZodSchema
  querySchema?: z.ZodSchema
}

export interface ApiContext {
  user: { id: string; email?: string } | null
  request: NextRequest
  body?: unknown
  query?: unknown
}

type ApiHandler = (context: ApiContext) => Promise<NextResponse>

export function createApiHandler(handler: ApiHandler, options: ApiHandlerOptions = {}) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now()
    const { ipAddress, userAgent } = getRequestMetadata(request)

    try {
      if (options.rateLimit) {
        const rateLimitResponse = await rateLimit(request, options.rateLimit)
        if (rateLimitResponse) {
          await auditLog({
            action: 'security.rate_limited',
            ipAddress,
            userAgent,
            severity: 'warning',
            details: { path: request.nextUrl.pathname },
          })
          return rateLimitResponse
        }
      }

      let user: { id: string; email?: string } | null = null
      if (options.requireAuth || options.permission) {
        const supabase = await createClient()
        const { data: { user: authUser }, error } = await supabase.auth.getUser()

        if (error || !authUser) {
          await auditLog({
            action: 'security.invalid_token',
            ipAddress,
            userAgent,
            severity: 'warning',
            details: { path: request.nextUrl.pathname },
          })
          return NextResponse.json(
            { error: 'Unauthorized', message: 'Authentication required' },
            { status: 401 }
          )
        }

        user = { id: authUser.id, email: authUser.email }
      }

      if (options.permission) {
        const allowed = await hasPermission(options.permission, user?.id)
        if (!allowed) {
          await auditLog({
            action: 'security.suspicious_activity',
            userId: user?.id,
            ipAddress,
            userAgent,
            severity: 'warning',
            details: { path: request.nextUrl.pathname, deniedPermission: options.permission },
          })
          return NextResponse.json(
            { error: 'Forbidden', message: 'Insufficient permissions' },
            { status: 403 }
          )
        }
      }

      let body: unknown
      if (options.bodySchema) {
        try {
          const rawBody = await request.json()
          const result = options.bodySchema.safeParse(rawBody)
          if (!result.success) {
            return NextResponse.json(
              {
                error: 'Validation Error',
                message: result.error.issues[0]?.message || 'Invalid request body',
                details: result.error.issues,
              },
              { status: 400 }
            )
          }
          body = result.data
        } catch {
          return NextResponse.json(
            { error: 'Bad Request', message: 'Invalid JSON body' },
            { status: 400 }
          )
        }
      }

      let query: unknown
      if (options.querySchema) {
        const searchParams = Object.fromEntries(request.nextUrl.searchParams)
        const result = options.querySchema.safeParse(searchParams)
        if (!result.success) {
          return NextResponse.json(
            {
              error: 'Validation Error',
              message: result.error.issues[0]?.message || 'Invalid query parameters',
              details: result.error.issues,
            },
            { status: 400 }
          )
        }
        query = result.data
      }

      const response = await handler({ user, request, body, query })
      const duration = Date.now() - startTime

      if (options.audit) {
        await auditLog({
          action: options.audit.action,
          userId: user?.id,
          resourceType: options.audit.resourceType,
          ipAddress,
          userAgent,
          severity: 'info',
          details: { durationMs: duration, statusCode: response.status },
        })
      }

      log.request(request.method, request.nextUrl.pathname, response.status, duration, { userId: user?.id })

      return response
    } catch (error) {
      const duration = Date.now() - startTime

      log.error('API handler error', error, {
        path: request.nextUrl.pathname,
        method: request.method,
        durationMs: duration,
      })

      if (error instanceof Error) {
        captureException(error, { path: request.nextUrl.pathname, method: request.method })
      }

      if (options.audit) {
        await auditLog({
          action: options.audit.action,
          ipAddress,
          userAgent,
          severity: 'error',
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
            durationMs: duration,
          },
        })
      }

      return NextResponse.json(
        { error: 'Internal Server Error', message: 'An unexpected error occurred' },
        { status: 500 }
      )
    }
  }
}
