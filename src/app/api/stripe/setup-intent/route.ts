import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { getUserSubscription } from '@/lib/subscription'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's subscription info
    const subscription = await getUserSubscription(user.id)

    // Get or create Stripe customer
    let customerId = subscription.stripeCustomerId

    if (!customerId) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name')
        .eq('user_id', user.id)
        .single()

      const customer = await stripe.customers.create({
        email: user.email,
        name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : undefined,
        metadata: {
          supabase_user_id: user.id,
        },
      })

      customerId = customer.id

      // Save customer ID to user profile
      await supabase
        .from('user_profiles')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id)
    }

    // Create SetupIntent to collect payment method
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      metadata: {
        supabase_user_id: user.id,
      },
    })

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId,
    })
  } catch (error) {
    console.error('Error creating setup intent:', error)
    return NextResponse.json({ error: 'Failed to create setup intent' }, { status: 500 })
  }
}
