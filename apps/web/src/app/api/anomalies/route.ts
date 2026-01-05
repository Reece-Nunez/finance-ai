import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  calculateMerchantBaselines,
  detectAnomalies,
  saveMerchantBaselines,
  saveDetectedAnomalies,
  getAnomalyPreferences,
  getMerchantBaselines,
  Transaction,
} from '@/lib/anomaly-detection'
import { getUserSubscription, canAccessFeature } from '@/lib/subscription'

// GET - Fetch pending anomalies for the user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check subscription for anomaly detection access
    const subscription = await getUserSubscription(user.id)
    if (!canAccessFeature(subscription, 'anomaly_detection')) {
      return NextResponse.json(
        { error: 'upgrade_required', message: 'Anomaly Detection requires a Pro subscription' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const limit = parseInt(searchParams.get('limit') || '50')

    // Fetch anomalies
    let query = supabase
      .from('detected_anomalies')
      .select('*')
      .eq('user_id', user.id)
      .order('detected_at', { ascending: false })
      .limit(limit)

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: anomalies, error } = await query

    if (error) {
      console.error('Error fetching anomalies:', error)
      return NextResponse.json({ error: 'Failed to fetch anomalies' }, { status: 500 })
    }

    // Get counts by status
    const { data: counts } = await supabase
      .from('detected_anomalies')
      .select('status')
      .eq('user_id', user.id)

    const statusCounts = {
      pending: 0,
      dismissed: 0,
      confirmed: 0,
      resolved: 0,
    }

    if (counts) {
      for (const row of counts) {
        if (row.status in statusCounts) {
          statusCounts[row.status as keyof typeof statusCounts]++
        }
      }
    }

    // Get user preferences
    const preferences = await getAnomalyPreferences(user.id)

    return NextResponse.json({
      anomalies: anomalies || [],
      counts: statusCounts,
      preferences,
    })
  } catch (error) {
    console.error('Error in anomalies GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Run anomaly detection on recent transactions
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check subscription for anomaly detection access
    const subscription = await getUserSubscription(user.id)
    if (!canAccessFeature(subscription, 'anomaly_detection')) {
      return NextResponse.json(
        { error: 'upgrade_required', message: 'Anomaly Detection requires a Pro subscription' },
        { status: 403 }
      )
    }

    // Parse request body for options
    const body = await request.json().catch(() => ({}))
    const daysToAnalyze = body.days || 7 // Default to last 7 days for new transactions
    const recalculateBaselines = body.recalculateBaselines !== false // Default true

    // Get user preferences
    const preferences = await getAnomalyPreferences(user.id)

    // Fetch all transactions for baseline calculation (last 6 months)
    // Exclude exceptional (one-time) transactions from baseline calculations
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const { data: allTransactionsData, error: txnError } = await supabase
      .from('transactions')
      .select('id, user_id, amount, date, merchant_name, category, account_id, is_exceptional')
      .eq('user_id', user.id)
      .gte('date', sixMonthsAgo.toISOString().split('T')[0])
      .or('is_exceptional.is.null,is_exceptional.eq.false') // Exclude exceptional transactions
      .or('ignored.is.null,ignored.eq.false') // Exclude ignored transfers
      .order('date', { ascending: false })
      .limit(1000)

    if (txnError) {
      console.error('Error fetching transactions:', txnError)
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }

    const allTransactions = (allTransactionsData || []) as Transaction[]

    if (allTransactions.length === 0) {
      return NextResponse.json({
        message: 'No transactions to analyze',
        anomalies: [],
        baselines: 0,
        newAnomalies: 0,
      })
    }

    // Calculate or fetch baselines
    let baselines = await getMerchantBaselines(user.id)

    if (recalculateBaselines || baselines.length === 0) {
      baselines = await calculateMerchantBaselines(user.id, allTransactions)
      await saveMerchantBaselines(user.id, baselines)
    }

    // Get recent transactions for anomaly detection
    const analysisDate = new Date()
    analysisDate.setDate(analysisDate.getDate() - daysToAnalyze)

    const recentTransactions = allTransactions.filter(
      t => new Date(t.date) >= analysisDate
    )

    // Detect anomalies
    const detectedAnomalies = await detectAnomalies(
      user.id,
      recentTransactions,
      allTransactions,
      baselines,
      preferences
    )

    // Save new anomalies
    const { saved, duplicates } = await saveDetectedAnomalies(detectedAnomalies)

    // Fetch all pending anomalies to return
    const { data: pendingAnomalies } = await supabase
      .from('detected_anomalies')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('detected_at', { ascending: false })

    return NextResponse.json({
      message: `Analyzed ${recentTransactions.length} transactions`,
      anomalies: pendingAnomalies || [],
      stats: {
        transactionsAnalyzed: recentTransactions.length,
        baselinesCalculated: baselines.length,
        newAnomalies: saved,
        duplicatesSkipped: duplicates,
        totalDetected: detectedAnomalies.length,
      },
    })
  } catch (error) {
    console.error('Error in anomalies POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update anomaly status
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, status, user_feedback, feedback_note } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing anomaly ID' }, { status: 400 })
    }

    const validStatuses = ['pending', 'dismissed', 'confirmed', 'resolved']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (status) {
      updates.status = status
      updates.reviewed_at = new Date().toISOString()
    }
    if (user_feedback) {
      updates.user_feedback = user_feedback
    }
    if (feedback_note !== undefined) {
      updates.feedback_note = feedback_note
    }

    // Mark as false positive if dismissed as expected
    if (status === 'dismissed' && user_feedback === 'expected') {
      updates.false_positive = true
    }

    const { error } = await supabase
      .from('detected_anomalies')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error updating anomaly:', error)
      return NextResponse.json({ error: 'Failed to update anomaly' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in anomalies PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update user preferences
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const { error } = await supabase
      .from('anomaly_preferences')
      .upsert({
        user_id: user.id,
        ...body,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      })

    if (error) {
      console.error('Error updating preferences:', error)
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in anomalies PUT:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
