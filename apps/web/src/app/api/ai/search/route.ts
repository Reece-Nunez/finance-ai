import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/ai'
import {
  SEARCH_PARSER_SYSTEM_PROMPT,
  SEARCH_FILTER_TOOL,
  parseToolResult,
  executeSearch,
} from '@/lib/search-parser'
import { SearchResponse } from '@/types/search'
import { getUserSubscription, canAccessFeature } from '@/lib/subscription'
import { checkAndIncrementUsage, rateLimitResponse } from '@/lib/ai-usage'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check subscription for NL search access
    const subscription = await getUserSubscription(user.id)
    const isPro = canAccessFeature(subscription, 'nl_search')
    if (!isPro) {
      return NextResponse.json(
        { error: 'upgrade_required', message: 'Natural Language Search requires a Pro subscription' },
        { status: 403 }
      )
    }

    // Check rate limits
    const usageCheck = await checkAndIncrementUsage(supabase, user.id, 'search', isPro)
    if (!usageCheck.allowed) {
      return NextResponse.json(
        rateLimitResponse('search', usageCheck.limit, isPro),
        { status: 429 }
      )
    }

    const { query } = await request.json()

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    // Get current date for context
    const today = new Date().toISOString().split('T')[0]

    // Parse the natural language query using Claude with tool use
    const parseResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-20250514', // Using Haiku for cost efficiency - parsing is simpler
      max_tokens: 1024,
      system: SEARCH_PARSER_SYSTEM_PROMPT.replace('{{CURRENT_DATE}}', today),
      tools: [SEARCH_FILTER_TOOL],
      tool_choice: { type: 'tool', name: 'extract_search_filters' },
      messages: [{ role: 'user', content: query }],
    })

    // Extract the tool use result
    const toolUse = parseResponse.content.find((c) => c.type === 'tool_use')

    if (!toolUse || toolUse.name !== 'extract_search_filters') {
      const response: SearchResponse = {
        interpretation: {
          summary: 'Could not understand query',
          filters: { summary: query, resultType: 'transactions' },
        },
        resultType: 'transactions',
        error:
          'Could not parse your query. Try something like "How much did I spend on groceries last month?"',
      }
      return NextResponse.json(response, { status: 400 })
    }

    const filters = parseToolResult(toolUse.input)

    // Execute the search based on parsed filters
    const results = await executeSearch(supabase, user.id, filters)

    const response: SearchResponse = {
      interpretation: {
        summary: filters.summary,
        filters,
      },
      resultType: filters.resultType,
      transactions: results.transactions
        ? {
            items: results.transactions,
            total: results.transactions.length,
            hasMore: results.transactions.length >= (filters.limit || 50),
          }
        : undefined,
      summary: results.summary,
      comparison: results.comparison,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in AI search:', error)
    return NextResponse.json(
      { error: 'Failed to process search query' },
      { status: 500 }
    )
  }
}
