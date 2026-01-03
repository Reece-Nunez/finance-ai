'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Crown,
  CreditCard,
  Check,
  Sparkles,
  Loader2,
  ExternalLink,
  Calendar,
} from 'lucide-react'
import { useSubscription } from '@/hooks/useSubscription'
import { UpgradeModal } from '@/components/subscription/upgrade-modal'
import { toast } from 'sonner'
import { formatDate } from '@/lib/format'

export default function BillingPage() {
  const searchParams = useSearchParams()
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [isLoadingPortal, setIsLoadingPortal] = useState(false)

  const {
    tier,
    status,
    isPro,
    isTrialing,
    trialEndsAt,
    currentPeriodEnd,
    isLoading,
    openPortal,
    refresh,
  } = useSubscription()

  // Handle success/cancel from Stripe checkout
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Subscription activated!', {
        description: 'Welcome to Sterling Pro. Your 14-day trial has started.',
      })
      refresh()
    } else if (searchParams.get('canceled') === 'true') {
      toast.info('Checkout canceled', {
        description: 'No charges were made. Feel free to upgrade anytime.',
      })
    }
  }, [searchParams, refresh])

  const handleManageBilling = async () => {
    setIsLoadingPortal(true)
    try {
      await openPortal()
    } catch (error) {
      toast.error('Failed to open billing portal')
      setIsLoadingPortal(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and billing information
        </p>
      </div>

      {/* Current Plan Card */}
      <div className="rounded-xl border bg-card p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">
                {isPro ? 'Pro Plan' : 'Free Plan'}
              </h2>
              {isPro && (
                <Badge
                  variant="secondary"
                  className="bg-gradient-to-r from-slate-500 to-slate-700 text-white border-0"
                >
                  <Crown className="h-3 w-3 mr-1" />
                  {isTrialing ? 'Trial' : 'Active'}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              {isPro
                ? 'Full access to all AI-powered features'
                : 'Basic features with limited AI capabilities'}
            </p>
          </div>
          <div className="text-right">
            {isPro ? (
              <p className="text-2xl font-bold">$9.99<span className="text-base font-normal text-muted-foreground">/mo</span></p>
            ) : (
              <p className="text-2xl font-bold">$0<span className="text-base font-normal text-muted-foreground">/mo</span></p>
            )}
          </div>
        </div>

        {/* Status Info */}
        {isPro && (
          <div className="mt-4 pt-4 border-t space-y-2">
            {isTrialing && trialEndsAt && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Trial ends: <strong>{formatDate(trialEndsAt)}</strong></span>
              </div>
            )}
            {currentPeriodEnd && !isTrialing && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Next billing: <strong>{formatDate(currentPeriodEnd)}</strong></span>
              </div>
            )}
            {status === 'past_due' && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <CreditCard className="h-4 w-4" />
                <span>Payment failed - please update your payment method</span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          {isPro ? (
            <Button
              variant="outline"
              onClick={handleManageBilling}
              disabled={isLoadingPortal}
            >
              {isLoadingPortal ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Manage Subscription
            </Button>
          ) : (
            <Button
              onClick={() => setShowUpgrade(true)}
              className="bg-gradient-to-r from-slate-500 to-slate-700 hover:from-slate-600 hover:to-slate-800"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Upgrade to Pro
            </Button>
          )}
        </div>
      </div>

      {/* Features Comparison */}
      <div className="rounded-xl border bg-card p-6">
        <h3 className="font-semibold mb-4">Plan Features</h3>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Free Features */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Free</h4>
            <ul className="space-y-2">
              {[
                'Dashboard overview',
                'Manual transaction categorization',
                '1 bank account',
                'Basic budgets',
                'Transaction history',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-muted-foreground" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro Features */}
          <div>
            <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">Pro</h4>
            <ul className="space-y-2">
              {[
                'Everything in Free',
                'AI Financial Chat',
                'Natural Language Search',
                'Smart AI Categorization',
                'Anomaly Detection',
                'Cash Flow Predictions',
                'Financial Health Score',
                'Unlimited bank accounts',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-slate-600" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
    </div>
  )
}
