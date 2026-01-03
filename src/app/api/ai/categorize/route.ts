import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { categorizeTransactions } from '@/lib/ai-categorize'
import { getUserSubscription, canAccessFeature } from '@/lib/subscription'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check subscription for AI categorization access
    const subscription = await getUserSubscription(user.id)
    if (!canAccessFeature(subscription, 'ai_categorization')) {
      return NextResponse.json(
        { error: 'upgrade_required', message: 'AI Categorization requires a Pro subscription' },
        { status: 403 }
      )
    }

    let transactionIds: string[] | undefined
    let force = false
    try {
      const body = await request.json()
      transactionIds = body.transaction_ids
      force = body.force === true
    } catch {
      // No body provided, will categorize all uncategorized
    }

    const result = await categorizeTransactions(supabase, user.id, transactionIds, { force })

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
