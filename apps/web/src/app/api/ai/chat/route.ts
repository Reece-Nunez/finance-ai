import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic, FINANCIAL_ADVISOR_SYSTEM_PROMPT, formatFinancialContext } from '@/lib/ai'
import { getUserSubscription, canAccessFeature } from '@/lib/subscription'
import { checkAndIncrementUsage, rateLimitResponse } from '@/lib/ai-usage'
import { SupabaseClient } from '@supabase/supabase-js'

// Tools that Sterling can use to take actions
const STERLING_TOOLS = [
  {
    name: 'create_transaction_rule',
    description: 'Create a transaction rule to automatically rename, categorize, or ignore transactions that match a pattern. Use this when the user asks to ignore, categorize, or rename certain transactions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        match_pattern: {
          type: 'string',
          description: 'The text pattern to match in transaction names (e.g., "INTEREST" to match interest deposits, "WALMART" for Walmart transactions)',
        },
        display_name: {
          type: 'string',
          description: 'Optional: Rename matching transactions to this display name',
        },
        set_category: {
          type: 'string',
          description: 'Optional: Set the category for matching transactions',
        },
        set_ignore_type: {
          type: 'string',
          enum: ['all', 'budget', 'none'],
          description: 'Optional: "all" to ignore from all reports, "budget" to ignore from budget only, "none" to not ignore',
        },
        set_as_income: {
          type: 'boolean',
          description: 'Optional: Mark matching transactions as income',
        },
      },
      required: ['match_pattern'],
    },
  },
  {
    name: 'update_transaction',
    description: 'Update a specific transaction (rename, categorize, or ignore it). Use this for one-off changes to a single transaction.',
    input_schema: {
      type: 'object' as const,
      properties: {
        transaction_id: {
          type: 'string',
          description: 'The ID of the transaction to update',
        },
        display_name: {
          type: 'string',
          description: 'New display name for the transaction',
        },
        category: {
          type: 'string',
          description: 'New category for the transaction',
        },
        ignore_type: {
          type: 'string',
          enum: ['all', 'budget', 'none'],
          description: '"all" to ignore from all reports, "budget" to ignore from budget only, "none" to not ignore',
        },
      },
      required: ['transaction_id'],
    },
  },
  {
    name: 'search_transactions',
    description: 'Search for transactions by name or pattern to find specific transactions',
    input_schema: {
      type: 'object' as const,
      properties: {
        search_term: {
          type: 'string',
          description: 'The text to search for in transaction names',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default 10)',
        },
      },
      required: ['search_term'],
    },
  },
]

