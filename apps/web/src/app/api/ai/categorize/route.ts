import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { categorizeTransactions, categorizeAllTransactions } from '@/lib/ai-categorize'
import { getUserSubscription, canAccessFeature } from '@/lib/subscription'
import { checkAndIncrementUsage, rateLimitResponse } from '@/lib/ai-usage'

// GET - Get count of uncategorized transactions
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Count uncategorized transactions
    const { count } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .or('ai_category.is.null,display_name.is.null')

    return NextResponse.json({ uncategorized_count: count || 0 })
  } catch (error) {
    console.error('Error getting uncategorized count:', error)
    return NextResponse.json({ error: 'Failed to get count' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check subscription for AI categorization access
    const subscription = await getUserSubscription(user.id)
    const isPro = canAccessFeature(subscription, 'ai_categorization')
    if (!isPro) {
      return NextResponse.json(
        { error: 'upgrade_required', message: 'AI Categorization requires a Pro subscription' },
        { status: 403 }
      )
    }

    // Check rate limits
    const usageCheck = await checkAndIncrementUsage(supabase, user.id, 'categorization', isPro)
    if (!usageCheck.allowed) {
      return NextResponse.json(
        rateLimitResponse('categorization', usageCheck.limit, isPro),
        { status: 429 }
      )
    }

    let transactionIds: string[] | undefined
    let force = false
    let processAll = false
    try {
      const body = await request.json()
      transactionIds = body.transaction_ids
      force = body.force === true
      processAll = body.process_all === true
    } catch {
      // No body provided, will categorize all uncategorized
    }

    // Use batch processing for "process all" requests
    const result = processAll
      ? await categorizeAllTransactions(supabase, user.id)
      : await categorizeTransactions(supabase, user.id, transactionIds, { force })

    // Save AI categorization report if there were any results
    let reportId: string | null = null
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
          trigger_type: 'manual',
        })
        .select('id')
        .single()

      reportId = report?.id || null
    }

    return NextResponse.json({
      categorized: result.categorized,
      needs_review: result.needs_review,
      found: result.found || 0,
      skipped: result.skipped || false,
      categorized_items: result.categorized_items,
      skipped_items: result.skipped_items,
      message: result.message,
      report_id: reportId,
    })
  } catch (error) {
    console.error('Error categorizing transactions:', error)
    return NextResponse.json(
      { error: 'Failed to categorize transactions' },
      { status: 500 }
    )
  }
}
