import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { code } = await request.json()

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Promo code required' }, { status: 400 })
    }

    // Look up the promotion code in Stripe
    const promotionCodes = await stripe.promotionCodes.list({
      code: code.toUpperCase(),
      active: true,
      limit: 1,
      expand: ['data.promotion.coupon'],
    })

    if (promotionCodes.data.length === 0) {
      return NextResponse.json({ error: 'Invalid promo code' }, { status: 400 })
    }

    const promoCode = promotionCodes.data[0]
    const coupon = promoCode.promotion.coupon as Stripe.Coupon | null

    if (!coupon) {
      return NextResponse.json({ error: 'Invalid promo code' }, { status: 400 })
    }

    // Build discount info
    let discountText = ''
    let discountAmount = 0
    let isFree = false

    if (coupon.percent_off) {
      discountAmount = coupon.percent_off
      discountText = `${coupon.percent_off}% off`
      isFree = coupon.percent_off === 100
    } else if (coupon.amount_off) {
      discountAmount = coupon.amount_off / 100 // Convert cents to dollars
      discountText = `$${discountAmount} off`
    }

    // Check duration
    let durationText = ''
    if (coupon.duration === 'forever') {
      durationText = 'forever'
    } else if (coupon.duration === 'once') {
      durationText = 'first payment'
    } else if (coupon.duration === 'repeating' && coupon.duration_in_months) {
      durationText = `for ${coupon.duration_in_months} months`
    }

    return NextResponse.json({
      valid: true,
      promoCodeId: promoCode.id,
      code: promoCode.code,
      discountText,
      durationText,
      isFree,
      percentOff: coupon.percent_off || null,
      amountOff: coupon.amount_off ? coupon.amount_off / 100 : null,
    })
  } catch (error) {
    console.error('Error validating promo code:', error)
    return NextResponse.json({ error: 'Failed to validate promo code' }, { status: 500 })
  }
}
