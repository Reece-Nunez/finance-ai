import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { plaidClient } from '@/lib/plaid'

// Plaid webhook types and codes (using string literals as plaid package doesn't export these)
const WEBHOOK_TYPE = {
  TRANSACTIONS: 'TRANSACTIONS',
  ITEM: 'ITEM',
} as const

const TRANSACTIONS_CODE = {
  SYNC_UPDATES_AVAILABLE: 'SYNC_UPDATES_AVAILABLE',
  RECURRING_TRANSACTIONS_UPDATE: 'RECURRING_TRANSACTIONS_UPDATE',
  INITIAL_UPDATE: 'INITIAL_UPDATE',
  HISTORICAL_UPDATE: 'HISTORICAL_UPDATE',
  DEFAULT_UPDATE: 'DEFAULT_UPDATE',
} as const

const ITEM_CODE = {
  ERROR: 'ERROR',
  PENDING_EXPIRATION: 'PENDING_EXPIRATION',
  USER_PERMISSION_REVOKED: 'USER_PERMISSION_REVOKED',
  WEBHOOK_UPDATE_ACKNOWLEDGED: 'WEBHOOK_UPDATE_ACKNOWLEDGED',
} as const

// Plaid webhook payload types
interface PlaidWebhookPayload {
  webhook_type: string
  webhook_code: string
  item_id: string
  error?: {
    error_code: string
    error_message: string
  }
  new_transactions?: number
  historical_update_complete?: boolean
  consent_expiration_time?: string
}

// Helper to sync transactions for a specific item
async function syncItemTransactions(itemId: string) {
  const supabase = createServiceClient()

  // Get the plaid item
  const { data: plaidItem, error: itemError } = await supabase
    .from('plaid_items')
    .select('*, user_id')
    .eq('item_id', itemId)
    .single()

  if (itemError || !plaidItem) {
    console.error('[webhook] Plaid item not found:', itemId)
    return { error: 'Item not found' }
  }

  const userId = plaidItem.user_id
  let cursor = plaidItem.transaction_cursor || undefined
  let hasMore = true
  let totalAdded = 0
  let totalModified = 0
  let totalRemoved = 0
  let pageCount = 0

  // Get user's transaction rules
  const { data: rules } = await supabase
    .from('transaction_rules')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('priority', { ascending: false })

  const activeRules = rules || []

  // Get budget envelope accounts (transactions from these should be auto-ignored)
  const { data: budgetEnvelopeAccounts } = await supabase
    .from('accounts')
    .select('plaid_account_id')
    .eq('user_id', userId)
    .eq('is_budget_envelope', true)

  const budgetEnvelopeAccountIds = new Set(
    (budgetEnvelopeAccounts || []).map(a => a.plaid_account_id)
  )

  while (hasMore) {
    pageCount++
    if (pageCount > 10) {
      console.log('[webhook] Reached page limit, saving cursor')
      break
    }

    const response = await plaidClient.transactionsSync({
      access_token: plaidItem.access_token,
      cursor,
    })

    const { added, modified, removed, next_cursor, has_more } = response.data

    // Insert new transactions
    if (added.length > 0) {
      const transactions = added.map((tx) => {
        // Check if this account is a budget envelope (auto-ignore all transactions)
        const isBudgetEnvelopeAccount = budgetEnvelopeAccountIds.has(tx.account_id)

        // Apply rules
        let ruleUpdates: { display_name?: string; category?: string; is_income?: boolean; ignore_type?: string } = {}
        for (const rule of activeRules) {
          const pattern = rule.match_pattern.toLowerCase()
          let matches = false
          if (rule.match_field === 'name') {
            matches = tx.name.toLowerCase().includes(pattern)
          } else if (rule.match_field === 'merchant_name' && tx.merchant_name) {
            matches = tx.merchant_name.toLowerCase().includes(pattern)
          } else if (rule.match_field === 'any') {
            matches = tx.name.toLowerCase().includes(pattern) ||
                     (tx.merchant_name?.toLowerCase().includes(pattern) ?? false)
          }
          if (matches) {
            if (rule.display_name) ruleUpdates.display_name = rule.display_name
            if (rule.set_category) ruleUpdates.category = rule.set_category
            if (rule.set_as_income) ruleUpdates.is_income = true
            if (rule.set_ignore_type) ruleUpdates.ignore_type = rule.set_ignore_type
            break
          }
        }

        // Budget envelope accounts take precedence - always ignore their transactions
        const finalIgnoreType = isBudgetEnvelopeAccount ? 'all' : (ruleUpdates.ignore_type || 'none')

        return {
          user_id: userId,
          plaid_item_id: itemId,
          plaid_transaction_id: tx.transaction_id,
          plaid_account_id: tx.account_id,
          amount: tx.amount,
          date: tx.date,
          name: tx.name,
          merchant_name: tx.merchant_name,
          category: ruleUpdates.category || tx.personal_finance_category?.primary || tx.category?.[0] || null,
          category_detailed: tx.personal_finance_category?.detailed || null,
          pending: tx.pending,
          iso_currency_code: tx.iso_currency_code,
          display_name: ruleUpdates.display_name || null,
          is_income: ruleUpdates.is_income || false,
          ignore_type: finalIgnoreType,
        }
      })

      await supabase
        .from('transactions')
        .upsert(transactions, { onConflict: 'plaid_transaction_id', ignoreDuplicates: false })

      totalAdded += added.length
    }

    // Handle modified transactions
    if (modified.length > 0) {
      totalModified += modified.length
      for (const tx of modified) {
        await supabase
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
    }

    // Handle removed transactions
    if (removed.length > 0) {
      totalRemoved += removed.length
      const removedIds = removed.map((tx) => tx.transaction_id)
      await supabase
        .from('transactions')
        .delete()
        .in('plaid_transaction_id', removedIds)
    }

    cursor = next_cursor
    hasMore = has_more
  }

  // Update cursor
  await supabase
    .from('plaid_items')
    .update({
      transaction_cursor: cursor,
      updated_at: new Date().toISOString()
    })
    .eq('item_id', itemId)

  // Create notification for user about new transactions
  if (totalAdded > 0) {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'transaction_sync',
      title: 'New Transactions',
      message: `${totalAdded} new transaction${totalAdded !== 1 ? 's' : ''} synced from your bank.`,
      priority: 'low',
      action_url: '/dashboard/transactions',
    })
  }

  return { added: totalAdded, modified: totalModified, removed: totalRemoved }
}

