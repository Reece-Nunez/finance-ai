import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Sparkles, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import { getUserSubscription } from '@/lib/subscription'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch all data in parallel including user profile and subscription
  const [accountsRes, transactionsRes, recentTransactionsRes, plaidItemsRes, profileRes, subscription] = await Promise.all([
    supabase.from('accounts').select('*'),
    supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .limit(200),
    supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .limit(10),
    supabase.from('plaid_items').select('updated_at').order('updated_at', { ascending: false }).limit(1),
    user ? supabase.from('user_profiles').select('first_name, last_name').eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    user ? getUserSubscription(user.id) : Promise.resolve({ tier: 'free' as const, status: 'none' as const }),
  ])

  const isPro = subscription.tier === 'pro' && (subscription.status === 'active' || subscription.status === 'trialing')

  const accounts = accountsRes.data || []
  const allTransactions = transactionsRes.data || []
  const recentTransactions = recentTransactionsRes.data || []
  const lastSynced = plaidItemsRes.data?.[0]?.updated_at || null

  // Get first name from profile, or fall back to auth user metadata
  const userProfile = profileRes.data
  const authFirstName = user?.user_metadata?.first_name

  // Calculate this month's income and expenses
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const monthTransactions = allTransactions.filter(t => t.date >= startOfMonth)

  const earnings = monthTransactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const spending = monthTransactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)

  const hasAccounts = accounts.length > 0

  // Get greeting based on time of day with user's first name
  const hour = now.getHours()
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  // Try profile first, then auth metadata, then nothing
  const firstName = userProfile?.first_name || authFirstName || null
  const greeting = firstName ? `${timeGreeting}, ${firstName}!` : timeGreeting

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{greeting}</h2>
          <p className="text-muted-foreground">Here&apos;s your financial overview</p>
        </div>
        {!hasAccounts && (
          <Button
            asChild
            className="bg-gradient-to-r from-slate-500 to-slate-700 hover:from-slate-600 hover:to-slate-800 shadow-lg shadow-slate-500/25"
          >
            <Link href="/dashboard/accounts">
              <Plus className="mr-2 h-4 w-4" />
              Connect Account
            </Link>
          </Button>
        )}
      </div>

      {/* No Accounts State */}
      {!hasAccounts ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Welcome Card */}
          <Card className="border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 dark:border-slate-700 dark:from-slate-900/50 dark:to-slate-800/50 lg:col-span-2">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-gradient-to-br from-slate-500 to-slate-700 p-4 shadow-lg shadow-slate-500/25">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
              <h3 className="mt-6 text-xl font-semibold">Welcome to Sterling</h3>
              <p className="mt-2 max-w-md text-muted-foreground">
                Connect your bank accounts to get started with AI-powered financial insights,
                automatic transaction tracking, and personalized recommendations.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Button
                  asChild
                  className="bg-gradient-to-r from-slate-500 to-slate-700 hover:from-slate-600 hover:to-slate-800"
                >
                  <Link href="/dashboard/accounts">
                    <Plus className="mr-2 h-4 w-4" />
                    Connect Your First Account
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/dashboard/chat">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Chat with AI Advisor
                  </Link>
                </Button>
              </div>
              <div className="mt-8 grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-white/60 p-4 dark:bg-black/20">
                  <h4 className="font-medium text-slate-900 dark:text-slate-100">
                    Track Spending
                  </h4>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    See where your money goes automatically
                  </p>
                </div>
                <div className="rounded-lg bg-white/60 p-4 dark:bg-black/20">
                  <h4 className="font-medium text-slate-900 dark:text-slate-100">
                    Bill Reminders
                  </h4>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Never miss a payment with smart alerts
                  </p>
                </div>
                <div className="rounded-lg bg-white/60 p-4 dark:bg-black/20">
                  <h4 className="font-medium text-slate-900 dark:text-slate-100">
                    AI Insights
                  </h4>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Get personalized financial advice
                  </p>
                </div>
                <div className="rounded-lg bg-white/60 p-4 dark:bg-black/20">
                  <h4 className="font-medium text-slate-900 dark:text-slate-100">
                    Budget Goals
                  </h4>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Set and track your savings goals
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <DashboardClient
          accounts={accounts}
          transactions={recentTransactions}
          allTransactions={allTransactions}
          earnings={earnings}
          spending={spending}
          lastSynced={lastSynced}
          hasAccounts={hasAccounts}
          isPro={isPro}
        />
      )}
    </div>
  )
}
