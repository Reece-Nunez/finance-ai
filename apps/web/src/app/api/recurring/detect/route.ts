import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserSubscription, canAccessFeature } from '@/lib/subscription'
import { anthropic } from '@/lib/ai'

const AI_RECURRING_PROMPT = `You are a financial analyst specializing in detecting recurring transactions and bills from bank transaction data.

Analyze the provided transactions and identify ALL recurring patterns, including:
1. **Fixed recurring bills** - Same amount, same merchant, monthly (rent, subscriptions, memberships)
2. **Variable recurring bills** - Same merchant but varying amounts (utilities, credit card payments, phone bills)
3. **Bi-weekly patterns** - Paychecks, some loan payments
4. **Annual/Quarterly** - Insurance, annual subscriptions, property taxes
5. **Income sources** - Regular paychecks, recurring deposits

For each recurring item, determine:
- The merchant/source name (cleaned up, human-readable)
- Whether it's income or an expense
- The billing frequency (weekly, bi-weekly, monthly, quarterly, annual)
- The typical day of month (or day of week for weekly/bi-weekly)
- The average/typical amount
- A confidence score (0-100) based on how certain you are this is recurring
- The next expected date

Be smart about:
- Grouping transactions from the same merchant even if names vary slightly (e.g., "NETFLIX.COM" and "NETFLIX" are the same)
- Identifying utility bills that vary in amount but are clearly monthly
- Recognizing payroll deposits even if amounts vary slightly
- Distinguishing one-time purchases from recurring ones

Respond with a JSON object:
{
  "recurring": [
    {
      "name": "Netflix",
      "type": "expense" | "income",
      "frequency": "monthly" | "bi-weekly" | "weekly" | "quarterly" | "annual",
      "typical_day": 15,
      "amount": 15.99,
      "amount_varies": false,
      "amount_range": { "min": 15.99, "max": 15.99 },
      "confidence": 95,
      "next_expected_date": "2025-01-15",
      "category": "ENTERTAINMENT",
      "transaction_ids": ["id1", "id2", "id3"]
    }
  ],
  "insights": "Brief summary of what you found"
}

Only include items with confidence >= 60. Sort by confidence descending.`

interface Transaction {
  id: string
  name: string
  merchant_name: string | null
  display_name: string | null
  amount: number
  date: string
  category: string | null
  is_income: boolean
}

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check subscription for AI features
  const subscription = await getUserSubscription(user.id)
  const canUseAI = canAccessFeature(subscription, 'ai_suggestions') // Using ai_suggestions as proxy for AI features

  if (!canUseAI) {
    // Return empty for non-Pro users - they'll use client-side pattern matching
    return NextResponse.json({
      recurring: [],
      useClientDetection: true,
      message: 'AI recurring detection requires Pro subscription'
    })
  }

  // Fetch last 6 months of transactions for analysis
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('id, name, merchant_name, display_name, amount, date, category, is_income')
    .eq('user_id', user.id)
    .gte('date', sixMonthsAgo.toISOString().split('T')[0])
    .order('date', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!transactions || transactions.length < 10) {
    return NextResponse.json({
      recurring: [],
      message: 'Not enough transaction history for AI analysis'
    })
  }

  // Format transactions for AI
  const txList = transactions.map((tx: Transaction) => ({
    id: tx.id,
    name: tx.display_name || tx.merchant_name || tx.name,
    raw_name: tx.name,
    amount: tx.amount,
    date: tx.date,
    category: tx.category,
    is_income: tx.is_income || tx.amount < 0,
  }))

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Analyze these ${transactions.length} transactions from the last 6 months and identify all recurring patterns:\n\n${JSON.stringify(txList, null, 2)}`,
        },
      ],
      system: AI_RECURRING_PROMPT,
    })

    const responseText = response.content[0].type === 'text' ? response.content[0].text : ''

    // Parse JSON response
    let result = { recurring: [], insights: '' }
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError)
      return NextResponse.json({
        recurring: [],
        error: 'Failed to parse AI analysis'
      })
    }

    return NextResponse.json({
      recurring: result.recurring || [],
      insights: result.insights || '',
      aiPowered: true,
    })
  } catch (aiError) {
    console.error('AI recurring detection error:', aiError)
    return NextResponse.json({
      recurring: [],
      error: 'AI analysis failed',
      useClientDetection: true,
    })
  }
}
