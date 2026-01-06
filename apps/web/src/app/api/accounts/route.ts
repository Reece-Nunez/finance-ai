import { createClient } from '@/lib/supabase/server'
import { getApiUser } from '@/lib/supabase/api'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Check for Bearer token first (mobile), then fall back to cookies (web)
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
    const { data: { user: cookieUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !cookieUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    user = cookieUser
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
