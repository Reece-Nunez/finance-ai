import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { stripe, STRIPE_PRICES } from '@/lib/stripe'
import { getUserSubscription, updateSubscription } from '@/lib/subscription'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { priceId, paymentMethodId, promoCodeId } = await request.json()

    // Validate price ID
    if (priceId !== STRIPE_PRICES.PRO_MONTHLY && priceId !== STRIPE_PRICES.PRO_YEARLY) {
      return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 })
    }

    if (!paymentMethodId) {
      return NextResponse.json({ error: 'Payment method required' }, { status: 400 })
    }

    // Get user's subscription info
    const subscription = await getUserSubscription(user.id)

    if (!subscription.stripeCustomerId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 400 })
    }

    // Attach payment method to customer if not already attached
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: subscription.stripeCustomerId,
      })
    } catch (err: unknown) {
      // Payment method might already be attached
      const error = err as { code?: string }
      if (error.code !== 'resource_already_exists') {
        throw err
      }
    }

    // Set as default payment method
    await stripe.customers.update(subscription.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    })

    // Create the subscription
    const stripeSubscription = await stripe.subscriptions.create({
      customer: subscription.stripeCustomerId!,
      items: [{ price: priceId }],
      trial_period_days: 14,
      default_payment_method: paymentMethodId,
      metadata: {
        supabase_user_id: user.id,
      },
      expand: ['latest_invoice'],
      ...(promoCodeId && { promotion_code: promoCodeId }),
    })

    // Get period end from the latest invoice
    const invoice = stripeSubscription.latest_invoice as Stripe.Invoice | null
    const periodEnd = invoice?.period_end ?? Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60

    // Update user's subscription in database
    await updateSubscription(user.id, {
      tier: 'pro',
      status: stripeSubscription.status === 'trialing' ? 'trialing' : 'active',
      stripeSubscriptionId: stripeSubscription.id,
      trialEndsAt: stripeSubscription.trial_end
        ? new Date(stripeSubscription.trial_end * 1000)
        : null,
      currentPeriodEnd: new Date(periodEnd * 1000),
    })

    return NextResponse.json({
      subscriptionId: stripeSubscription.id,
      status: stripeSubscription.status,
      trialEnd: stripeSubscription.trial_end,
    })
  } catch (error) {
    console.error('Error creating subscription:', error)
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
  }
}
