import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic, FINANCIAL_ADVISOR_SYSTEM_PROMPT, formatFinancialContext } from '@/lib/ai'
import { getUserSubscription, canAccessFeature } from '@/lib/subscription'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')

    if (sessionId) {
      // Get messages for a specific session
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('role, content, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      return NextResponse.json({ messages: messages || [] })
    } else {
      // Get all sessions
      const { data: sessions } = await supabase
        .from('chat_sessions')
        .select('id, title, created_at, updated_at')
        .order('updated_at', { ascending: false })

      return NextResponse.json({ sessions: sessions || [] })
    }
  } catch (error) {
    console.error('Error fetching chat:', error)
    return NextResponse.json({ error: 'Failed to fetch chat' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check subscription for AI chat access
    const subscription = await getUserSubscription(user.id)
    if (!canAccessFeature(subscription, 'ai_chat')) {
      return NextResponse.json(
        { error: 'upgrade_required', message: 'AI Chat requires a Pro subscription' },
        { status: 403 }
      )
    }

    const { messages, session_id } = await request.json()
    const lastUserMessage = messages[messages.length - 1]

    // Fetch user's AI preferences
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('ai_preferences, first_name')
      .eq('user_id', user.id)
      .maybeSingle()

    const aiPrefs = profile?.ai_preferences || {}
    const userName = profile?.first_name || null

    // Check if AI analysis is allowed
    if (aiPrefs.allow_transaction_analysis === false) {
      return NextResponse.json({
        message: "I'm sorry, but transaction analysis is currently disabled in your AI preferences. You can enable it in Settings > AI Preferences to get personalized financial insights.",
        session_id: session_id
      })
    }

    let sessionId = session_id

    // Create a new session if needed
    if (!sessionId) {
      const title = lastUserMessage.content.slice(0, 50) + (lastUserMessage.content.length > 50 ? '...' : '')
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({ user_id: user.id, title })
        .select()
        .single()

      if (sessionError) {
        console.error('Error creating session:', sessionError)
        throw sessionError
      }
      sessionId = session.id
    } else {
      // Update session timestamp
      await supabase
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId)
    }

    // Save user message
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: user.id,
      role: 'user',
      content: lastUserMessage.content,
    })

    // Fetch user's financial data and learning history
    const [accountsRes, transactionsRes, pastActionsRes, budgetsRes] = await Promise.all([
      supabase.from('accounts').select('name, type, current_balance'),
      aiPrefs.include_spending_context !== false
        ? supabase
            .from('transactions')
            .select('name, merchant_name, amount, date, category')
            .order('date', { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] }),
      supabase
        .from('ai_actions')
        .select('action_type, status, details, created_at')
        .in('status', ['approved', 'dismissed', 'executed'])
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('budgets')
        .select('category, amount, spent')
        .order('created_at', { ascending: false }),
    ])

    const accounts = accountsRes.data || []
    const transactions = transactionsRes.data || []
    const pastActions = pastActionsRes.data || []
    const budgets = budgetsRes.data || []

    // Calculate monthly totals
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0]

    const monthlyTransactions = transactions.filter((t) => t.date >= startOfMonth)
    const monthlyIncome = monthlyTransactions
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    const monthlyExpenses = monthlyTransactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0)

    // Format financial context with learning history
    const financialContext = formatFinancialContext({
      accounts,
      transactions,
      monthlyIncome,
      monthlyExpenses,
      pastActions,
    })

    // Add budget context
    const budgetContext = budgets.length > 0
      ? `\n**Current Budgets:**\n${budgets.map(b => {
          const percentUsed = b.amount > 0 ? ((b.spent || 0) / b.amount * 100).toFixed(0) : 0
          const status = Number(percentUsed) >= 100 ? '🔴 OVER' : Number(percentUsed) >= 80 ? '🟡 WARNING' : '🟢 OK'
          return `- ${b.category}: $${(b.spent || 0).toFixed(2)} / $${b.amount.toFixed(2)} (${percentUsed}%) ${status}`
        }).join('\n')}`
      : ''

    // Build personality modifier based on user preferences
    let personalityModifier = ''
    const personality = aiPrefs.chat_personality || 'friendly'

    if (personality === 'professional') {
      personalityModifier = `
Respond in a professional, formal tone. Use financial terminology when appropriate.
Provide detailed, thorough explanations with specific numbers and percentages.
Be direct and business-like in your communication.`
    } else if (personality === 'concise') {
      personalityModifier = `
Be brief and to-the-point. Use bullet points when listing information.
Avoid lengthy explanations - focus on key facts and actionable advice.
Skip pleasantries and get straight to the answer.`
    } else {
      // friendly (default)
      personalityModifier = `
Be warm, conversational, and encouraging. Use simple, accessible language.
Celebrate wins and be supportive when discussing challenges.
Make financial topics feel approachable and non-intimidating.`
    }

    // Personalization
    const greeting = userName ? `The user's name is ${userName}. You may address them by name occasionally.` : ''

    // Build the full system prompt with context
    const systemPrompt = `${FINANCIAL_ADVISOR_SYSTEM_PROMPT}

${personalityModifier}
${greeting}

---

${financialContext}
${budgetContext}`

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    const assistantMessage =
      response.content[0].type === 'text' ? response.content[0].text : ''

    // Save assistant message
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: user.id,
      role: 'assistant',
      content: assistantMessage,
    })

    return NextResponse.json({ message: assistantMessage, session_id: sessionId })
  } catch (error) {
    console.error('Error in AI chat:', error)
    return NextResponse.json(
      { error: 'Failed to get AI response' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting chat:', error)
    return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 })
  }
}
