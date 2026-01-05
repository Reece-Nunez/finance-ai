import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface Transaction {
  id: string
  name: string
  merchant_name: string | null
  display_name: string | null
  amount: number
  date: string
  category: string | null
  plaid_account_id: string
  ignored: boolean
}

// Keywords that indicate a transfer - must be more specific
const TRANSFER_KEYWORDS = [
  'transfer to',
  'transfer from',
  'online transfer',
  'mobile transfer',
  'internal transfer',
  'bank transfer',
  'xfer to',
  'xfer from',
  'from checking',
  'to checking',
  'from savings',
  'to savings',
  'sweep',
  'move money',
]

// Exact match keywords (the whole name must be this)
const TRANSFER_EXACT_KEYWORDS = [
  'transfer',
  'xfer',
]

// Categories that are typically transfers
const TRANSFER_CATEGORIES = [
  'TRANSFER_IN',
  'TRANSFER_OUT',
]

function isLikelyTransfer(tx: Transaction): { isTransfer: boolean; reason: string } {
  const name = (tx.display_name || tx.merchant_name || tx.name || '').toLowerCase().trim()
  const category = (tx.category || '').toUpperCase()

  // Check category first - only exact transfer categories
  if (TRANSFER_CATEGORIES.some(cat => category === cat)) {
    return { isTransfer: true, reason: 'Transfer category' }
  }

  // Check for exact match keywords (name is just "transfer" or "xfer")
  for (const keyword of TRANSFER_EXACT_KEYWORDS) {
    if (name === keyword) {
      return { isTransfer: true, reason: `Exact match "${keyword}"` }
    }
  }

  // Check for transfer phrases in name
  for (const keyword of TRANSFER_KEYWORDS) {
    if (name.includes(keyword)) {
      return { isTransfer: true, reason: `Contains "${keyword}"` }
    }
  }

  return { isTransfer: false, reason: '' }
}

// GET - Detect potential transfers
export async function GET(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const includeIgnored = searchParams.get('include_ignored') === 'true'

  // Get all transactions (not already ignored unless requested)
  let query = supabase
    .from('transactions')
    .select('id, name, merchant_name, display_name, amount, date, category, plaid_account_id, ignored')
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  if (!includeIgnored) {
    query = query.or('ignored.is.null,ignored.eq.false')
  }

  const { data: transactions, error } = await query

  if (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }

  // Detect transfers
  const potentialTransfers: Array<Transaction & { reason: string }> = []
  const matchingPairs: Array<{ debit: Transaction; credit: Transaction; date: string }> = []

  // Group transactions by date for matching pairs
  const byDate: Record<string, Transaction[]> = {}

  for (const tx of transactions || []) {
    const { isTransfer, reason } = isLikelyTransfer(tx)

    if (isTransfer && !tx.ignored) {
      potentialTransfers.push({ ...tx, reason })
    }

    // Group by date for pair matching
    if (!byDate[tx.date]) byDate[tx.date] = []
    byDate[tx.date].push(tx)
  }

  // Find matching pairs (same amount, opposite signs, same day)
  for (const [date, dayTxs] of Object.entries(byDate)) {
    for (let i = 0; i < dayTxs.length; i++) {
      for (let j = i + 1; j < dayTxs.length; j++) {
        const tx1 = dayTxs[i]
        const tx2 = dayTxs[j]

        // Check if amounts match (opposite signs)
        if (Math.abs(tx1.amount + tx2.amount) < 0.01) {
          // This looks like a transfer pair
          const debit = tx1.amount > 0 ? tx1 : tx2
          const credit = tx1.amount < 0 ? tx1 : tx2

          // Only add if not already in potential transfers and not ignored
          if (!debit.ignored && !credit.ignored) {
            matchingPairs.push({ debit, credit, date })

            // Add to potential transfers if not already there
            if (!potentialTransfers.find(t => t.id === debit.id)) {
              potentialTransfers.push({ ...debit, reason: 'Matching transfer pair' })
            }
            if (!potentialTransfers.find(t => t.id === credit.id)) {
              potentialTransfers.push({ ...credit, reason: 'Matching transfer pair' })
            }
          }
        }
      }
    }
  }

  // Get count of already ignored
  const { count: ignoredCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('ignored', true)

  return NextResponse.json({
    potentialTransfers: potentialTransfers.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ),
    matchingPairs,
    totalFound: potentialTransfers.length,
    alreadyIgnored: ignoredCount || 0,
  })
}

// POST - Bulk ignore transactions
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { transactionIds, ignore = true } = body

  if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
    return NextResponse.json({ error: 'transactionIds array required' }, { status: 400 })
  }

  // Update transactions
  const { data, error } = await supabase
    .from('transactions')
    .update({
      ignored: ignore,
      ignored_at: ignore ? new Date().toISOString() : null,
    })
    .eq('user_id', user.id)
    .in('id', transactionIds)
    .select()

  if (error) {
    console.error('Error updating transactions:', error)
    return NextResponse.json({ error: 'Failed to update transactions' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    updated: data?.length || 0,
    ignored: ignore,
  })
}
