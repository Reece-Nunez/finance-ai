import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, TrendingUp, Brain, Shield, PieChart, Sparkles, Zap } from 'lucide-react'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              FinanceAI
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25">
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="relative overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-emerald-50 to-transparent dark:from-emerald-950/20" />
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-100 via-transparent to-transparent opacity-50 dark:from-emerald-900/30" />

          <div className="mx-auto max-w-7xl px-4 py-24 text-center lg:py-32">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              <Sparkles className="h-4 w-4" />
              AI-Powered Financial Intelligence
            </div>
            <h1 className="mx-auto mt-6 max-w-4xl text-5xl font-bold tracking-tight lg:text-6xl">
              Your money, managed by{' '}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                artificial intelligence
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Connect your bank accounts, get personalized insights, and let AI help you
              make smarter financial decisions. Budget better, save more, stress less.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25">
                <Link href="/signup">
                  Start for free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            </div>

            {/* Trust badges */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-600" />
                Bank-level security
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-600" />
                Real-time sync
              </div>
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-emerald-600" />
                Claude AI powered
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-card py-24">
          <div className="mx-auto max-w-7xl px-4">
            <div className="text-center">
              <h2 className="text-3xl font-bold">
                Everything you need to manage your money
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Powerful features designed to help you take control of your finances
              </p>
            </div>
            <div className="mt-16 grid gap-8 md:grid-cols-3">
              <div className="group relative overflow-hidden rounded-2xl border bg-card p-8 transition-all hover:shadow-lg hover:shadow-emerald-500/10">
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <h3 className="mt-6 text-xl font-semibold">AI-Powered Insights</h3>
                <p className="mt-3 text-muted-foreground">
                  Our AI analyzes your spending patterns and provides actionable
                  recommendations to help you save more money.
                </p>
              </div>
              <div className="group relative overflow-hidden rounded-2xl border bg-card p-8 transition-all hover:shadow-lg hover:shadow-emerald-500/10">
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
                  <PieChart className="h-6 w-6 text-white" />
                </div>
                <h3 className="mt-6 text-xl font-semibold">Smart Budgeting</h3>
                <p className="mt-3 text-muted-foreground">
                  Set budgets based on AI suggestions and track your progress with
                  real-time updates and intelligent alerts.
                </p>
              </div>
              <div className="group relative overflow-hidden rounded-2xl border bg-card p-8 transition-all hover:shadow-lg hover:shadow-emerald-500/10">
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <h3 className="mt-6 text-xl font-semibold">Bank-Level Security</h3>
                <p className="mt-3 text-muted-foreground">
                  Your data is encrypted and secure. We use Plaid for read-only
                  access to your accounts - we never store credentials.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t py-24">
          <div className="mx-auto max-w-7xl px-4 text-center">
            <div className="mx-auto max-w-2xl rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-12 shadow-2xl shadow-emerald-500/25">
              <h2 className="text-3xl font-bold text-white">
                Ready to take control of your finances?
              </h2>
              <p className="mt-4 text-lg text-emerald-100">
                Join thousands of users who are already saving more with AI-powered insights.
              </p>
              <Button size="lg" asChild className="mt-8 bg-white text-emerald-600 hover:bg-emerald-50">
                <Link href="/signup">
                  Get started for free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground">
          <p>Built with AI for better financial decisions.</p>
        </div>
      </footer>
    </div>
  )
}
