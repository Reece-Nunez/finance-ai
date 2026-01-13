import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { plaidClient } from '@/lib/plaid'
import { generateNotifications, checkUnusualSpending } from '@/lib/notifications'
import { categorizeTransactions } from '@/lib/ai-categorize'
import { getUserSubscription, canAccessFeature } from '@/lib/subscription'
import { auditLog } from '@/lib/audit'
import {
  SyncFrequency,
  updateSyncTimestamps,
} from '@/lib/sync-service'

// Max users to process per cron run (stay within Vercel limits)
const MAX_USERS_PER_RUN = 50

// Verify the request is from Vercel Cron
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    // In development, allow without secret
    return process.env.NODE_ENV === 'development'
  }
  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()
  console.log('[cron/sync-accounts] Starting scheduled sync...')

  // Verify cron secret
  if (!verifyCronSecret(request)) {
    console.error('[cron/sync-accounts] Unauthorized - invalid or missing CRON_SECRET')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Create admin client for cross-user operations
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[cron/sync-accounts] Missing Supabase configuration')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    // Get users due for sync
    const now = new Date().toISOString()
    const { data: usersToSync, error: queryError } = await adminClient
      .from('user_profiles')
      .select('user_id, sync_frequency, subscription_tier')
      .neq('sync_frequency', 'manual')
      .lte('next_sync_due', now)
      .order('next_sync_due', { ascending: true })
      .limit(MAX_USERS_PER_RUN)

    if (queryError) {
      console.error('[cron/sync-accounts] Error querying users:', queryError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!usersToSync || usersToSync.length === 0) {
      console.log('[cron/sync-accounts] No users due for sync')
      return NextResponse.json({
        success: true,
        message: 'No users due for sync',
        processed: 0,
        timeMs: Date.now() - startTime,
      })
    }

    console.log(`[cron/sync-accounts] Processing ${usersToSync.length} users`)

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      totalAdded: 0,
      totalModified: 0,
      totalRemoved: 0,
    }

    // Process each user
    for (const userProfile of usersToSync) {
      const userId = userProfile.user_id
      const frequency = userProfile.sync_frequency as SyncFrequency
      const isPro = userProfile.subscription_tier === 'pro'

      try {
        console.log(`[cron/sync-accounts] Syncing user ${userId}...`)

        // Get plaid items for user
        const { data: plaidItems } = await adminClient
          .from('plaid_items')
          .select('*')
          .eq('user_id', userId)

        if (!plaidItems || plaidItems.length === 0) {
          // No plaid items, just update timestamps
          await updateSyncTimestamps(adminClient, userId, frequency, isPro)
          results.processed++
          results.succeeded++
          continue
        }

        let userAdded = 0
        let userModified = 0
        let userRemoved = 0

        // Sync each plaid item
        for (const plaidItem of plaidItems) {
          try {
            let cursor = plaidItem.transaction_cursor || undefined
            let hasMore = true
            let pageCount = 0

            while (hasMore && pageCount < 5) {
              pageCount++
              const response = await plaidClient.transactionsSync({
                access_token: plaidItem.access_token,
                cursor,
              })

              const { added, modified, removed, next_cursor, has_more } = response.data

              // Insert new transactions
              if (added.length > 0) {
                const transactions = added.map((tx) => ({
                  user_id: userId,
                  plaid_item_id: plaidItem.item_id,
                  plaid_transaction_id: tx.transaction_id,
                  plaid_account_id: tx.account_id,
                  amount: tx.amount,
                  date: tx.date,
                  name: tx.name,
                  merchant_name: tx.merchant_name,
                  category: tx.personal_finance_category?.primary || tx.category?.[0] || null,
                  category_detailed: tx.personal_finance_category?.detailed || null,
                  pending: tx.pending,
                  iso_currency_code: tx.iso_currency_code,
                }))

                await adminClient
                  .from('transactions')
                  .upsert(transactions, {
                    onConflict: 'plaid_transaction_id',
                    ignoreDuplicates: false,
                  })

                userAdded += added.length
              }

              // Handle modified transactions
              if (modified.length > 0) {
                for (const tx of modified) {
                  await adminClient
                    .from('transactions')
                    .update({
                      amount: tx.amount,
                      date: tx.date,
                      name: tx.name,
                      merchant_name: tx.merchant_name,
                      category: tx.personal_finance_category?.primary || tx.category?.[0] || null,
                      pending: tx.pending,
                    })
                    .eq('plaid_transaction_id', tx.transaction_id)
                }
                userModified += modified.length
              }

              // Handle removed transactions
              if (removed.length > 0) {
                const removedIds = removed.map((tx) => tx.transaction_id)
                await adminClient
                  .from('transactions')
                  .delete()
                  .in('plaid_transaction_id', removedIds)
                userRemoved += removed.length
              }

              cursor = next_cursor
              hasMore = has_more
            }

            // Update cursor
            await adminClient
              .from('plaid_items')
              .update({
                transaction_cursor: cursor,
                updated_at: new Date().toISOString(),
              })
              .eq('item_id', plaidItem.item_id)
          } catch (itemError) {
            console.error(`[cron/sync-accounts] Error syncing item ${plaidItem.item_id}:`, itemError)
          }
        }

        // Run AI categorization for Pro users if new transactions were added
        if (userAdded > 0 && isPro) {
          try {
            const subscription = await getUserSubscription(userId, adminClient)
            if (canAccessFeature(subscription, 'ai_categorization')) {
              await categorizeTransactions(adminClient, userId)
            }
          } catch (aiError) {
            console.error(`[cron/sync-accounts] AI categorization error for ${userId}:`, aiError)
          }
        }

        // Generate notifications for new transactions
        if (userAdded > 0) {
          try {
            await generateNotifications(adminClient, userId)
            await checkUnusualSpending(adminClient, userId)
          } catch (notifError) {
            console.error(`[cron/sync-accounts] Notification error for ${userId}:`, notifError)
          }
        }

        // Update sync timestamps
        await updateSyncTimestamps(adminClient, userId, frequency, isPro)

        results.totalAdded += userAdded
        results.totalModified += userModified
        results.totalRemoved += userRemoved
        results.succeeded++

        console.log(`[cron/sync-accounts] User ${userId}: +${userAdded}, ~${userModified}, -${userRemoved}`)
      } catch (userError) {
        console.error(`[cron/sync-accounts] Error processing user ${userId}:`, userError)
        results.failed++

        // Still update next_sync_due to prevent retry spam
        await updateSyncTimestamps(adminClient, userId, frequency, isPro)
      }

      results.processed++
    }

    const totalTime = Date.now() - startTime

    // Audit log the cron run
    await auditLog({
      action: 'cron.sync_accounts',
      resourceType: 'system',
      resourceId: 'cron',
      details: {
        processed: results.processed,
        succeeded: results.succeeded,
        failed: results.failed,
        totalAdded: results.totalAdded,
        totalModified: results.totalModified,
        totalRemoved: results.totalRemoved,
        timeMs: totalTime,
      },
      severity: results.failed > 0 ? 'warning' : 'info',
    })

    console.log(`[cron/sync-accounts] Complete. Processed: ${results.processed}, Success: ${results.succeeded}, Failed: ${results.failed}, Time: ${totalTime}ms`)

    return NextResponse.json({
      success: true,
      ...results,
      timeMs: totalTime,
    })
  } catch (error) {
    console.error('[cron/sync-accounts] Fatal error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
