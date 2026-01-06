import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, RATE_LIMITS, type RateLimitConfig } from './rate-limit'
import { auditLog, getRequestMetadata, type AuditAction } from './audit'
import { hasPermission, type Permission } from './rbac'
import { log } from './logger'
import { captureException } from './sentry'

export interface ApiHandlerOptions {
  // Rate limiting
  rateLimit?: RateLimitConfig
  // Required permission
  permission?: Permission
  // Require authentication
  requireAuth?: boolean
  // Audit logging
  audit?: {
    action: AuditAction
    resourceType?: string
  }
  // Request body validation schema
  bodySchema?: z.ZodSchema
  // Query params validation schema
  querySchema?: z.ZodSchema
}

export interface ApiContext {
  user: { id: string; email?: string } | null
  request: NextRequest
  body?: unknown
  query?: unknown
}

type ApiHandler = (context: ApiContext) => Promise<NextResponse>

/**
 * Create a secure API handler with built-in security features
 *
 * @example
 * ```ts
 * export const POST = createApiHandler(
 *   async ({ user, body }) => {
 *     // Your handler logic
 *     return NextResponse.json({ success: true })
 *   },
 *   {
 *     requireAuth: true,
 *     permission: 'transactions:write',
 *     rateLimit: RATE_LIMITS.api,
 *     bodySchema: updateTransactionSchema,
 *     audit: { action: 'transaction.updated', resourceType: 'transaction' }
 *   }
 * )
 * ```
 */
export function createApiHandler(
  handler: ApiHandler,
  options: ApiHandlerOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now()
    const { ipAddress, userAgent } = getRequestMetadata(request)

    try {
      // 1. Rate limiting
      if (options.rateLimit) {
        const rateLimitResponse = rateLimit(request, options.rateLimit)
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

      // 2. Authentication check
      let user: { id: string; email?: string } | null = null
      if (options.requireAuth || options.permission) {
        const supabase = await createClient()
        const {
          data: { user: authUser },
          error,
        } = await supabase.auth.getUser()

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

      // 3. Permission check
      if (options.permission) {
        const allowed = await hasPermission(options.permission, user?.id)
        if (!allowed) {
          await auditLog({
            action: 'security.suspicious_activity',
            userId: user?.id,
            ipAddress,
            userAgent,
            severity: 'warning',
            details: {
              path: request.nextUrl.pathname,
              deniedPermission: options.permission,
            },
          })

          return NextResponse.json(
            { error: 'Forbidden', message: 'Insufficient permissions' },
            { status: 403 }
          )
        }
      }

      // 4. Request body validation
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

      // 5. Query params validation
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

      // 6. Execute handler
      const response = await handler({ user, request, body, query })
      const duration = Date.now() - startTime

      // 7. Audit log (success)
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

      // 8. Log request
      log.request(
        request.method,
        request.nextUrl.pathname,
        response.status,
        duration,
        { userId: user?.id }
      )

      return response
    } catch (error) {
      const duration = Date.now() - startTime

      // Log error
      log.error('API handler error', error, {
        path: request.nextUrl.pathname,
        method: request.method,
        durationMs: duration,
      })

      // Report to Sentry
      if (error instanceof Error) {
        captureException(error, {
          path: request.nextUrl.pathname,
          method: request.method,
        })
      }

      // Audit log (error)
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

/**
 * Simple wrapper for public API routes with just rate limiting
 */
export function createPublicApiHandler(
  handler: ApiHandler,
  rateLimitConfig: RateLimitConfig = RATE_LIMITS.api
) {
  return createApiHandler(handler, {
    rateLimit: rateLimitConfig,
    requireAuth: false,
  })
}

/**
 * Wrapper for authenticated API routes
 */
export function createAuthenticatedApiHandler(
  handler: ApiHandler,
  options: Omit<ApiHandlerOptions, 'requireAuth'> = {}
) {
  return createApiHandler(handler, {
    ...options,
    requireAuth: true,
    rateLimit: options.rateLimit || RATE_LIMITS.api,
  })
}

/**
 * Wrapper for admin-only API routes
 */
export function createAdminApiHandler(
  handler: ApiHandler,
  options: Omit<ApiHandlerOptions, 'requireAuth'> = {}
) {
  return createApiHandler(handler, {
    ...options,
    requireAuth: true,
    permission: 'system:settings',
    rateLimit: options.rateLimit || RATE_LIMITS.strict,
  })
}
