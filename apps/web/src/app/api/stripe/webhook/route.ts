import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Use service role for webhook handling (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutComplete(session)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdate(subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(invoice)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.supabase_user_id
  if (!userId) {
    console.error('No user ID in checkout session metadata')
    return
  }

  // Subscription details will be updated by subscription.created/updated event
  console.log(`Checkout completed for user ${userId}`)
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.supabase_user_id

  if (!userId) {
    // Try to find user by customer ID
    const customerId = subscription.customer as string
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .single()

    if (!profile) {
      console.error('Could not find user for subscription:', subscription.id)
      return
    }

    await updateUserSubscription(profile.user_id, subscription)
  } else {
    await updateUserSubscription(userId, subscription)
  }
}

async function updateUserSubscription(userId: string, subscription: Stripe.Subscription) {
  const status = subscription.status
  const tier = status === 'active' || status === 'trialing' ? 'pro' : 'free'

  // Access properties using bracket notation with type assertion for compatibility
  const subAny = subscription as unknown as Record<string, unknown>
  const currentPeriodEnd = subAny.current_period_end as number | undefined
  const trialEnd = subAny.trial_end as number | null | undefined

  const updates: Record<string, unknown> = {
    subscription_tier: tier,
    subscription_status: status,
    stripe_subscription_id: subscription.id,
  }

  if (currentPeriodEnd) {
    updates.current_period_end = new Date(currentPeriodEnd * 1000).toISOString()
  }

  if (trialEnd) {
    updates.trial_ends_at = new Date(trialEnd * 1000).toISOString()
  }

  const { error } = await supabaseAdmin
    .from('user_profiles')
    .update(updates)
    .eq('user_id', userId)

  if (error) {
    console.error('Error updating user subscription:', error)
  } else {
    console.log(`Updated subscription for user ${userId}: tier=${tier}, status=${status}`)
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!profile) {
    console.error('Could not find user for deleted subscription')
    return
  }

  // Downgrade to free tier
  await supabaseAdmin
    .from('user_profiles')
    .update({
      subscription_tier: 'free',
      subscription_status: 'canceled',
      stripe_subscription_id: null,
      current_period_end: null,
      trial_ends_at: null,
    })
    .eq('user_id', profile.user_id)

  console.log(`Subscription canceled for user ${profile.user_id}`)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!profile) {
    console.error('Could not find user for failed payment')
    return
  }

  // Mark subscription as past_due
  await supabaseAdmin
    .from('user_profiles')
    .update({ subscription_status: 'past_due' })
    .eq('user_id', profile.user_id)

  console.log(`Payment failed for user ${profile.user_id}`)
}
