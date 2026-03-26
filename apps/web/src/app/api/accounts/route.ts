import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('account_id')

  if (accountId) {
    // Fetch specific account by plaid_account_id
    const { data: account, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('plaid_account_id', accountId)
      .single()

    if (error) {
      // Try to get from plaid_items if accounts table doesn't have it
      const { data: plaidItem } = await supabase
        .from('plaid_items')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (plaidItem) {
        return NextResponse.json({
          account: {
            name: plaidItem.institution_name || 'Bank Account',
            official_name: null,
            institution_name: plaidItem.institution_name,
            mask: null,
          }
        })
      }

      return NextResponse.json({ account: null })
    }

    return NextResponse.json({ account })
  }

  // Fetch all accounts
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch plaid_items to get institution names
  const { data: plaidItems } = await supabase
    .from('plaid_items')
    .select('item_id, institution_name')
    .eq('user_id', user.id)

  // Create a map of plaid item_id to institution_name
  const institutionMap = new Map(
    (plaidItems || []).map(item => [item.item_id, item.institution_name])
  )

  // Add institution_name to each account
  const accountsWithInstitution = (accounts || []).map(account => ({
    ...account,
    institution_name: institutionMap.get(account.plaid_item_id) || 'Unknown Institution',
  }))

  return NextResponse.json({ accounts: accountsWithInstitution })
}
