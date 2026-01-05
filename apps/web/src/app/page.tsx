import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Brain, Shield, PieChart, Zap } from 'lucide-react'
import { SterlingIcon } from '@/components/ui/sterling-icon'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center">
            <span className="text-3xl font-semibold text-slate-800 dark:text-white font-[family-name:var(--font-serif)]">
              Sterling
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild className="bg-gradient-to-r from-slate-500 to-slate-700 hover:from-slate-600 hover:to-slate-800 shadow-lg shadow-slate-500/25">
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="relative overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-50 to-transparent dark:from-slate-950/20" />
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-transparent to-transparent opacity-50 dark:from-slate-800/30" />

          <div className="mx-auto max-w-7xl px-4 py-24 text-center lg:py-32">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1.5 text-sm font-medium text-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
              <SterlingIcon size="sm" />
              AI-Powered Financial Intelligence
            </div>
            <h1 className="mx-auto mt-6 max-w-4xl text-3xl sm:text-5xl font-bold tracking-tight lg:text-6xl">
              All your finances.{' '}
              <span className="bg-gradient-to-r from-slate-600 to-slate-800 bg-clip-text text-transparent">
                One smart view.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Connect your accounts and get instant clarity. AI surfaces the insights
              you need to make smarter decisions—no searching required.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild className="bg-gradient-to-r from-slate-500 to-slate-700 hover:from-slate-600 hover:to-slate-800 shadow-lg shadow-slate-500/25">
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
                <Shield className="h-4 w-4 text-slate-600" />
                Bank-level security
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-slate-600" />
                Real-time sync
              </div>
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-slate-600" />
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
              <div className="group relative overflow-hidden rounded-2xl border bg-card p-5 sm:p-8 transition-all hover:shadow-lg hover:shadow-slate-500/10">
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-500/5 to-slate-600/5 opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 shadow-lg shadow-slate-500/25">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <h3 className="mt-6 text-xl font-semibold">AI-Powered Insights</h3>
                <p className="mt-3 text-muted-foreground">
                  Our AI analyzes your spending patterns and provides actionable
                  recommendations to help you save more money.
                </p>
              </div>
              <div className="group relative overflow-hidden rounded-2xl border bg-card p-5 sm:p-8 transition-all hover:shadow-lg hover:shadow-slate-500/10">
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-500/5 to-slate-600/5 opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 shadow-lg shadow-slate-500/25">
                  <PieChart className="h-6 w-6 text-white" />
                </div>
                <h3 className="mt-6 text-xl font-semibold">Smart Budgeting</h3>
                <p className="mt-3 text-muted-foreground">
                  Set budgets based on AI suggestions and track your progress with
                  real-time updates and intelligent alerts.
                </p>
              </div>
              <div className="group relative overflow-hidden rounded-2xl border bg-card p-5 sm:p-8 transition-all hover:shadow-lg hover:shadow-slate-500/10">
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-500/5 to-slate-600/5 opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 shadow-lg shadow-slate-500/25">
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
            <div className="mx-auto max-w-2xl rounded-3xl bg-gradient-to-br from-slate-600 to-slate-800 p-12 shadow-2xl shadow-slate-500/25">
              <h2 className="text-3xl font-bold text-white">
                Ready to take control of your finances?
              </h2>
              <p className="mt-4 text-lg text-slate-200">
                Join thousands of users who are already saving more with AI-powered insights.
              </p>
              <Button size="lg" asChild className="mt-8 bg-white text-slate-700 hover:bg-slate-50">
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
          <div className="flex justify-center gap-6 mb-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Sterling. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
