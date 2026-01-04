'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Shield, Loader2, ArrowLeft, CreditCard, Sparkles } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const PRICES = {
  monthly: {
    id: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID!,
    amount: 9.99,
    period: 'month',
  },
  yearly: {
    id: process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY_PRICE_ID!,
    amount: 79.99,
    period: 'year',
    savings: '33%',
  },
}

const PRO_FEATURES = [
  'AI Financial Advisor Chat',
  'Natural Language Search',
  'Smart AI Categorization',
  'Anomaly Detection Alerts',
  'Cash Flow Predictions',
  'Financial Health Score',
  'Unlimited Bank Accounts',
  'Priority Support',
]

interface PromoInfo {
  promoCodeId: string
  code: string
  discountText: string
  durationText: string
  isFree: boolean
  percentOff: number | null
  amountOff: number | null
}

function CheckoutForm({ priceId, plan }: { priceId: string; plan: 'monthly' | 'yearly' }) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardComplete, setCardComplete] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [promoInfo, setPromoInfo] = useState<PromoInfo | null>(null)

  const validatePromoCode = async () => {
    if (!promoCode.trim()) return

    setPromoLoading(true)
    setPromoError(null)

    try {
      const response = await fetch('/api/stripe/validate-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        setPromoError(data.error || 'Invalid code')
        setPromoInfo(null)
      } else {
        setPromoInfo(data)
        setPromoError(null)
      }
    } catch (err) {
      setPromoError('Failed to validate code')
      setPromoInfo(null)
    } finally {
      setPromoLoading(false)
    }
  }

  const removePromoCode = () => {
    setPromoCode('')
    setPromoInfo(null)
    setPromoError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Create payment method
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      })

      if (pmError) {
        setError(pmError.message || 'Failed to process card')
        setLoading(false)
        return
      }

      // Create subscription
      const response = await fetch('/api/stripe/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          paymentMethodId: paymentMethod.id,
          promoCodeId: promoInfo?.promoCodeId || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create subscription')
        setLoading(false)
        return
      }

      // Success! Redirect to dashboard
      router.push('/dashboard?upgraded=true')
    } catch (err) {
      console.error('Checkout error:', err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const price = plan === 'monthly' ? PRICES.monthly : PRICES.yearly

  // Calculate discounted price
  let finalPrice = price.amount
  if (promoInfo) {
    if (promoInfo.percentOff) {
      finalPrice = price.amount * (1 - promoInfo.percentOff / 100)
    } else if (promoInfo.amountOff) {
      finalPrice = Math.max(0, price.amount - promoInfo.amountOff)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Order Summary */}
      <div className="rounded-lg border bg-slate-50 dark:bg-slate-900/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium">Sterling Pro</span>
          <Badge className="bg-slate-600">{plan === 'yearly' ? 'Best Value' : 'Monthly'}</Badge>
        </div>
        <div className="flex items-baseline gap-1">
          {promoInfo ? (
            <>
              <span className="text-3xl font-bold text-green-600">
                {finalPrice === 0 ? 'FREE' : `$${finalPrice.toFixed(2)}`}
              </span>
              <span className="text-lg text-muted-foreground line-through">${price.amount}</span>
              <span className="text-muted-foreground">/{price.period}</span>
            </>
          ) : (
            <>
              <span className="text-3xl font-bold">${price.amount}</span>
              <span className="text-muted-foreground">/{price.period}</span>
            </>
          )}
        </div>
        {plan === 'yearly' && !promoInfo && (
          <p className="text-sm text-green-600 mt-1">Save {PRICES.yearly.savings} vs monthly</p>
        )}
        {promoInfo && (
          <div className="mt-2 flex items-center gap-2">
            <Badge className="bg-green-600">{promoInfo.discountText} {promoInfo.durationText}</Badge>
            <button
              type="button"
              onClick={removePromoCode}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Remove
            </button>
          </div>
        )}
        <div className="mt-3 pt-3 border-t">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {promoInfo?.isFree ? 'No payment required' : '14-day free trial included'}
          </p>
        </div>
      </div>

      {/* Promo Code */}
      {!promoInfo && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Have a promo code?</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              className="flex-1 h-10 rounded-lg border bg-white dark:bg-slate-950 px-3 text-sm uppercase"
            />
            <Button
              type="button"
              variant="outline"
              onClick={validatePromoCode}
              disabled={promoLoading || !promoCode.trim()}
            >
              {promoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
            </Button>
          </div>
          {promoError && (
            <p className="text-sm text-red-500">{promoError}</p>
          )}
        </div>
      )}

      {/* Card Input */}
      <div className="space-y-3">
        <label className="text-sm font-medium flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Payment Details
        </label>
        <div className="rounded-lg border bg-white dark:bg-slate-950 p-4">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#1e293b',
                  '::placeholder': {
                    color: '#94a3b8',
                  },
                },
                invalid: {
                  color: '#ef4444',
                },
              },
            }}
            onChange={(e) => setCardComplete(e.complete)}
          />
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Shield className="h-3 w-3" />
          Your payment info is encrypted and secure
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        disabled={!stripe || loading || !cardComplete}
        className="w-full h-12 text-base bg-gradient-to-r from-slate-600 to-slate-800 hover:from-slate-700 hover:to-slate-900"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Processing...
          </>
        ) : (
          `Start 14-Day Free Trial`
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        You won&apos;t be charged until your trial ends. Cancel anytime.
      </p>
    </form>
  )
}

function CheckoutContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const plan = (searchParams.get('plan') as 'monthly' | 'yearly') || 'monthly'
  const priceId = plan === 'yearly' ? PRICES.yearly.id : PRICES.monthly.id

  useEffect(() => {
    // Create setup intent when page loads
    fetch('/api/stripe/setup-intent', {
      method: 'POST',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret)
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to create setup intent:', err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Sterling" width={28} height={28} />
            <span className="text-xl font-semibold font-[family-name:var(--font-serif)]">Sterling</span>
          </div>
          <div className="w-32" /> {/* Spacer for centering */}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: Features */}
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold">Upgrade to Sterling Pro</h1>
              <p className="mt-2 text-muted-foreground text-lg">
                Unlock the full power of AI-driven financial insights
              </p>
            </div>

            {/* Plan Toggle */}
            <div className="flex gap-3">
              <Button
                variant={plan === 'monthly' ? 'default' : 'outline'}
                onClick={() => router.push('/checkout?plan=monthly')}
                className={plan === 'monthly' ? 'bg-slate-700' : ''}
              >
                Monthly
              </Button>
              <Button
                variant={plan === 'yearly' ? 'default' : 'outline'}
                onClick={() => router.push('/checkout?plan=yearly')}
                className={plan === 'yearly' ? 'bg-slate-700' : ''}
              >
                Yearly <Badge className="ml-2 bg-green-600">Save 33%</Badge>
              </Button>
            </div>

            {/* Features List */}
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Everything in Pro includes:</h2>
              <div className="grid gap-3">
                {PRO_FEATURES.map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                      <Check className="h-4 w-4 text-slate-600" />
                    </div>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap gap-6 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                256-bit encryption
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                Powered by Stripe
              </div>
            </div>
          </div>

          {/* Right: Payment Form */}
          <div className="lg:sticky lg:top-8">
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle>Complete Your Purchase</CardTitle>
                <CardDescription>
                  Enter your payment details to start your free trial
                </CardDescription>
              </CardHeader>
              <CardContent>
                {clientSecret ? (
                  <Elements
                    stripe={stripePromise}
                    options={{
                      clientSecret,
                      appearance: {
                        theme: 'stripe',
                      },
                    }}
                  >
                    <CheckoutForm priceId={priceId} plan={plan} />
                  </Elements>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    Failed to load payment form. Please refresh the page.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Questions? Contact support@joinsterling.com</p>
        </div>
      </footer>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  )
}
