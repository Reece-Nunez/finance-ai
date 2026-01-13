import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { log } from '@/lib/logger'
import { auditLog, getRequestMetadata } from '@/lib/audit'

// Admin API key for protecting admin endpoints
const ADMIN_API_KEY = process.env.ADMIN_API_KEY

/**
 * Verify admin API key from request headers
 */
function verifyAdminKey(request: NextRequest): boolean {
  if (!ADMIN_API_KEY) {
    log.warn('ADMIN_API_KEY not configured')
    return false
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false

  // Support both "Bearer <key>" and "<key>" formats
  const key = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader

  return key === ADMIN_API_KEY
}

/**
 * GET /api/admin/backup - Check backup status
 *
 * Returns information about the last backup and database health
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { ipAddress, userAgent } = getRequestMetadata(request)

  // Verify admin key
  if (!verifyAdminKey(request)) {
    await auditLog({
      action: 'security.suspicious_activity',
      ipAddress,
      userAgent,
      severity: 'warning',
      details: {
        path: '/api/admin/backup',
        reason: 'Invalid or missing admin API key',
      },
    })

    return NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid admin API key' },
      { status: 401 }
    )
  }

  try {
    const supabase = await createClient()

    // Get database health stats
    const [
      { count: userCount },
      { count: transactionCount },
      { count: accountCount },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('transactions').select('*', { count: 'exact', head: true }),
      supabase.from('plaid_accounts').select('*', { count: 'exact', head: true }),
    ])

    // Get last sync time as proxy for data freshness
    const { data: lastSync } = await supabase
      .from('plaid_items')
      .select('last_synced_at')
      .order('last_synced_at', { ascending: false })
      .limit(1)
      .single()

    await auditLog({
      action: 'admin.backup_status_checked',
      ipAddress,
      userAgent,
      severity: 'info',
      details: { userCount, transactionCount, accountCount },
    })

    return NextResponse.json({
      status: 'healthy',
      database: {
        provider: 'supabase',
        region: process.env.SUPABASE_REGION || 'unknown',
        stats: {
          users: userCount ?? 0,
          transactions: transactionCount ?? 0,
          accounts: accountCount ?? 0,
        },
        lastDataSync: lastSync?.last_synced_at || null,
      },
      backup: {
        // Supabase handles automatic backups
        provider: 'supabase_automatic',
        frequency: 'daily',
        retention: '7_days',
        // Point-in-time recovery available on Pro plan
        pitr_enabled: process.env.SUPABASE_PITR_ENABLED === 'true',
        note: 'Backups are managed automatically by Supabase. Use Supabase Dashboard for manual backup operations.',
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    log.error('Failed to check backup status', error)

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to check backup status' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/backup - Trigger backup operation
 *
 * Note: Supabase manages backups automatically. This endpoint:
 * 1. Validates database connectivity
 * 2. Runs integrity checks
 * 3. Creates an audit record of the backup request
 * 4. Returns instructions for manual backup via Supabase Dashboard
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const { ipAddress, userAgent } = getRequestMetadata(request)

  // Verify admin key
  if (!verifyAdminKey(request)) {
    await auditLog({
      action: 'security.suspicious_activity',
      ipAddress,
      userAgent,
      severity: 'warning',
      details: {
        path: '/api/admin/backup',
        method: 'POST',
        reason: 'Invalid or missing admin API key',
      },
    })

    return NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid admin API key' },
      { status: 401 }
    )
  }

  try {
    const supabase = await createClient()

    // Parse request body for options
    let options: { dryRun?: boolean } = {}
    try {
      options = await request.json()
    } catch {
      // No body provided, use defaults
    }

    const isDryRun = options.dryRun ?? false

    // Step 1: Verify database connectivity
    const connectivityStart = Date.now()
    const { error: connectError } = await supabase
      .from('users')
      .select('id')
      .limit(1)

    if (connectError) {
      throw new Error(`Database connectivity check failed: ${connectError.message}`)
    }
    const connectivityTime = Date.now() - connectivityStart

    // Step 2: Run basic integrity checks
    const integrityChecks = await Promise.all([
      // Check for orphaned transactions (transactions without valid user)
      supabase.rpc('check_data_integrity_transactions').then(
        (result) => result,
        () => ({ data: null, error: 'RPC not available' })
      ),
      // Check for orphaned accounts
      supabase.rpc('check_data_integrity_accounts').then(
        (result) => result,
        () => ({ data: null, error: 'RPC not available' })
      ),
    ])

    // Step 3: Get table row counts for verification
    const [users, transactions, accounts, budgets] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('transactions').select('*', { count: 'exact', head: true }),
      supabase.from('plaid_accounts').select('*', { count: 'exact', head: true }),
      supabase.from('budgets').select('*', { count: 'exact', head: true }),
    ])

    const rowCounts = {
      users: users.count ?? 0,
      transactions: transactions.count ?? 0,
      accounts: accounts.count ?? 0,
      budgets: budgets.count ?? 0,
    }

    // Step 4: Create audit record
    await auditLog({
      action: 'admin.backup_triggered',
      ipAddress,
      userAgent,
      severity: 'info',
      details: {
        dryRun: isDryRun,
        rowCounts,
        connectivityMs: connectivityTime,
        integrityChecksRan: integrityChecks.length,
      },
    })

    log.info('Backup validation completed', {
      dryRun: isDryRun,
      rowCounts,
      connectivityMs: connectivityTime,
    })

    return NextResponse.json({
      success: true,
      dryRun: isDryRun,
      validation: {
        connectivity: {
          status: 'ok',
          responseTimeMs: connectivityTime,
        },
        integrityChecks: {
          status: 'completed',
          note: 'Full integrity checks require database functions to be installed',
        },
        rowCounts,
      },
      backup: {
        status: isDryRun ? 'skipped_dry_run' : 'delegated_to_supabase',
        message: isDryRun
          ? 'Dry run completed. No backup was triggered.'
          : 'Backup request logged. Supabase handles automatic daily backups.',
        instructions: [
          'For immediate backup: Use Supabase Dashboard > Settings > Database > Backups',
          'For PITR recovery: Supabase Pro plan required',
          'For export: Use pg_dump via Supabase connection string',
        ],
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    log.error('Backup operation failed', error)

    await auditLog({
      action: 'admin.backup_failed',
      ipAddress,
      userAgent,
      severity: 'error',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    })

    return NextResponse.json(
      {
        error: 'Backup Failed',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
