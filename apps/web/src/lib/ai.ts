import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const FINANCIAL_ADVISOR_SYSTEM_PROMPT = `You are a helpful AI financial advisor assistant that learns and adapts to the user's preferences over time. You have access to the user's financial data including their bank accounts, transactions, spending patterns, and history of past interactions.

Your role is to:
- Answer questions about their finances in a clear, helpful way
- Provide personalized insights based on their spending patterns
- Suggest ways to save money and improve their financial health
- Help them understand their spending categories
- Identify potential issues like unusual charges or overspending
- Recommend budget allocations based on their income and expenses
- Learn from their feedback on past suggestions to provide better, more personalized advice

Guidelines:
- Be concise but thorough
- Use specific numbers from their data when relevant
- Be encouraging but honest about areas for improvement
- Never make assumptions about income they haven't shared
- If you don't have enough data to answer, say so
- Format currency amounts properly (e.g., $1,234.56)
- Use bullet points and clear formatting for readability

LEARNING FROM FEEDBACK:
- If the user has approved or executed past suggestions, they found that type of advice helpful - offer similar insights
- If the user dismissed suggestions, understand what they don't want and avoid similar recommendations
- Reference patterns you've noticed in their financial behavior
- Build on previous conversations to provide increasingly personalized advice
- Remember their financial goals and priorities based on past interactions

Remember: You're here to help them make better financial decisions, not to judge their spending habits. The more they interact with you, the better you should understand their financial goals and preferences.`

interface PastAction {
  action_type: string
  status: string
  details: {
    title: string
    description: string
    priority?: string
  } | null
  created_at: string
}

export function formatFinancialContext(data: {
  accounts: Array<{
    name: string
    type: string
    current_balance: number | null
  }>
  transactions: Array<{
    name: string
    merchant_name: string | null
    amount: number
    date: string
    category: string | null
  }>
  monthlyIncome: number
  monthlyExpenses: number
  pastActions?: PastAction[]
}) {
  const { accounts, transactions, monthlyIncome, monthlyExpenses, pastActions = [] } = data

  const totalBalance = accounts.reduce((sum, acc) => {
    if (acc.type === 'credit') {
      return sum - (acc.current_balance || 0)
    }
    return sum + (acc.current_balance || 0)
  }, 0)

  // Group transactions by category
  const categorySpending: Record<string, number> = {}
  transactions.forEach((tx) => {
    if (tx.amount > 0) {
      const category = tx.category || 'Uncategorized'
      categorySpending[category] = (categorySpending[category] || 0) + tx.amount
    }
  })

  const sortedCategories = Object.entries(categorySpending)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)

  // Detect recurring transactions (same merchant, similar amounts)
  const merchantCounts: Record<string, { count: number; totalAmount: number; amounts: number[] }> = {}
  transactions.forEach((tx) => {
    const merchant = tx.merchant_name || tx.name
    if (!merchantCounts[merchant]) {
      merchantCounts[merchant] = { count: 0, totalAmount: 0, amounts: [] }
    }
    merchantCounts[merchant].count++
    merchantCounts[merchant].totalAmount += Math.abs(tx.amount)
    merchantCounts[merchant].amounts.push(Math.abs(tx.amount))
  })

  const recurringTransactions = Object.entries(merchantCounts)
    .filter(([, data]) => data.count >= 2)
    .map(([merchant, data]) => ({
      merchant,
      frequency: data.count,
      avgAmount: data.totalAmount / data.count,
      isSubscription: data.amounts.every(a => Math.abs(a - data.amounts[0]) < 1), // Same amount = likely subscription
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10)

  // Calculate savings rate
  const savingsRate = monthlyIncome > 0
    ? ((monthlyIncome - monthlyExpenses) / monthlyIncome * 100).toFixed(1)
    : '0'

  // Find top merchants by spending
  const topMerchants = Object.entries(merchantCounts)
    .filter(([, data]) => data.totalAmount > 0)
    .sort(([, a], [, b]) => b.totalAmount - a.totalAmount)
    .slice(0, 5)
    .map(([merchant, data]) => ({ merchant, total: data.totalAmount, count: data.count }))

  // Detect potentially unusual transactions (large one-time expenses)
  const avgTransaction = transactions.length > 0
    ? transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) / transactions.length
    : 0
  const unusualTransactions = transactions
    .filter(tx => Math.abs(tx.amount) > avgTransaction * 3 && tx.amount > 0)
    .slice(0, 5)

  return `
## User's Financial Summary

**Total Net Balance:** $${totalBalance.toFixed(2)}

**Accounts:**
${accounts.map((a) => `- ${a.name} (${a.type}): $${(a.current_balance || 0).toFixed(2)}`).join('\n')}

**This Month:**
- Income: $${monthlyIncome.toFixed(2)}
- Expenses: $${monthlyExpenses.toFixed(2)}
- Net: $${(monthlyIncome - monthlyExpenses).toFixed(2)}
- Savings Rate: ${savingsRate}%${Number(savingsRate) < 0 ? ' ⚠️ NEGATIVE - spending more than earning!' : Number(savingsRate) < 10 ? ' ⚠️ LOW - aim for 20%+' : Number(savingsRate) >= 20 ? ' ✅ HEALTHY' : ''}

**Top Spending Categories (This Month):**
${sortedCategories.map(([cat, amount]) => `- ${cat}: $${amount.toFixed(2)}`).join('\n')}

**Top Merchants (Where money goes most):**
${topMerchants.map(m => `- ${m.merchant}: $${m.total.toFixed(2)} (${m.count} transactions)`).join('\n')}

**Detected Recurring/Subscription Payments:**
${recurringTransactions.length > 0
  ? recurringTransactions.map(r => `- ${r.merchant}: ~$${r.avgAmount.toFixed(2)} ${r.isSubscription ? '(likely subscription)' : ''} - ${r.frequency}x`).join('\n')
  : '- No recurring payments detected yet'}

${unusualTransactions.length > 0 ? `**Unusually Large Transactions (potential one-time expenses):**
${unusualTransactions.map(tx => `- ${tx.date}: ${tx.merchant_name || tx.name} - $${Math.abs(tx.amount).toFixed(2)}`).join('\n')}` : ''}

**Recent Transactions (Last 20):**
${transactions
  .slice(0, 20)
  .map((tx) => `- ${tx.date}: ${tx.merchant_name || tx.name} - $${Math.abs(tx.amount).toFixed(2)} (${tx.category || 'Uncategorized'})`)
  .join('\n')}
${formatLearningContext(pastActions)}
`
}

