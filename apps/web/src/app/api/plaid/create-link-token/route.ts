import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { plaidClient } from '@/lib/plaid'
import { Products, CountryCode, PlaidError } from 'plaid'

export async function POST() {
  try {
    // Debug: Check if env vars are available
    console.log('PLAID_ENV:', process.env.PLAID_ENV)
    console.log('PLAID_CLIENT_ID exists:', !!process.env.PLAID_CLIENT_ID)
    console.log('PLAID_SECRET exists:', !!process.env.PLAID_SECRET)

    if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
      console.error('Missing Plaid credentials in environment')
      return NextResponse.json(
        { error: 'Plaid credentials not configured', code: 'MISSING_ENV' },
        { status: 500 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: user.id,
      },
      client_name: 'Sterling',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    })

    return NextResponse.json({ link_token: response.data.link_token })
  } catch (error) {
    console.error('Error creating link token:', error)

    // Extract Plaid-specific error details
    const plaidError = error as { response?: { data?: PlaidError } }
    const errorMessage = plaidError.response?.data?.error_message || 'Failed to create link token'
    const errorCode = plaidError.response?.data?.error_code || 'UNKNOWN'

    console.error('Plaid error details:', {
      code: errorCode,
      message: errorMessage,
      type: plaidError.response?.data?.error_type,
    })

    return NextResponse.json(
      { error: errorMessage, code: errorCode },
      { status: 500 }
    )
  }
}