export async function POST(request: Request) {
  console.log('[plaid-webhook] Received webhook')

  try {
    const body: PlaidWebhookPayload = await request.json()
    const { webhook_type, webhook_code, item_id, error } = body

    console.log('[plaid-webhook] Type:', webhook_type, 'Code:', webhook_code, 'Item:', item_id)

    const supabase = createServiceClient()

    // Handle different webhook types
    switch (webhook_type) {
      case WEBHOOK_TYPE.TRANSACTIONS:
        switch (webhook_code) {
          case TRANSACTIONS_CODE.SYNC_UPDATES_AVAILABLE:
            // New transactions available - sync them
            console.log('[plaid-webhook] Sync updates available for item:', item_id)
            const syncResult = await syncItemTransactions(item_id)
            console.log('[plaid-webhook] Sync result:', syncResult)
            break

          case TRANSACTIONS_CODE.RECURRING_TRANSACTIONS_UPDATE:
            console.log('[plaid-webhook] Recurring transactions updated for item:', item_id)
            // Could trigger recurring detection here
            break

          case TRANSACTIONS_CODE.INITIAL_UPDATE:
          case TRANSACTIONS_CODE.HISTORICAL_UPDATE:
            console.log('[plaid-webhook] Historical update for item:', item_id)
            await syncItemTransactions(item_id)
            break

          default:
            console.log('[plaid-webhook] Unhandled transaction webhook code:', webhook_code)
        }
        break

      case WEBHOOK_TYPE.ITEM:
        switch (webhook_code) {
          case ITEM_CODE.ERROR:
            // Item has an error - notify user
            console.error('[plaid-webhook] Item error:', item_id, error)

            // Get user for this item
            const { data: itemData } = await supabase
              .from('plaid_items')
              .select('user_id, institution_name')
              .eq('item_id', item_id)
              .single()

            if (itemData) {
              // Update item status
              await supabase
                .from('plaid_items')
                .update({ status: 'error', error_code: error?.error_code })
                .eq('item_id', item_id)

              // Notify user
              await supabase.from('notifications').insert({
                user_id: itemData.user_id,
                type: 'bank_error',
                title: 'Bank Connection Issue',
                message: `There's an issue with your ${itemData.institution_name} connection. Please reconnect your account.`,
                priority: 'high',
                action_url: '/dashboard/accounts',
              })
            }
            break

          case ITEM_CODE.PENDING_EXPIRATION:
            // Access consent expiring - notify user
            console.log('[plaid-webhook] Pending expiration for item:', item_id)

            const { data: expiringItem } = await supabase
              .from('plaid_items')
              .select('user_id, institution_name')
              .eq('item_id', item_id)
              .single()

            if (expiringItem) {
              await supabase.from('notifications').insert({
                user_id: expiringItem.user_id,
                type: 'bank_expiring',
                title: 'Bank Access Expiring',
                message: `Your ${expiringItem.institution_name} connection will expire soon. Please reconnect to continue syncing.`,
                priority: 'high',
                action_url: '/dashboard/accounts',
              })
            }
            break

          case ITEM_CODE.USER_PERMISSION_REVOKED:
            // User revoked access
            console.log('[plaid-webhook] User permission revoked for item:', item_id)
            await supabase
              .from('plaid_items')
              .update({ status: 'revoked' })
              .eq('item_id', item_id)
            break

          default:
            console.log('[plaid-webhook] Unhandled item webhook code:', webhook_code)
        }
        break

      default:
        console.log('[plaid-webhook] Unhandled webhook type:', webhook_type)
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[plaid-webhook] Error processing webhook:', err)
    // Still return 200 to prevent Plaid from retrying
    return NextResponse.json({ received: true, error: 'Processing error' })
  }
}
