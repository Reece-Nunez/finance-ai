import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface SplitPart {
  amount: number
  category: string
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { transaction_id, splits } = body as { transaction_id: string; splits: SplitPart[] }

  if (!transaction_id || !splits || !Array.isArray(splits) || splits.length < 2) {
    return NextResponse.json({ error: 'Invalid split data' }, { status: 400 })
  }

  // Fetch the original transaction
  const { data: originalTransaction, error: fetchError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transaction_id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !originalTransaction) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  }

  // Validate that splits add up to original amount
  const totalSplitAmount = splits.reduce((sum, s) => sum + s.amount, 0)
  const originalAmount = Math.abs(originalTransaction.amount)

  if (Math.abs(totalSplitAmount - originalAmount) > 0.01) {
    return NextResponse.json({
      error: 'Split amounts must equal original transaction amount'
    }, { status: 400 })
  }

  // Determine if original was negative (expense) or positive (income)
  const isExpense = originalTransaction.amount > 0

  // Create split transactions
  const splitTransactions = splits.map((split, index) => ({
    user_id: user.id,
    name: `${originalTransaction.name} (Split ${index + 1}/${splits.length})`,
    merchant_name: originalTransaction.merchant_name,
    amount: isExpense ? split.amount : -split.amount,
    date: originalTransaction.date,
    category: split.category || originalTransaction.category,
    pending: false,
    plaid_account_id: originalTransaction.plaid_account_id,
    plaid_transaction_id: null, // Split transactions don't have plaid IDs
    display_name: originalTransaction.display_name
      ? `${originalTransaction.display_name} (Split ${index + 1}/${splits.length})`
      : null,
    is_income: originalTransaction.is_income,
    ignore_type: originalTransaction.ignore_type || 'none',
    parent_transaction_id: transaction_id, // Reference to original
  }))

  // Insert split transactions
  const { data: newTransactions, error: insertError } = await supabase
    .from('transactions')
    .insert(splitTransactions)
    .select()

  if (insertError) {
    console.error('Error creating split transactions:', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Mark original transaction as split (ignore from all reports)
  const { error: updateError } = await supabase
    .from('transactions')
    .update({
      ignore_type: 'all',
      notes: `Split into ${splits.length} transactions`
    })
    .eq('id', transaction_id)
    .eq('user_id', user.id)

  if (updateError) {
    console.error('Error updating original transaction:', updateError)
    // Don't fail - splits were created successfully
  }

  return NextResponse.json({
    success: true,
    transactions: newTransactions,
    message: `Transaction split into ${splits.length} parts`
  })
}
