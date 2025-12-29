import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { plaidClient } from '@/lib/plaid'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { public_token, metadata } = await request.json()

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    })

    const accessToken = exchangeResponse.data.access_token
    const itemId = exchangeResponse.data.item_id

    // Store the Plaid item in the database
    const { error: insertError } = await supabase.from('plaid_items').insert({
      user_id: user.id,
      access_token: accessToken,
      item_id: itemId,
      institution_id: metadata?.institution?.institution_id || null,
      institution_name: metadata?.institution?.name || 'Unknown Institution',
      status: 'active',
    })

    if (insertError) {
      console.error('Error storing plaid item:', insertError)
      return NextResponse.json(
        { error: 'Failed to store connection' },
        { status: 500 }
      )
    }

    // Fetch and store accounts
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    })

    const accounts = accountsResponse.data.accounts.map((account) => ({
      user_id: user.id,
      plaid_item_id: itemId,
      plaid_account_id: account.account_id,
      name: account.name,
      official_name: account.official_name,
      type: account.type,
      subtype: account.subtype,
      mask: account.mask,
      current_balance: account.balances.current,
      available_balance: account.balances.available,
      iso_currency_code: account.balances.iso_currency_code,
    }))

    const { error: accountsError } = await supabase
      .from('accounts')
      .insert(accounts)

    if (accountsError) {
      console.error('Error storing accounts:', accountsError)
    }

    return NextResponse.json({ success: true, item_id: itemId })
  } catch (error) {
    console.error('Error exchanging token:', error)
    return NextResponse.json(
      { error: 'Failed to exchange token' },
      { status: 500 }
    )
  }
}
