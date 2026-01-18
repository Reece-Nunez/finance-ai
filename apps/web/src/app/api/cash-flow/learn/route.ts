import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { analyzeSpendingPatterns, SpendingPattern, IncomePattern } from '@/lib/spending-patterns'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

interface Transaction {
  id: string
  amount: number
  date: string
  category: string | null
  merchant_name: string | null
  name: string
  is_income: boolean
}

// ============================================================================
// GET - Retrieve learning status and patterns
// ============================================================================
export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'status'

  if (action === 'patterns') {
    // Get stored patterns
    const { data: patterns, error } = await supabase
      .from('spending_patterns')
      .select('*')
      .eq('user_id', user.id)
      .order('confidence_score', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: incomePatterns } = await supabase
      .from('income_patterns')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)

    return NextResponse.json({ patterns, incomePatterns })
  }

  if (action === 'accuracy') {
    // Get prediction accuracy metrics
    const { data: accuracy, error } = await supabase
      .from('prediction_accuracy')
      .select('*')
      .eq('user_id', user.id)
      .order('period_start', { ascending: false })
      .limit(12)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ accuracy })
  }

  if (action === 'insights') {
    // Get unshown insights
    const { data: insights, error } = await supabase
      .from('learning_insights')
      .select('*')
      .eq('user_id', user.id)
      .eq('dismissed', false)
      .order('impact_score', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ insights })
  }

  // Default: status overview
  const { data: patternCount } = await supabase
    .from('spending_patterns')
    .select('id', { count: 'exact' })
    .eq('user_id', user.id)

  const { data: predictionCount } = await supabase
    .from('cash_flow_predictions')
    .select('id', { count: 'exact' })
    .eq('user_id', user.id)

  const { data: latestAccuracy } = await supabase
    .from('prediction_accuracy')
    .select('*')
    .eq('user_id', user.id)
    .eq('period_type', 'weekly')
    .order('period_start', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({
    status: {
      patternsLearned: patternCount?.length || 0,
      predictionsStored: predictionCount?.length || 0,
      latestAccuracy: latestAccuracy?.mean_percentage_error || null,
      lastAnalyzed: latestAccuracy?.created_at || null,
    },
  })
}

