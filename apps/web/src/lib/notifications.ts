import { SupabaseClient } from '@supabase/supabase-js'
import { detectRecurringTransactions, RecurringTransaction } from './recurring'

interface NotificationData {
  type: string
  title: string
  message: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  action_url?: string
  metadata?: Record<string, any>
}

// Thresholds for alerts
const LOW_BALANCE_THRESHOLD = 100 // Alert when balance drops below $100
const BUDGET_WARNING_THRESHOLD = 0.8 // Alert at 80% of budget
const UPCOMING_PAYMENT_DAYS = 3 // Alert 3 days before recurring payment

export async function generateNotifications(supabase: SupabaseClient, userId: string) {
  const notifications: NotificationData[] = []

  // Fetch user's notification preferences
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('notification_preferences')
    .eq('user_id', userId)
    .maybeSingle()

  const prefs = profile?.notification_preferences || {}

  // Run checks based on user preferences
  const checks: Promise<NotificationData[]>[] = []

  // Check if low_balance alerts are enabled
  if (prefs.low_balance?.enabled !== false) {
    checks.push(checkLowBalances(supabase, userId, prefs.low_balance_threshold))
  }

  // Check if budget_alerts are enabled
  if (prefs.budget_alerts?.enabled !== false) {
    checks.push(checkBudgetWarnings(supabase, userId))
  }

  // Check if recurring_payments alerts are enabled
  if (prefs.recurring_payments?.enabled !== false) {
    checks.push(checkUpcomingRecurringPayments(supabase, userId))
  }

  const results = await Promise.all(checks)
  results.forEach(notifs => notifications.push(...notifs))

  // Insert notifications (avoiding duplicates by checking recent notifications)
  for (const notif of notifications) {
    await createNotificationIfNew(supabase, userId, notif)
  }

  return notifications.length
}

async function createNotificationIfNew(
  supabase: SupabaseClient,
  userId: string,
  notification: NotificationData
) {
  // Check if a similar notification was created in the last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: existing } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', notification.type)
    .eq('title', notification.title)
    .gte('created_at', oneDayAgo)
    .limit(1)

  if (existing && existing.length > 0) {
    return // Don't create duplicate
  }

  await supabase.from('notifications').insert({
    user_id: userId,
    ...notification,
  })
}

async function checkLowBalances(
  supabase: SupabaseClient,
  userId: string,
  customThreshold?: number
): Promise<NotificationData[]> {
  const notifications: NotificationData[] = []
  const threshold = customThreshold ?? LOW_BALANCE_THRESHOLD

  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)

  if (!accounts) return notifications

  for (const account of accounts) {
    const balance = account.available_balance ?? account.current_balance ?? 0

    // Only check checking/savings accounts for low balance
    if (['checking', 'savings'].includes(account.subtype?.toLowerCase() || '')) {
      if (balance < threshold && balance >= 0) {
        notifications.push({
          type: 'low_balance',
          title: `Low Balance: ${account.name}`,
          message: `Your ${account.name} account balance is $${balance.toFixed(2)}. Consider transferring funds to avoid overdraft.`,
          priority: balance < 50 ? 'urgent' : 'high',
          action_url: '/dashboard/accounts',
          metadata: {
            account_id: account.id,
            balance,
            account_name: account.name,
          },
        })
      }

      // Negative balance (overdraft)
      if (balance < 0) {
        notifications.push({
          type: 'low_balance',
          title: `Overdraft Alert: ${account.name}`,
          message: `Your ${account.name} account is overdrawn by $${Math.abs(balance).toFixed(2)}. Immediate action required.`,
          priority: 'urgent',
          action_url: '/dashboard/accounts',
          metadata: {
            account_id: account.id,
            balance,
            account_name: account.name,
          },
        })
      }
    }
  }

  return notifications
}

async function checkBudgetWarnings(
  supabase: SupabaseClient,
  userId: string
): Promise<NotificationData[]> {
  const notifications: NotificationData[] = []

  // Get budgets
  const { data: budgets } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)

  if (!budgets || budgets.length === 0) return notifications

  // Get current month's transactions
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startOfMonth)
    .gt('amount', 0) // Only expenses

  if (!transactions) return notifications

  // Calculate spending by category
  const spendingByCategory: Record<string, number> = {}
  for (const tx of transactions) {
    const category = tx.category || tx.ai_category || 'Uncategorized'
    spendingByCategory[category] = (spendingByCategory[category] || 0) + tx.amount
  }

  // Check each budget
  for (const budget of budgets) {
    const spent = spendingByCategory[budget.category] || 0
    const percentUsed = spent / budget.amount

    if (percentUsed >= 1) {
      // Over budget
      notifications.push({
        type: 'budget_warning',
        title: `Budget Exceeded: ${budget.category}`,
        message: `You've spent $${spent.toFixed(0)} of your $${budget.amount} ${budget.category} budget (${Math.round(percentUsed * 100)}%).`,
        priority: 'high',
        action_url: '/dashboard/budgets',
        metadata: {
          budget_id: budget.id,
          category: budget.category,
          budget_amount: budget.amount,
          spent,
          percent_used: percentUsed,
        },
      })
    } else if (percentUsed >= BUDGET_WARNING_THRESHOLD) {
      // Approaching budget
      notifications.push({
        type: 'budget_warning',
        title: `Budget Warning: ${budget.category}`,
        message: `You've used ${Math.round(percentUsed * 100)}% of your $${budget.amount} ${budget.category} budget. $${(budget.amount - spent).toFixed(0)} remaining.`,
        priority: 'normal',
        action_url: '/dashboard/budgets',
        metadata: {
          budget_id: budget.id,
          category: budget.category,
          budget_amount: budget.amount,
          spent,
          percent_used: percentUsed,
        },
      })
    }
  }

  return notifications
}