// Execute a tool call
async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  supabase: SupabaseClient,
  userId: string
): Promise<{ success: boolean; message: string; data?: unknown }> {
  switch (toolName) {
    case 'create_transaction_rule': {
      const { match_pattern, display_name, set_category, set_ignore_type, set_as_income } = toolInput as {
        match_pattern: string
        display_name?: string
        set_category?: string
        set_ignore_type?: string
        set_as_income?: boolean
      }

      // Build description
      const actions: string[] = []
      if (display_name) actions.push(`rename to "${display_name}"`)
      if (set_category) actions.push(`categorize as "${set_category}"`)
      if (set_as_income) actions.push('mark as income')
      if (set_ignore_type === 'all') actions.push('ignore from all reports')
      if (set_ignore_type === 'budget') actions.push('ignore from budget')

      const description = actions.length > 0
        ? `"${match_pattern}": ${actions.join(', ')}`
        : `Match "${match_pattern}"`

      // If category is INCOME and set_as_income wasn't explicitly set, default to true
      const finalSetAsIncome = set_as_income !== undefined
        ? set_as_income
        : (set_category?.toUpperCase() === 'INCOME' ? true : false)

      // Create the rule
      const { data: rule, error } = await supabase
        .from('transaction_rules')
        .insert({
          user_id: userId,
          match_field: 'name',
          match_pattern,
          display_name: display_name || null,
          set_category: set_category || null,
          set_as_income: finalSetAsIncome,
          set_ignore_type: set_ignore_type || null,
          description,
        })
        .select()
        .single()

      if (error) {
        return { success: false, message: `Failed to create rule: ${error.message}` }
      }

      // Apply rule to existing transactions
      const updates: Record<string, unknown> = {}
      if (display_name) updates.display_name = display_name
      if (set_category) updates.category = set_category
      // Set is_income based on finalSetAsIncome or if category is INCOME
      if (finalSetAsIncome || set_category?.toUpperCase() === 'INCOME') {
        updates.is_income = true
      }
      if (set_ignore_type && set_ignore_type !== 'none') updates.ignore_type = set_ignore_type

      if (Object.keys(updates).length > 0) {
        // First count matching transactions
        const { count } = await supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .ilike('name', `%${match_pattern}%`)

        // Then update them
        await supabase
          .from('transactions')
          .update(updates)
          .eq('user_id', userId)
          .ilike('name', `%${match_pattern}%`)

        return {
          success: true,
          message: `Created rule "${description}" and applied to ${count || 0} existing transactions.`,
          data: { rule, updated_count: count || 0 },
        }
      }

      return { success: true, message: `Created rule: ${description}`, data: { rule } }
    }

    case 'update_transaction': {
      const { transaction_id, display_name, category, ignore_type } = toolInput as {
        transaction_id: string
        display_name?: string
        category?: string
        ignore_type?: string
      }

      const updates: Record<string, unknown> = {}
      if (display_name) updates.display_name = display_name
      if (category) updates.category = category
      if (ignore_type) updates.ignore_type = ignore_type

      if (Object.keys(updates).length === 0) {
        return { success: false, message: 'No updates specified' }
      }

      const { error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', transaction_id)
        .eq('user_id', userId)

      if (error) {
        return { success: false, message: `Failed to update transaction: ${error.message}` }
      }

      return { success: true, message: 'Transaction updated successfully' }
    }

    case 'search_transactions': {
      const { search_term, limit = 10 } = toolInput as { search_term: string; limit?: number }

      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('id, name, display_name, merchant_name, amount, date, category, ignore_type')
        .eq('user_id', userId)
        .ilike('name', `%${search_term}%`)
        .order('date', { ascending: false })
        .limit(limit)

      if (error) {
        return { success: false, message: `Failed to search transactions: ${error.message}` }
      }

      return {
        success: true,
        message: `Found ${transactions?.length || 0} transactions matching "${search_term}"`,
        data: { transactions },
      }
    }

    default:
      return { success: false, message: `Unknown tool: ${toolName}` }
  }
}

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
    const isPro = canAccessFeature(subscription, 'ai_chat')
    if (!isPro) {
      return NextResponse.json(
        { error: 'upgrade_required', message: 'AI Chat requires a Pro subscription' },
        { status: 403 }
      )
    }

    // Check rate limits
    const usageCheck = await checkAndIncrementUsage(supabase, user.id, 'chat', isPro)
    if (!usageCheck.allowed) {
      return NextResponse.json(
        rateLimitResponse('chat', usageCheck.limit, isPro),
        { status: 429 }
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

    // Call Claude with tools
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt + `

## ACTIONS YOU CAN TAKE
You have the ability to take actions in the app when users ask you to. Available actions include:
- Creating transaction rules to ignore, rename, or categorize transactions
- Updating individual transactions
- Searching for specific transactions

When a user asks you to do something like "ignore all interest transactions" or "categorize all Walmart as groceries", USE THE TOOLS to actually do it, don't just explain how they could do it themselves.

After using a tool, always confirm what you did in a friendly way.`,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      tools: STERLING_TOOLS,
    })

    // Process the response - handle tool calls if present
    let assistantMessage = ''
    const toolResults: Array<{ tool: string; result: string }> = []

    for (const block of response.content) {
      if (block.type === 'text') {
        assistantMessage += block.text
      } else if (block.type === 'tool_use') {
        // Execute the tool
        const result = await executeTool(
          block.name,
          block.input as Record<string, unknown>,
          supabase,
          user.id
        )
        toolResults.push({
          tool: block.name,
          result: result.message,
        })

        // If tool was used, we need to continue the conversation to get a final response
        if (response.stop_reason === 'tool_use') {
          // Call Claude again with tool results
          const toolResultMessages = [
            ...messages.map((m: { role: string; content: string }) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
            {
              role: 'assistant' as const,
              content: response.content,
            },
            {
              role: 'user' as const,
              content: [
                {
                  type: 'tool_result' as const,
                  tool_use_id: block.id,
                  content: JSON.stringify(result),
                },
              ],
            },
          ]

          const followUpResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: systemPrompt,
            messages: toolResultMessages,
            tools: STERLING_TOOLS,
          })

          // Extract text from follow-up response
          for (const followUpBlock of followUpResponse.content) {
            if (followUpBlock.type === 'text') {
              assistantMessage = followUpBlock.text
            }
          }
        }
      }
    }

    // If no text response was generated, create one from tool results
    if (!assistantMessage && toolResults.length > 0) {
      assistantMessage = toolResults.map(r => `✅ ${r.result}`).join('\n')
    }

    // Save assistant message
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: user.id,
      role: 'assistant',
      content: assistantMessage,
    })

    return NextResponse.json({
      message: assistantMessage,
      session_id: sessionId,
      actions_taken: toolResults.length > 0 ? toolResults : undefined,
    })
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
