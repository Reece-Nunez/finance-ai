import { createClient } from '@/lib/supabase/server'
import { log } from './logger'

// Audit event types
export type AuditAction =
  // Authentication
  | 'auth.login'
  | 'auth.logout'
  | 'auth.signup'
  | 'auth.password_reset'
  | 'auth.password_change'
  | 'auth.mfa_enabled'
  | 'auth.mfa_disabled'
  // Account management
  | 'account.linked'
  | 'account.unlinked'
  | 'account.synced'
  | 'account.sync_failed'
  // Transactions
  | 'transaction.viewed'
  | 'transaction.updated'
  | 'transaction.categorized'
  | 'transaction.batch_categorized'
  | 'transaction.exported'
  // Budgets
  | 'budget.created'
  | 'budget.updated'
  | 'budget.deleted'
  // Settings
  | 'settings.updated'
  | 'settings.notifications_changed'
  // Subscription
  | 'subscription.started'
  | 'subscription.cancelled'
  | 'subscription.renewed'
  | 'subscription.upgraded'
  | 'subscription.downgraded'
  // Data
  | 'data.exported'
  | 'data.deleted'
  | 'data.accessed'
  // AI features
  | 'ai.chat_started'
  | 'ai.report_generated'
  | 'ai.categorization_used'
  // Admin actions
  | 'admin.user_viewed'
  | 'admin.user_modified'
  | 'admin.user_deleted'
  | 'admin.settings_changed'
  | 'admin.backup_status_checked'
  | 'admin.backup_triggered'
  | 'admin.backup_failed'
  // Cron jobs
  | 'cron.sync_accounts'
  | 'cron.completed'
  | 'cron.failed'
  // Security events
  | 'security.suspicious_activity'
  | 'security.rate_limited'
  | 'security.invalid_token'

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical'

export interface AuditLogEntry {
  action: AuditAction
  userId?: string
  resourceType?: string
  resourceId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  severity?: AuditSeverity
}

interface AuditLogRecord {
  id: string
  user_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  details: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  severity: string
  created_at: string
}

/**
 * Log an audit event to the database and structured logger
 */
export async function auditLog(entry: AuditLogEntry): Promise<void> {
  const {
    action,
    userId,
    resourceType,
    resourceId,
    details = {},
    ipAddress,
    userAgent,
    severity = 'info',
  } = entry

  // Always log to structured logger
  log.info(`Audit: ${action}`, {
    type: 'audit',
    action,
    userId,
    resourceType,
    resourceId,
    severity,
    ...details,
  })

  // Log to database for persistence and querying
  try {
    const supabase = await createClient()

    await supabase.from('audit_logs').insert({
      user_id: userId || null,
      action,
      resource_type: resourceType || null,
      resource_id: resourceId || null,
      details,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      severity,
    })
  } catch (error) {
    // Don't fail the request if audit logging fails
    // But do log the error
    log.error('Failed to write audit log', error, {
      action,
      userId,
      resourceType,
      resourceId,
    })
  }
}

/**
 * Get audit logs for a specific user
 */
export async function getAuditLogsForUser(
  userId: string,
  options: {
    limit?: number
    offset?: number
    action?: AuditAction
    startDate?: Date
    endDate?: Date
  } = {}
): Promise<AuditLogRecord[]> {
  const { limit = 50, offset = 0, action, startDate, endDate } = options

  const supabase = await createClient()

  let query = supabase
    .from('audit_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (action) {
    query = query.eq('action', action)
  }

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString())
  }

  if (endDate) {
    query = query.lte('created_at', endDate.toISOString())
  }

  const { data, error } = await query

  if (error) {
    log.error('Failed to fetch audit logs', error, { userId })
    throw new Error('Failed to fetch audit logs')
  }

  return data || []
}

/**
 * Helper to extract request metadata for audit logging
 */
export function getRequestMetadata(request: Request): {
  ipAddress: string
  userAgent: string
} {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const userAgent = request.headers.get('user-agent') || 'unknown'

  let ipAddress = 'unknown'
  if (forwardedFor) {
    ipAddress = forwardedFor.split(',')[0].trim()
  } else if (realIp) {
    ipAddress = realIp
  }

  return { ipAddress, userAgent }
}

/**
 * Audit log decorator for API routes
 */
export function withAuditLog(
  action: AuditAction,
  options: {
    resourceType?: string
    getResourceId?: (request: Request) => string | undefined
    getDetails?: (request: Request, response: Response) => Record<string, unknown>
  } = {}
) {
  return function <T extends (...args: [Request, ...unknown[]]) => Promise<Response>>(
    handler: T
  ): T {
    return (async (request: Request, ...args: unknown[]) => {
      const { ipAddress, userAgent } = getRequestMetadata(request)
      const startTime = Date.now()

      try {
        const response = await handler(request, ...args)
        const duration = Date.now() - startTime

        // Log successful action
        await auditLog({
          action,
          resourceType: options.resourceType,
          resourceId: options.getResourceId?.(request),
          details: {
            ...options.getDetails?.(request, response),
            durationMs: duration,
            statusCode: response.status,
          },
          ipAddress,
          userAgent,
          severity: response.ok ? 'info' : 'warning',
        })

        return response
      } catch (error) {
        const duration = Date.now() - startTime

        // Log failed action
        await auditLog({
          action,
          resourceType: options.resourceType,
          resourceId: options.getResourceId?.(request),
          details: {
            durationMs: duration,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          ipAddress,
          userAgent,
          severity: 'error',
        })

        throw error
      }
    }) as T
  }
}