async function checkUpcomingRecurringPayments(
  supabase: SupabaseClient,
  userId: string
): Promise<NotificationData[]> {
  const notifications: NotificationData[] = []

  // Get all transactions for recurring detection
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true })

  if (!transactions || transactions.length === 0) return notifications

  // Detect recurring transactions
  const recurring = detectRecurringTransactions(transactions)

  // Check for upcoming payments
  const now = new Date()
  const upcomingThreshold = new Date(now.getTime() + UPCOMING_PAYMENT_DAYS * 24 * 60 * 60 * 1000)

  for (const r of recurring) {
    const nextDate = new Date(r.nextExpectedDate)

    if (nextDate >= now && nextDate <= upcomingThreshold) {
      const daysUntil = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      notifications.push({
        type: 'recurring_payment',
        title: `Upcoming Payment: ${capitalize(r.merchantName)}`,
        message: `${capitalize(r.merchantName)} (~$${r.averageAmount.toFixed(0)}) is expected ${daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`}.`,
        priority: daysUntil <= 1 ? 'high' : 'normal',
        action_url: '/dashboard/transactions',
        metadata: {
          merchant: r.merchantName,
          expected_amount: r.averageAmount,
          expected_date: r.nextExpectedDate,
          frequency: r.frequency,
        },
      })
    }
  }

  return notifications
}

function capitalize(str: string): string {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Unusual spending detection (bonus feature)
export async function checkUnusualSpending(
  supabase: SupabaseClient,
  userId: string
): Promise<NotificationData[]> {
  const notifications: NotificationData[] = []

  // Fetch user's notification preferences
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('notification_preferences')
    .eq('user_id', userId)
    .maybeSingle()

  const prefs = profile?.notification_preferences || {}

  // Check if suspicious_activity alerts are enabled
  if (prefs.suspicious_activity?.enabled === false) {
    return notifications
  }

  // Get last 90 days of transactions
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('date', ninetyDaysAgo)
    .gt('amount', 0)

  if (!transactions || transactions.length < 10) return notifications

  // Calculate average daily spending (excluding last 7 days)
  const olderTransactions = transactions.filter(t => t.date < sevenDaysAgo)
  const recentTransactions = transactions.filter(t => t.date >= sevenDaysAgo)

  if (olderTransactions.length < 7 || recentTransactions.length === 0) return notifications

  const olderTotal = olderTransactions.reduce((sum, t) => sum + t.amount, 0)
  const olderDays = Math.ceil(
    (new Date(sevenDaysAgo).getTime() - new Date(ninetyDaysAgo).getTime()) / (1000 * 60 * 60 * 24)
  )
  const avgDailySpending = olderTotal / olderDays

  const recentTotal = recentTransactions.reduce((sum, t) => sum + t.amount, 0)
  const recentAvgDaily = recentTotal / 7

  // Alert if spending is 50% higher than average
  if (recentAvgDaily > avgDailySpending * 1.5) {
    notifications.push({
      type: 'unusual_spending',
      title: 'Unusual Spending Detected',
      message: `Your spending this week ($${recentTotal.toFixed(0)}) is ${Math.round((recentAvgDaily / avgDailySpending - 1) * 100)}% higher than your average.`,
      priority: 'normal',
      action_url: '/dashboard/analytics',
      metadata: {
        recent_total: recentTotal,
        average_daily: avgDailySpending,
        recent_daily: recentAvgDaily,
      },
    })
  }

  // Check for unusually large single transactions
  const avgTransaction = olderTotal / olderTransactions.length
  const largeThreshold = prefs.large_transaction_threshold || 500

  // Check large withdrawals if enabled
  if (prefs.large_withdrawal?.enabled !== false) {
    const largeWithdrawals = recentTransactions.filter(
      t => t.amount > 0 && t.amount > largeThreshold
    )

    for (const tx of largeWithdrawals) {
      notifications.push({
        type: 'large_withdrawal',
        title: 'Large Withdrawal',
        message: `$${tx.amount.toFixed(0)} spent at ${tx.merchant_name || tx.name}.`,
        priority: 'normal',
        action_url: '/dashboard/transactions',
        metadata: {
          transaction_id: tx.id,
          amount: tx.amount,
          merchant: tx.merchant_name || tx.name,
        },
      })
    }
  }

  // Check large deposits if enabled
  if (prefs.large_deposit?.enabled !== false) {
    const largeDeposits = recentTransactions.filter(
      t => t.amount < 0 && Math.abs(t.amount) > largeThreshold
    )

    for (const tx of largeDeposits) {
      notifications.push({
        type: 'large_deposit',
        title: 'Large Deposit',
        message: `$${Math.abs(tx.amount).toFixed(0)} received from ${tx.merchant_name || tx.name}.`,
        priority: 'low',
        action_url: '/dashboard/transactions',
        metadata: {
          transaction_id: tx.id,
          amount: Math.abs(tx.amount),
          merchant: tx.merchant_name || tx.name,
        },
      })
    }
  }

  // Also flag statistically unusual transactions
  const unusualTransactions = recentTransactions.filter(
    t => t.amount > 0 && t.amount > avgTransaction * 3
  )

  for (const tx of unusualTransactions) {
    notifications.push({
      type: 'unusual_spending',
      title: 'Unusual Transaction',
      message: `$${tx.amount.toFixed(0)} at ${tx.merchant_name || tx.name} is ${Math.round(tx.amount / avgTransaction)}x your average.`,
      priority: 'normal',
      action_url: '/dashboard/transactions',
      metadata: {
        transaction_id: tx.id,
        amount: tx.amount,
        merchant: tx.merchant_name || tx.name,
      },
    })
  }

  return notifications
}
