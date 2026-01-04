import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { plaidClient } from '@/lib/plaid'
import { generateNotifications, checkUnusualSpending } from '@/lib/notifications'
import { categorizeTransactions } from '@/lib/ai-categorize'

interface TransactionRule {
  id: string
  match_field: string
  match_pattern: string
  display_name: string | null
  set_category: string | null
  set_as_income: boolean
  set_ignore_type: string | null
  priority: number
}

function applyRules(
  transaction: { name: string; merchant_name: string | null },
  rules: TransactionRule[]
): { display_name?: string; category?: string; is_income?: boolean; ignore_type?: string } {
  const updates: { display_name?: string; category?: string; is_income?: boolean; ignore_type?: string } = {}

  for (const rule of rules) {
    const pattern = rule.match_pattern.toLowerCase()
    let matches = false

    if (rule.match_field === 'name') {
      matches = transaction.name.toLowerCase().includes(pattern)
    } else if (rule.match_field === 'merchant_name' && transaction.merchant_name) {
      matches = transaction.merchant_name.toLowerCase().includes(pattern)
    } else if (rule.match_field === 'any') {
      matches =
        transaction.name.toLowerCase().includes(pattern) ||
        (transaction.merchant_name?.toLowerCase().includes(pattern) ?? false)
    }

    if (matches) {
      if (rule.display_name) updates.display_name = rule.display_name
      if (rule.set_category) updates.category = rule.set_category
      if (rule.set_as_income) updates.is_income = true
      if (rule.set_ignore_type) updates.ignore_type = rule.set_ignore_type
      // First matching rule wins (rules are sorted by priority)
      break
    }
  }

  return updates
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get item_id from request body if provided, otherwise sync all items
    let itemId: string | null = null
    try {
      const body = await request.json()
      itemId = body.item_id || null
    } catch {
      // No body provided, will sync all items
    }

    // Get plaid item(s)
    let query = supabase
      .from('plaid_items')
      .select('*')
      .eq('user_id', user.id)

    if (itemId) {
      query = query.eq('item_id', itemId)
    }

    const { data: plaidItems, error: itemError } = await query

    if (itemError || !plaidItems || plaidItems.length === 0) {
      return NextResponse.json({ error: 'No items found' }, { status: 404 })
    }

    // Get user's transaction rules (sorted by priority, highest first)
    const { data: rules } = await supabase
      .from('transaction_rules')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('priority', { ascending: false })

    const activeRules: TransactionRule[] = rules || []

    let totalAdded = 0

    // Sync each plaid item
    for (const plaidItem of plaidItems) {
      let cursor = plaidItem.transaction_cursor || undefined
      let hasMore = true
      let addedCount = 0

      while (hasMore) {
        const response = await plaidClient.transactionsSync({
          access_token: plaidItem.access_token,
          cursor,
        })

        const { added, modified, removed, next_cursor, has_more } = response.data

        // Insert new transactions
        if (added.length > 0) {
          const transactions = added.map((tx) => {
            // Apply rules to get custom display name, category, and income flag
            const ruleUpdates = applyRules(
              { name: tx.name, merchant_name: tx.merchant_name || null },
              activeRules
            )

            return {
              user_id: user.id,
              plaid_item_id: plaidItem.item_id,
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
              ignore_type: ruleUpdates.ignore_type || 'none',
            }
          })

          const { error: txError } = await supabase
            .from('transactions')
            .upsert(transactions, {
              onConflict: 'plaid_transaction_id',
              ignoreDuplicates: false
            })

          if (txError) {
            console.error('Error inserting transactions:', txError)
          } else {
            addedCount += added.length
          }
        }

        // Handle modified transactions
        if (modified.length > 0) {
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
          const removedIds = removed.map((tx) => tx.transaction_id)
          await supabase
            .from('transactions')
            .delete()
            .in('plaid_transaction_id', removedIds)
        }

        cursor = next_cursor
        hasMore = has_more
      }

      // Update the cursor and updated_at timestamp
      await supabase
        .from('plaid_items')
        .update({
          transaction_cursor: cursor,
          updated_at: new Date().toISOString()
        })
        .eq('item_id', plaidItem.item_id)

      totalAdded += addedCount
    }

    // Run AI categorization on new transactions (if enabled)
    let aiCategorized = 0
    let aiReportId: string | null = null
    try {
      const result = await categorizeTransactions(supabase, user.id)
      aiCategorized = result.categorized

      // Save AI categorization report if there were any results
      if (result.categorized > 0 || (result.skipped_items && result.skipped_items.length > 0)) {
        const { data: report } = await supabase
          .from('ai_categorization_reports')
          .insert({
            user_id: user.id,
            transactions_found: result.found || 0,
            transactions_categorized: result.categorized,
            transactions_skipped: result.skipped_items?.length || 0,
            categorized_items: result.categorized_items || [],
            skipped_items: result.skipped_items || [],
            trigger_type: 'auto',
          })
          .select('id')
          .single()

        aiReportId = report?.id || null

        // Create notification if AI did something
        if (result.categorized > 0 || (result.skipped_items && result.skipped_items.length > 0)) {
          const skippedCount = result.skipped_items?.length || 0
          let message = `AI categorized ${result.categorized} transaction${result.categorized !== 1 ? 's' : ''}`
          if (skippedCount > 0) {
            message += ` and found ${skippedCount} that need${skippedCount === 1 ? 's' : ''} your review`
          }
          message += '.'

          await supabase.from('notifications').insert({
            user_id: user.id,
            type: 'ai_categorization',
            title: 'AI Categorization Complete',
            message,
            priority: skippedCount > 0 ? 'normal' : 'low',
            action_url: aiReportId ? `/dashboard/ai-report/${aiReportId}` : '/dashboard/settings',
            metadata: {
              report_id: aiReportId,
              categorized: result.categorized,
              skipped: skippedCount,
            },
          })
        }
      }
    } catch (catError) {
      console.error('Error in AI categorization:', catError)
      // Don't fail the sync if AI categorization fails
    }

    // Generate notifications based on new data
    try {
      await generateNotifications(supabase, user.id)
      await checkUnusualSpending(supabase, user.id)
    } catch (notifError) {
      console.error('Error generating notifications:', notifError)
      // Don't fail the sync if notifications fail
    }

    return NextResponse.json({ success: true, added: totalAdded, aiCategorized })
  } catch (error) {
    console.error('Error syncing transactions:', error)
    return NextResponse.json(
      { error: 'Failed to sync transactions' },
      { status: 500 }
    )
  }
}
