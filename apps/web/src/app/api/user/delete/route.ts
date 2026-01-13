import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getApiUser } from '@/lib/supabase/api'
import { auditLog } from '@/lib/audit'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Use strict rate limit for account deletion (1 per hour)
const DELETE_RATE_LIMIT = {
  ...RATE_LIMITS.strict,
  limit: 1,
  windowSeconds: 3600, // 1 hour
  identifier: 'delete-account',
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limit check
    const rateLimitResponse = await rateLimit(request, DELETE_RATE_LIMIT)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // Authenticate user (support both mobile and web)
    const authHeader = request.headers.get('authorization')
    let supabase
    let user

    if (authHeader?.startsWith('Bearer ')) {
      const result = await getApiUser(request)
      if (result.error || !result.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      supabase = result.supabase
      user = result.user
    } else {
      supabase = await createClient()
      const {
        data: { user: cookieUser },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !cookieUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      user = cookieUser
    }

    // Validate confirmation
    const body = await request.json()
    const { confirmation } = body

    if (confirmation !== 'DELETE') {
      return NextResponse.json(
        { error: 'Invalid confirmation. Please type DELETE to confirm.' },
        { status: 400 }
      )
    }

    // Get request metadata for audit log
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      undefined
    const userAgent = request.headers.get('user-agent') || undefined

    // Log deletion BEFORE deleting (audit_logs uses SET NULL on user_id)
    await auditLog({
      action: 'data.deleted',
      userId: user.id,
      resourceType: 'account',
      resourceId: user.id,
      details: {
        email: user.email,
        reason: 'User requested account deletion (GDPR right to be forgotten)',
        timestamp: new Date().toISOString(),
      },
      ipAddress,
      userAgent,
      severity: 'critical',
    })

    // Cancel Stripe subscription if exists
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .single()

      if (profile?.stripe_customer_id) {
        // Get Stripe client
        const { getStripe } = await import('@/lib/stripe')
        const stripe = getStripe()

        // Cancel all active subscriptions
        const subscriptions = await stripe.subscriptions.list({
          customer: profile.stripe_customer_id,
          status: 'active',
        })

        for (const subscription of subscriptions.data) {
          await stripe.subscriptions.cancel(subscription.id)
        }
      }
    } catch (stripeError) {
      // Log but don't fail - subscription cancellation is optional cleanup
      console.error('Error cancelling Stripe subscription:', stripeError)
    }

    // Delete user from auth.users using service role
    // This cascades to all 25 related tables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase service role configuration')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(user.id)

    if (deleteError) {
      console.error('Error deleting user:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete account. Please contact support.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Your account has been permanently deleted.',
    })
  } catch (error) {
    console.error('Error in account deletion:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
