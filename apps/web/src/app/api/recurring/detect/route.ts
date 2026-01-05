import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserSubscription, canAccessFeature } from '@/lib/subscription'
import { anthropic } from '@/lib/ai'
import { checkAndIncrementUsage, rateLimitResponse } from '@/lib/ai-usage'

const AI_RECURRING_PROMPT = `You are a financial analyst specializing in detecting recurring BILLS and SUBSCRIPTIONS from bank transaction data.

## WHAT TO INCLUDE (True Recurring Bills):
1. **Subscriptions** - Netflix, Spotify, gym memberships, software subscriptions (fixed amount, same day monthly)
2. **Utility bills** - Electric, water, gas, internet, phone (variable amounts, roughly same day monthly)
3. **Loan/Financing payments** - Car payments, mortgage, personal loans, boat/RV payments (fixed amount, monthly)
4. **Insurance** - Auto, home, health, life (monthly/quarterly/annual)
5. **Rent/Mortgage** - Housing payments
6. **Credit card auto-payments** - If there's a pattern of paying the same card monthly
7. **Paychecks** - Regular income deposits (bi-weekly or monthly)

## WHAT TO EXCLUDE (Not Bills - Just Frequent Shopping):
- **Gas stations** - Even if you go weekly, buying gas is shopping, not a bill
- **Grocery stores** - Walmart, Target, Costco, Braum's, Dollar General, etc.
- **Restaurants/Fast food** - Even if you go frequently
- **General retail** - Amazon (unless it's Prime subscription), Staples, etc.
- **Convenience stores** - 7-Eleven, etc.

The key distinction: A BILL is something you OWE and must pay. Frequent shopping is optional discretionary spending.

## Detection Rules:
- Look for transactions that happen at roughly the same time each month (within ~5 days)
- Bills usually have consistent amounts (subscriptions) OR consistent timing with variable amounts (utilities)
- If the amounts vary wildly AND the dates are random, it's probably shopping, not a bill
- If someone pays a merchant like "Lakeview Boat & RV" monthly with similar amounts, that's likely a loan payment
- Utility keywords: "utility", "electric", "water", "gas", "internet", "phone", "mobile"
- Subscription keywords: "subscription", "membership", "premium", "monthly"

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
      "category": "ENTERTAINMENT" | "UTILITIES" | "SUBSCRIPTIONS" | "HOUSING" | "TRANSPORTATION" | "INSURANCE" | "INCOME",
      "transaction_ids": ["id1", "id2", "id3"],
      "bill_type": "subscription" | "utility" | "loan" | "insurance" | "rent" | "income" | "other"
    }
  ],
  "insights": "Brief summary of what you found"
}

Only include items with confidence >= 70. Sort by confidence descending. Be CONSERVATIVE - when in doubt, exclude it.`

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
  const isPro = canAccessFeature(subscription, 'ai_suggestions') // Using ai_suggestions as proxy for AI features

  if (!isPro) {
    // Return empty for non-Pro users - they'll use client-side pattern matching
    return NextResponse.json({
      recurring: [],
      useClientDetection: true,
      message: 'AI recurring detection requires Pro subscription'
    })
  }

  // Check rate limits
  const usageCheck = await checkAndIncrementUsage(supabase, user.id, 'recurring_detection', isPro)
  if (!usageCheck.allowed) {
    return NextResponse.json(
      rateLimitResponse('recurring detection', usageCheck.limit, isPro),
      { status: 429 }
    )
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
      model: 'claude-haiku-4-20250514', // Using Haiku for cost efficiency
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
