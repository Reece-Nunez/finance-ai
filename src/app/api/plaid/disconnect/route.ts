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

    const { item_id } = await request.json()

    if (!item_id) {
      return NextResponse.json({ error: 'item_id is required' }, { status: 400 })
    }

    // Get the plaid item to verify ownership and get access token
    const { data: plaidItem, error: fetchError } = await supabase
      .from('plaid_items')
      .select('*')
      .eq('item_id', item_id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !plaidItem) {
      return NextResponse.json({ error: 'Plaid item not found' }, { status: 404 })
    }

    // Try to remove item from Plaid (best effort - may fail if already removed)
    try {
      await plaidClient.itemRemove({
        access_token: plaidItem.access_token,
      })
    } catch (plaidError) {
      console.log('Plaid item removal failed (may already be removed):', plaidError)
      // Continue with local cleanup even if Plaid removal fails
    }

    // Delete all transactions for accounts linked to this item
    const { data: accounts } = await supabase
      .from('accounts')
      .select('plaid_account_id')
      .eq('plaid_item_id', item_id)
      .eq('user_id', user.id)

    if (accounts && accounts.length > 0) {
      const accountIds = accounts.map(a => a.plaid_account_id)

      // Delete transactions
      await supabase
        .from('transactions')
        .delete()
        .in('plaid_account_id', accountIds)
        .eq('user_id', user.id)
    }

    // Delete accounts
    await supabase
      .from('accounts')
      .delete()
      .eq('plaid_item_id', item_id)
      .eq('user_id', user.id)

    // Delete the plaid item
    await supabase
      .from('plaid_items')
      .delete()
      .eq('item_id', item_id)
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error disconnecting account:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect account' },
      { status: 500 }
    )
  }
}