function formatLearningContext(pastActions: PastAction[]): string {
  if (pastActions.length === 0) {
    return ''
  }

  const approved = pastActions.filter(a => a.status === 'approved')
  const executed = pastActions.filter(a => a.status === 'executed')
  const dismissed = pastActions.filter(a => a.status === 'dismissed')

  let context = '\n---\n\n## Learning From Past Interactions\n'

  if (executed.length > 0) {
    context += '\n**Suggestions the user EXECUTED (these worked well!):**\n'
    executed.forEach(a => {
      context += `- ${a.details?.title}: ${a.details?.description}\n`
    })
  }

  if (approved.length > 0) {
    context += '\n**Suggestions the user APPROVED (they liked these):**\n'
    approved.forEach(a => {
      context += `- ${a.details?.title}: ${a.details?.description}\n`
    })
  }

  if (dismissed.length > 0) {
    context += '\n**Suggestions the user DISMISSED (avoid similar ones):**\n'
    dismissed.forEach(a => {
      context += `- ${a.details?.title}\n`
    })
  }

  // Add insights about preferences
  const transfersApproved = [...approved, ...executed].filter(a => a.action_type === 'transfer').length
  const transfersDismissed = dismissed.filter(a => a.action_type === 'transfer').length
  const alertsApproved = [...approved, ...executed].filter(a => a.action_type === 'alert').length
  const alertsDismissed = dismissed.filter(a => a.action_type === 'alert').length

  context += '\n**Inferred Preferences:**\n'

  if (transfersApproved > transfersDismissed) {
    context += '- User is receptive to transfer suggestions\n'
  } else if (transfersDismissed > transfersApproved) {
    context += '- User prefers to manage transfers themselves - focus on alerts/tips instead\n'
  }

  if (alertsApproved > 0) {
    context += '- User values proactive alerts about their finances\n'
  }

  if (executed.length > approved.length) {
    context += '- User tends to act on suggestions - they trust your advice\n'
  }

  return context
}
