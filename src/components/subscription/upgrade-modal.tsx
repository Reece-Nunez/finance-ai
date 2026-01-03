'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Check,
  Sparkles,
  Brain,
  TrendingUp,
  Shield,
  CreditCard,
  Zap,
  Loader2,
} from 'lucide-react'
import { useSubscription } from '@/hooks/useSubscription'

interface UpgradeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  feature?: string
}

const PRO_FEATURES = [
  { icon: Brain, label: 'AI Financial Chat', description: 'Get personalized advice from your AI advisor' },
  { icon: Sparkles, label: 'Natural Language Search', description: 'Ask questions about your transactions' },
  { icon: Zap, label: 'Smart Categorization', description: 'AI automatically categorizes transactions' },
  { icon: Shield, label: 'Anomaly Detection', description: 'Get alerts for suspicious activity' },
  { icon: TrendingUp, label: 'Cash Flow Predictions', description: '30-day balance forecasts with AI learning' },
  { icon: CreditCard, label: 'Unlimited Bank Accounts', description: 'Connect all your accounts' },
]

export function UpgradeModal({ open, onOpenChange, feature }: UpgradeModalProps) {
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('yearly')
  const [isLoading, setIsLoading] = useState(false)
  const { startCheckout } = useSubscription()

  const handleUpgrade = () => {
    setIsLoading(true)
    startCheckout(plan)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-slate-500 to-slate-700">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <DialogTitle className="text-2xl">Upgrade to Pro</DialogTitle>
          <DialogDescription>
            {feature
              ? `${feature} requires a Pro subscription`
              : 'Unlock all AI-powered features'}
          </DialogDescription>
        </DialogHeader>

        {/* Plan Toggle */}
        <div className="flex justify-center gap-2 my-4">
          <button
            onClick={() => setPlan('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              plan === 'monthly'
                ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setPlan('yearly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              plan === 'yearly'
                ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Yearly
            <Badge variant="secondary" className="text-xs bg-slate-600 text-white">
              Save 33%
            </Badge>
          </button>
        </div>

        {/* Pricing */}
        <div className="text-center py-4">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold">
              ${plan === 'monthly' ? '9.99' : '79.99'}
            </span>
            <span className="text-muted-foreground">
              /{plan === 'monthly' ? 'month' : 'year'}
            </span>
          </div>
          {plan === 'yearly' && (
            <p className="text-sm text-muted-foreground mt-1">
              Just $6.67/month, billed annually
            </p>
          )}
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 font-medium">
            14-day free trial included
          </p>
        </div>

        {/* Features */}
        <div className="grid gap-3 py-4">
          {PRO_FEATURES.map((feature) => (
            <div key={feature.label} className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <Check className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium">{feature.label}</p>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Button
          onClick={handleUpgrade}
          disabled={isLoading}
          className="w-full h-12 text-base bg-gradient-to-r from-slate-500 to-slate-700 hover:from-slate-600 hover:to-slate-800"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Start Free Trial
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Cancel anytime. No questions asked.
        </p>
      </DialogContent>
    </Dialog>
  )
}