// ============================================================================
// POST - Trigger learning actions
// ============================================================================
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { action } = body

  // -------------------------------------------------------------------------
  // ACTION: Analyze patterns from transaction history
  // -------------------------------------------------------------------------
  if (action === 'analyze_patterns') {
    // Get all transactions for analysis (excluding ignored)
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('id, amount, date, category, merchant_name, name, is_income')
      .eq('user_id', user.id)
      .or('ignore_type.is.null,ignore_type.neq.all')
      .order('date', { ascending: false })

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 500 })
    }

    if (!transactions || transactions.length < 10) {
      return NextResponse.json({
        error: 'Not enough transaction data for pattern analysis',
        required: 10,
        current: transactions?.length || 0,
      }, { status: 400 })
    }

    // Run pattern analysis
    const analysis = analyzeSpendingPatterns(transactions as Transaction[])

    // Store spending patterns - BATCH UPSERT (N+1 fix)
    if (analysis.spendingPatterns.length > 0) {
      const spendingPatternRecords = analysis.spendingPatterns.map(pattern => ({
        user_id: user.id,
        pattern_type: pattern.patternType,
        dimension_key: pattern.dimensionKey,
        category: pattern.category,
        average_amount: pattern.averageAmount,
        median_amount: pattern.medianAmount,
        std_deviation: pattern.stdDeviation,
        min_amount: pattern.minAmount,
        max_amount: pattern.maxAmount,
        occurrence_count: pattern.occurrenceCount,
        confidence_score: pattern.confidenceScore,
        weight: pattern.weight,
        data_points_used: pattern.dataPointsUsed,
        months_of_data: pattern.monthsOfData,
        last_calculated_at: new Date().toISOString(),
      }))

      await supabase
        .from('spending_patterns')
        .upsert(spendingPatternRecords, {
          onConflict: 'user_id,pattern_type,dimension_key,category',
        })
    }

    // Store income patterns - BATCH UPSERT (N+1 fix)
    if (analysis.incomePatterns.length > 0) {
      const incomePatternRecords = analysis.incomePatterns.map(income => ({
        user_id: user.id,
        source_name: income.sourceName,
        source_type: income.sourceType,
        typical_day_of_month: income.typicalDayOfMonth,
        typical_day_of_week: income.typicalDayOfWeek,
        frequency: income.frequency,
        average_amount: income.averageAmount,
        min_amount: income.minAmount,
        max_amount: income.maxAmount,
        variability: income.variability,
        confidence_score: income.confidenceScore,
        occurrences_analyzed: income.occurrencesAnalyzed,
        last_occurrence: income.lastOccurrence,
        next_expected: income.nextExpected,
        is_active: true,
      }))

      await supabase
        .from('income_patterns')
        .upsert(incomePatternRecords, {
          onConflict: 'user_id,source_name',
        })
    }

    // Store insights - BATCH INSERT (N+1 fix)
    if (analysis.insights.length > 0) {
      const insightRecords = analysis.insights.map(insight => ({
        user_id: user.id,
        insight_type: insight.type,
        title: insight.title,
        description: insight.description,
        related_category: insight.category || null,
        impact_score: insight.impactScore,
        actionable: insight.actionable,
      }))

      await supabase
        .from('learning_insights')
        .insert(insightRecords)
    }

    return NextResponse.json({
      success: true,
      patternsLearned: analysis.spendingPatterns.length,
      incomeSourcesDetected: analysis.incomePatterns.length,
      insightsGenerated: analysis.insights.length,
      dataQuality: analysis.dataQuality,
    })
  }

  // -------------------------------------------------------------------------
  // ACTION: Store a prediction snapshot
  // -------------------------------------------------------------------------
  if (action === 'store_prediction') {
    const { predictions } = body // Array of daily predictions

    if (!predictions || !Array.isArray(predictions)) {
      return NextResponse.json({ error: 'predictions array required' }, { status: 400 })
    }

    // BATCH INSERT (N+1 fix)
    const predictionRecords = predictions.map(pred => ({
      user_id: user.id,
      prediction_date: pred.date,
      predicted_balance: pred.balance,
      predicted_income: pred.income || 0,
      predicted_expenses: pred.expenses || 0,
      predicted_recurring: pred.recurring || 0,
      predicted_discretionary: pred.discretionary || 0,
      confidence_score: pred.confidence || 0.5,
      prediction_factors: pred.factors || null,
    }))

    const { data: inserted, error } = await supabase
      .from('cash_flow_predictions')
      .insert(predictionRecords)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, stored: inserted?.length || 0 })
  }

  // -------------------------------------------------------------------------
  // ACTION: Compare predictions to actuals
  // -------------------------------------------------------------------------
  if (action === 'compare_actuals') {
    // Get predictions that have passed but haven't been analyzed
    const today = new Date().toISOString().split('T')[0]

    const { data: predictions, error: predError } = await supabase
      .from('cash_flow_predictions')
      .select('*')
      .eq('user_id', user.id)
      .lt('prediction_date', today)
      .is('actual_balance', null)
      .order('prediction_date', { ascending: true })
      .limit(30)

    if (predError) {
      return NextResponse.json({ error: predError.message }, { status: 500 })
    }

    if (!predictions || predictions.length === 0) {
      return NextResponse.json({ message: 'No predictions to compare' })
    }

    // Get account balances for those dates (we'll approximate from transactions)
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, current_balance')
      .eq('user_id', user.id)
      .eq('type', 'depository')

    const currentBalance = (accounts || []).reduce(
      (sum, a) => sum + (a.current_balance || 0), 0
    )

    // Get transactions for the prediction period to calculate actual spending
    const minDate = predictions[0].prediction_date
    const maxDate = predictions[predictions.length - 1].prediction_date

    const { data: transactions } = await supabase
      .from('transactions')
      .select('date, amount, is_income')
      .eq('user_id', user.id)
      .gte('date', minDate)
      .lte('date', maxDate)
      .or('ignore_type.is.null,ignore_type.neq.all')

    // Calculate daily actuals
    const dailyActuals: Map<string, { income: number; expenses: number }> = new Map()

    for (const tx of transactions || []) {
      if (!dailyActuals.has(tx.date)) {
        dailyActuals.set(tx.date, { income: 0, expenses: 0 })
      }
      const daily = dailyActuals.get(tx.date)!
      if (tx.is_income || tx.amount < 0) {
        daily.income += Math.abs(tx.amount)
      } else {
        daily.expenses += tx.amount
      }
    }

    // Update predictions with actuals
    const updates = []
    let runningBalance = currentBalance

    // Work backwards to estimate historical balances
    const sortedPredictions = [...predictions].sort(
      (a, b) => new Date(b.prediction_date).getTime() - new Date(a.prediction_date).getTime()
    )

    for (const pred of sortedPredictions) {
      const daily = dailyActuals.get(pred.prediction_date)
      const actualIncome = daily?.income || 0
      const actualExpenses = daily?.expenses || 0

      // Estimate balance for this day (rough approximation)
      const actualBalance = runningBalance
      runningBalance = runningBalance + actualExpenses - actualIncome // Reverse the flow

      const variance = actualBalance - pred.predicted_balance
      const variancePercent = pred.predicted_balance !== 0
        ? (variance / Math.abs(pred.predicted_balance)) * 100
        : 0

      const { error } = await supabase
        .from('cash_flow_predictions')
        .update({
          actual_balance: actualBalance,
          actual_income: actualIncome,
          actual_expenses: actualExpenses,
          actual_recorded_at: new Date().toISOString(),
          variance_amount: variance,
          variance_percentage: variancePercent,
        })
        .eq('id', pred.id)

      if (!error) {
        updates.push({
          date: pred.prediction_date,
          predicted: pred.predicted_balance,
          actual: actualBalance,
          variance,
        })
      }
    }

    return NextResponse.json({
      success: true,
      compared: updates.length,
      updates,
    })
  }

  // -------------------------------------------------------------------------
  // ACTION: AI analysis of prediction errors
  // -------------------------------------------------------------------------
  if (action === 'analyze_errors') {
    // Get predictions with variances that haven't been analyzed
    const { data: predictions, error } = await supabase
      .from('cash_flow_predictions')
      .select('*')
      .eq('user_id', user.id)
      .not('actual_balance', 'is', null)
      .eq('variance_analyzed', false)
      .order('prediction_date', { ascending: false })
      .limit(7)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!predictions || predictions.length === 0) {
      return NextResponse.json({ message: 'No prediction errors to analyze' })
    }

    // Get transactions for context (excluding ignored)
    const dates = predictions.map(p => p.prediction_date)
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .in('date', dates)
      .or('ignore_type.is.null,ignore_type.neq.all')

    // Use AI to analyze why predictions were off
    const prompt = `Analyze these cash flow prediction errors and explain WHY the predictions were wrong.

PREDICTIONS VS ACTUALS:
${predictions.map(p => `
Date: ${p.prediction_date}
Predicted Balance: $${p.predicted_balance}
Actual Balance: $${p.actual_balance}
Variance: $${p.variance_amount} (${p.variance_percentage?.toFixed(1)}%)
Predicted Income: $${p.predicted_income}
Actual Income: $${p.actual_income}
Predicted Expenses: $${p.predicted_expenses}
Actual Expenses: $${p.actual_expenses}
`).join('\n')}

TRANSACTIONS ON THESE DATES:
${(transactions || []).map(tx => `
${tx.date}: ${tx.name} - $${tx.amount} (${tx.category || 'uncategorized'})
`).join('')}

For each date, provide:
1. The main reason(s) for the prediction error
2. Whether this was a one-time issue or a pattern we should learn from
3. Specific adjustments to improve future predictions

Format your response as JSON:
{
  "analyses": [
    {
      "date": "YYYY-MM-DD",
      "primaryReason": "explanation",
      "isPattern": true/false,
      "recommendedAdjustment": "specific adjustment",
      "unexpectedExpenses": [{"name": "...", "amount": 0, "shouldPredict": true/false}]
    }
  ],
  "overallInsight": "summary of what the model should learn"
}`

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022', // Using Haiku for cost efficiency
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      })

      const aiContent = response.content[0]
      if (aiContent.type !== 'text') {
        throw new Error('Unexpected response type')
      }

      // Parse AI response
      const jsonMatch = aiContent.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Could not parse AI response')
      }

      // Sanitize JSON string - remove control characters that break parsing
      const sanitizedJson = jsonMatch[0]
        .replace(/[\x00-\x1F\x7F]/g, ' ') // Replace control chars with space
        .replace(/\n/g, ' ') // Replace newlines
        .replace(/\r/g, ' ') // Replace carriage returns
        .replace(/\t/g, ' ') // Replace tabs

      const analysis = JSON.parse(sanitizedJson)

      // Update predictions with analysis - batch by collecting dates and using IN clause
      // Note: Supabase doesn't support bulk updates with different values per row,
      // so we use Promise.all for parallel execution instead of sequential (N+1 mitigation)
      const updatePromises = analysis.analyses.map((a: { date: string; primaryReason: string; isPattern: boolean; recommendedAdjustment: string; unexpectedExpenses: Array<{ name: string; amount: number; shouldPredict: boolean }> }) =>
        supabase
          .from('cash_flow_predictions')
          .update({
            variance_analyzed: true,
            variance_reasons: {
              primaryReason: a.primaryReason,
              isPattern: a.isPattern,
              recommendedAdjustment: a.recommendedAdjustment,
              unexpectedExpenses: a.unexpectedExpenses,
            },
          })
          .eq('user_id', user.id)
          .eq('prediction_date', a.date)
      )

      await Promise.all(updatePromises)

      // Collect all unexpected expenses for batch insert (N+1 fix)
      const unexpectedExpenseRecords: Array<{
        user_id: string
        amount: number
        description: string
        expense_date: string
        expense_type: string
        ai_analysis: string
        should_predict_future: boolean
      }> = []

      for (const a of analysis.analyses) {
        if (a.unexpectedExpenses) {
          for (const expense of a.unexpectedExpenses) {
            if (expense.shouldPredict) {
              unexpectedExpenseRecords.push({
                user_id: user.id,
                amount: expense.amount,
                description: expense.name,
                expense_date: a.date,
                expense_type: a.isPattern ? 'irregular_recurring' : 'one_time',
                ai_analysis: a.primaryReason,
                should_predict_future: expense.shouldPredict,
              })
            }
          }
        }
      }

      // Batch insert unexpected expenses
      if (unexpectedExpenseRecords.length > 0) {
        await supabase
          .from('unexpected_expenses')
          .insert(unexpectedExpenseRecords)
      }

      // Store overall insight
      if (analysis.overallInsight) {
        await supabase
          .from('learning_insights')
          .insert({
            user_id: user.id,
            insight_type: 'accuracy_improvement',
            title: 'Prediction Accuracy Analysis',
            description: analysis.overallInsight,
            impact_score: 0.7,
            actionable: true,
          })
      }

      return NextResponse.json({
        success: true,
        analyzed: analysis.analyses.length,
        insight: analysis.overallInsight,
      })

    } catch (aiError) {
      console.error('AI analysis error:', aiError)
      return NextResponse.json({
        error: 'AI analysis failed',
        details: aiError instanceof Error ? aiError.message : 'Unknown error',
      }, { status: 500 })
    }
  }

  // -------------------------------------------------------------------------
  // ACTION: Calculate accuracy metrics
  // -------------------------------------------------------------------------
  if (action === 'calculate_accuracy') {
    // Get analyzed predictions from the last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: predictions, error } = await supabase
      .from('cash_flow_predictions')
      .select('*')
      .eq('user_id', user.id)
      .not('actual_balance', 'is', null)
      .gte('prediction_date', thirtyDaysAgo.toISOString().split('T')[0])

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!predictions || predictions.length < 3) {
      return NextResponse.json({ message: 'Not enough data for accuracy calculation' })
    }

    // Calculate metrics
    const errors = predictions.map(p => Math.abs(p.variance_amount || 0))
    const percentErrors = predictions.map(p => Math.abs(p.variance_percentage || 0))

    const mae = errors.reduce((a, b) => a + b, 0) / errors.length
    const mpe = percentErrors.reduce((a, b) => a + b, 0) / percentErrors.length
    const rmse = Math.sqrt(
      errors.reduce((sum, e) => sum + e * e, 0) / errors.length
    )

    // Direction accuracy (did we predict increase/decrease correctly?)
    let correctDirection = 0
    for (let i = 1; i < predictions.length; i++) {
      const predictedChange = predictions[i].predicted_balance - predictions[i - 1].predicted_balance
      const actualChange = (predictions[i].actual_balance || 0) - (predictions[i - 1].actual_balance || 0)
      if ((predictedChange >= 0 && actualChange >= 0) || (predictedChange < 0 && actualChange < 0)) {
        correctDirection++
      }
    }
    const directionAccuracy = predictions.length > 1 ? correctDirection / (predictions.length - 1) : 0

    // Store accuracy metrics
    const periodStart = thirtyDaysAgo.toISOString().split('T')[0]
    const periodEnd = new Date().toISOString().split('T')[0]

    await supabase
      .from('prediction_accuracy')
      .upsert({
        user_id: user.id,
        period_type: 'monthly',
        period_start: periodStart,
        period_end: periodEnd,
        mean_absolute_error: mae,
        mean_percentage_error: mpe,
        root_mean_square_error: rmse,
        predictions_count: predictions.length,
        direction_accuracy: directionAccuracy,
      }, {
        onConflict: 'user_id,period_type,period_start',
      })

    return NextResponse.json({
      success: true,
      metrics: {
        meanAbsoluteError: mae,
        meanPercentageError: mpe,
        rootMeanSquareError: rmse,
        directionAccuracy,
        predictionsAnalyzed: predictions.length,
      },
    })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
