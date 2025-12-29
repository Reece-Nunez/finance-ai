import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/ai'

const SUGGESTION_SYSTEM_PROMPT = `You are a financial monitoring assistant that learns from user feedback. Analyze the user's account balances, recent transactions, and past interaction history to provide personalized suggestions.

Look for:
1. Low checking account balances (under $200 is concerning, under $100 is urgent)
2. Upcoming large recurring expenses that might overdraw an account
3. Unusual spending patterns
4. Opportunities to move excess funds to savings
5. Spending trends and areas where the user could save money
6. Recurring subscriptions that seem unused or could be optimized

IMPORTANT - Learn from the user's past feedback:
- If they APPROVED a suggestion type before, they find that kind of advice helpful
- If they DISMISSED a suggestion, avoid similar suggestions unless circumstances change significantly
- If they EXECUTED a suggestion, it worked for them - suggest similar actions when appropriate
- Adapt your threshold recommendations based on what they've accepted/rejected

When suggesting a transfer, be specific:
- Which account to transfer FROM (name and current balance)
- Which account to transfer TO (name and current balance)
- How much to transfer
- Why this transfer is recommended

Respond with a JSON array of suggestions. Each suggestion should have:
- "type": "transfer" | "alert" | "tip" | "savings_opportunity"
- "priority": "urgent" | "high" | "medium" | "low"
- "title": Short title (max 50 chars)
- "description": Detailed explanation that references patterns you've noticed
- "action": For transfers, include { "from_account": "name", "to_account": "name", "amount": number }

If there are no issues, return an empty array [].
Only return the JSON array, no other text.`

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get only pending suggestions (approved ones are stored for AI learning but not shown)
    const { data: suggestions } = await supabase
      .from('ai_actions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    return NextResponse.json({ suggestions: suggestions || [] })
  } catch (error) {
    console.error('Error fetching suggestions:', error)
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get accounts, recent transactions, and past action history
    const [accountsRes, transactionsRes, pastActionsRes] = await Promise.all([
      supabase.from('accounts').select('*'),
      supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .limit(50),
      supabase
        .from('ai_actions')
        .select('*')
        .in('status', ['approved', 'dismissed', 'executed'])
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    const accounts = accountsRes.data || []
    const transactions = transactionsRes.data || []
    const pastActions = pastActionsRes.data || []

    if (accounts.length === 0) {
      return NextResponse.json({ suggestions: [], message: 'No accounts connected' })
    }

    // Format data for AI analysis
    const accountSummary = accounts.map((a) => ({
      name: a.name,
      type: a.type,
      subtype: a.subtype,
      current_balance: a.current_balance,
      available_balance: a.available_balance,
    }))

    const recentTransactions = transactions.slice(0, 20).map((t) => ({
      date: t.date,
      name: t.merchant_name || t.name,
      amount: t.amount,
      category: t.category,
    }))

    // Format past actions for learning context
    const approvedActions = pastActions
      .filter((a) => a.status === 'approved' || a.status === 'executed')
      .map((a) => ({
        type: a.action_type,
        title: a.details?.title,
        wasExecuted: a.status === 'executed',
        date: a.created_at,
      }))

    const dismissedActions = pastActions
      .filter((a) => a.status === 'dismissed')
      .map((a) => ({
        type: a.action_type,
        title: a.details?.title,
        reason: a.details?.description,
        date: a.created_at,
      }))

    // Build learning context section
    let learningContext = ''
    if (approvedActions.length > 0 || dismissedActions.length > 0) {
      learningContext = `\n## Your Past Feedback (Learn from this!):\n`

      if (approvedActions.length > 0) {
        learningContext += `\n### Suggestions you LIKED (approved/executed):\n${JSON.stringify(approvedActions, null, 2)}\n`
      }

      if (dismissedActions.length > 0) {
        learningContext += `\n### Suggestions you DISMISSED (avoid similar ones):\n${JSON.stringify(dismissedActions, null, 2)}\n`
      }
    }

    // Ask AI to analyze
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SUGGESTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analyze these accounts and transactions for any issues or recommendations:

## Accounts:
${JSON.stringify(accountSummary, null, 2)}

## Recent Transactions:
${JSON.stringify(recentTransactions, null, 2)}
${learningContext}
Based on the above data and my past preferences, provide your personalized suggestions as a JSON array.`,
        },
      ],
    })

    const responseText =
      response.content[0].type === 'text' ? response.content[0].text : '[]'

    // Parse suggestions
    let suggestions: Array<{
      type: string
      priority: string
      title: string
      description: string
      action?: { from_account: string; to_account: string; amount: number }
    }> = []

    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0])
      }
    } catch (parseError) {
      console.error('Error parsing AI suggestions:', parseError)
    }

    // Clear old pending suggestions and insert new ones
    await supabase
      .from('ai_actions')
      .delete()
      .eq('user_id', user.id)
      .eq('status', 'pending')

    if (suggestions.length > 0) {
      const actionsToInsert = suggestions.map((s) => ({
        user_id: user.id,
        action_type: s.type,
        status: 'pending',
        details: {
          priority: s.priority,
          title: s.title,
          description: s.description,
          action: s.action,
        },
        requires_approval: true,
      }))

      await supabase.from('ai_actions').insert(actionsToInsert)
    }

    // Fetch the newly created suggestions
    const { data: newSuggestions } = await supabase
      .from('ai_actions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    return NextResponse.json({ suggestions: newSuggestions || [] })
  } catch (error) {
    console.error('Error generating suggestions:', error)
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, status } = await request.json()

    const updateData: { status: string; approved_at?: string; executed_at?: string } = { status }

    if (status === 'approved') {
      updateData.approved_at = new Date().toISOString()
    } else if (status === 'executed') {
      updateData.executed_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('ai_actions')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating suggestion:', error)
    return NextResponse.json({ error: 'Failed to update suggestion' }, { status: 500 })
  }
}
