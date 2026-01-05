import { SupabaseClient } from '@supabase/supabase-js'
import { anthropic } from '@/lib/ai'

const CATEGORIZATION_PROMPT = `You are a financial transaction categorizer and name cleaner. Given a list of transactions and the user's accounts, categorize each transaction and clean up messy transaction names.

## Categories:
- FOOD_AND_DRINK (restaurants, groceries, coffee shops)
- TRANSPORTATION (gas, uber, parking, car maintenance)
- SHOPPING (retail, online shopping, clothing)
- ENTERTAINMENT (movies, games, streaming services, concerts)
- BILLS_AND_UTILITIES (electric, water, internet, phone)
- HEALTH (medical, pharmacy, gym, fitness)
- TRAVEL (hotels, flights, vacation)
- INCOME (salary, deposits, refunds)
- TRANSFER (bank transfers, payments between accounts)
- SUBSCRIPTIONS (recurring services, memberships)
- PERSONAL_CARE (haircut, spa, beauty)
- EDUCATION (courses, books, tuition)
- HOME (furniture, home improvement, rent, mortgage)
- PETS (pet food, vet, pet supplies)
- GIFTS_AND_DONATIONS (charity, gifts)
- FEES (bank fees, ATM fees, late fees)
- OTHER (anything that doesn't fit above)

## CRITICAL Name Cleanup Rules:

**IMPORTANT: Be CONSERVATIVE with name changes. Only change names when you are 100% certain about the merchant.**

1. **NEVER guess or invent merchant names**: If the transaction says "Bill Paid-FIRST NATIONAL BANK", do NOT rename it to an unrelated company. Keep bank/payment processor names when they're the primary entity.

2. **Bill Payments**: For transactions like "Bill Paid-[BANK NAME]", keep the bank name:
   - "Bill Paid-FIRST NATIONAL BANK OF OKLAHOMA" → "First National Bank Payment" (NOT "Amtrak" or other unrelated names)
   - "ONLINE PAYMENT CHASE" → "Chase Payment"

3. **Account-Aware Naming**: When a transaction name is generic but involves a specific account, use the account's actual name:
   - "AUTOMATIC PAYMENT" from account "Chase Sapphire (4567)" → "Chase Sapphire Auto Payment"
   - "PAYMENT THANK YOU" to credit card "Discover It (1234)" → "Discover It Payment"

4. **Credit Card Payment Matching**: If the transaction name contains digits that match an account's last 4 digits (mask), use the actual account name:
   - "CREDIT CARD 3333 PAYMENT" + account with mask "3333" → "[Account Name] Payment"

5. **Clear Merchant Cleanup**: Only clean up when the real merchant is OBVIOUS:
   - "AMZN*123XY" → "Amazon" (clear Amazon reference)
   - "NETFLIX.COM" → "Netflix" (clear Netflix reference)
   - "SQ *JOES COFFEE" → "Joe's Coffee" (clear merchant after Square prefix)
   - "PAYPAL *SPOTIFY" → "Spotify" (clear merchant after PayPal prefix)

6. **When in Doubt, Don't Change**: If you're not 100% sure what merchant this is, leave clean_name as null. A cryptic original name is better than a wrong name.

7. **Local/Unknown Businesses**: For local businesses you don't recognize, just clean up formatting but don't guess:
   - "DAYLIGHT DONUT PONCA" → "Daylight Donut Ponca" (just fix capitalization)
   - "JOES GARAGE LLC" → "Joe's Garage" (just clean formatting)

Respond with a JSON array of objects with these fields:
- "transaction_id": the ID of the transaction
- "category": the assigned category
- "confidence": your confidence level 0-100
- "clean_name": cleaned up transaction name, OR null if you're not confident about improving it

No explanations, just the JSON array.`

interface AIPreferences {
  auto_categorize?: boolean
  categorize_confidence_threshold?: number
  review_low_confidence?: boolean
  merchant_cleanup?: boolean
}

interface CategorizedItem {
  transaction_id: string
  original_name: string
  amount: number
  date: string
  new_category: string
  new_name?: string
  confidence: number
}

interface SkippedItem {
  transaction_id: string
  original_name: string
  current_category?: string
  amount: number
  date: string
  suggested_category: string
  suggested_name?: string
  confidence: number
  reason: string
}

export interface CategorizeResult {
  categorized: number
  needs_review: number
  found?: number
  skipped?: boolean
  categorized_items?: CategorizedItem[]
  skipped_items?: SkippedItem[]
  message?: string
}

export async function categorizeTransactions(
  supabase: SupabaseClient,
  userId: string,
  transactionIds?: string[],
  options?: { force?: boolean; batchSize?: number; processAll?: boolean }
): Promise<CategorizeResult> {
  // Fetch user's AI preferences
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('ai_preferences')
    .eq('user_id', userId)
    .maybeSingle()

  const aiPrefs: AIPreferences = profile?.ai_preferences || {}

  // Check if auto-categorization is enabled
  if (aiPrefs.auto_categorize === false) {
    return {
      categorized: 0,
      needs_review: 0,
      skipped: true,
      message: 'Auto-categorization is disabled in your AI preferences'
    }
  }

  // Get transactions to categorize
  let query = supabase
    .from('transactions')
    .select('id, plaid_transaction_id, plaid_account_id, name, merchant_name, amount, date, category, display_name, ai_category')
    .eq('user_id', userId)

  const batchSize = options?.batchSize || 25

  if (transactionIds && transactionIds.length > 0) {
    query = query.in('id', transactionIds)
  } else if (options?.processAll) {
    // Process ALL uncategorized transactions (no limit, for batch processing)
    query = query.or('ai_category.is.null,display_name.is.null').order('date', { ascending: false })
  } else if (options?.force) {
    // Force mode: get recent transactions regardless of AI category status
    query = query.order('date', { ascending: false }).limit(batchSize)
  } else {
    // Normal mode: get transactions that haven't been AI-categorized OR don't have a display name yet
    query = query.or('ai_category.is.null,display_name.is.null').limit(batchSize)
  }

  const { data: transactions, error } = await query

  if (error) {
    console.error('Error fetching transactions for categorization:', error)
    return { categorized: 0, needs_review: 0, message: 'Error fetching transactions' }
  }

  if (!transactions?.length) {
    return { categorized: 0, needs_review: 0, message: 'No transactions found to categorize' }
  }

  console.log(`Found ${transactions.length} transactions to categorize`)

  // Fetch user's accounts for smart name matching
  const { data: accounts } = await supabase
    .from('accounts')
    .select('plaid_account_id, name, official_name, type, subtype, mask')
    .eq('user_id', userId)

  // Create account lookup by plaid_account_id
  const accountLookup = new Map(
    (accounts || []).map(acc => [acc.plaid_account_id, acc])
  )

  // Format transactions for AI with source account info
  const txList = transactions.map((tx) => {
    const sourceAccount = accountLookup.get(tx.plaid_account_id)
    return {
      id: tx.id,
      name: tx.merchant_name || tx.name,
      amount: tx.amount,
      current_category: tx.category,
      source_account: sourceAccount ? {
        name: sourceAccount.name,
        official_name: sourceAccount.official_name,
        type: sourceAccount.type,
        subtype: sourceAccount.subtype,
        mask: sourceAccount.mask,
      } : null,
    }
  })

  // Format accounts list for AI context
  const accountsList = (accounts || []).map(acc => ({
    name: acc.name,
    official_name: acc.official_name,
    type: acc.type,
    subtype: acc.subtype,
    mask: acc.mask,
  }))

  // Build AI message with account context
  const aiMessage = `## User's Accounts:
${JSON.stringify(accountsList, null, 2)}

## Transactions to Categorize:
${JSON.stringify(txList, null, 2)}

Please categorize these transactions and clean up the names using the account context provided. Each transaction includes its source_account which tells you which account it came from.`

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022', // Using Haiku for cost efficiency (~90% cheaper than Sonnet)
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: aiMessage,
      },
    ],
    system: CATEGORIZATION_PROMPT,
  })

  const responseText =
    response.content[0].type === 'text' ? response.content[0].text : ''

  console.log('AI response length:', responseText.length)

  // Parse the JSON response
  let categories: Array<{
    transaction_id: string
    category: string
    confidence: number
    clean_name?: string
  }> = []

  try {
    // Remove markdown code blocks if present
    let cleanedResponse = responseText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()

    // Find JSON array in response
    let jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/)

    // If no complete array found, try to repair truncated JSON
    if (!jsonMatch && cleanedResponse.startsWith('[')) {
      console.log('Attempting to repair truncated JSON response...')
      // Find the last complete object (ends with })
      const lastCompleteObject = cleanedResponse.lastIndexOf('}')
      if (lastCompleteObject > 0) {
        // Truncate at last complete object and close the array
        let repairedJson = cleanedResponse.slice(0, lastCompleteObject + 1)
        // Remove trailing comma if present
        repairedJson = repairedJson.replace(/,\s*$/, '')
        repairedJson += ']'
        try {
          categories = JSON.parse(repairedJson)
          console.log(`Repaired and parsed ${categories.length} categories from truncated AI response`)
        } catch {
          console.error('Failed to repair truncated JSON')
        }
      }
    } else if (jsonMatch) {
      categories = JSON.parse(jsonMatch[0])
      console.log(`Parsed ${categories.length} categories from AI response`)
    }

    if (categories.length === 0 && !jsonMatch) {
      console.error('No JSON array found in AI response:', cleanedResponse.slice(0, 500))
      return { categorized: 0, needs_review: 0, found: transactions.length, message: 'AI response did not contain valid JSON' }
    }
  } catch (parseError) {
    console.error('Error parsing AI response:', parseError)
    console.error('Response text:', responseText.slice(0, 500))
    return { categorized: 0, needs_review: 0, found: transactions.length, message: 'Failed to parse AI response' }
  }

  if (categories.length === 0) {
    return { categorized: 0, needs_review: 0, found: transactions.length, message: 'AI returned empty category list' }
  }

  // Get confidence threshold from preferences (default 80)
  const confidenceThreshold = aiPrefs.categorize_confidence_threshold ?? 80
  const merchantCleanup = aiPrefs.merchant_cleanup !== false
  const reviewLowConfidence = aiPrefs.review_low_confidence !== false

  // Create a map of transaction IDs to full transaction details for reporting
  const txLookup = new Map(
    transactions.map(tx => [tx.id, {
      name: tx.merchant_name || tx.name,
      category: tx.category,
      amount: tx.amount,
      date: tx.date,
    }])
  )

  // Update transactions with AI categories
  let updated = 0
  let needsReview = 0
  const categorizedItems: CategorizedItem[] = []
  const skippedItems: SkippedItem[] = []

  for (const cat of categories) {
    const confidence = cat.confidence ?? 100
    const txDetails = txLookup.get(cat.transaction_id)

    // Build update object
    const updateData: Record<string, unknown> = {}

    // Only auto-apply if confidence meets threshold
    if (confidence >= confidenceThreshold) {
      updateData.ai_category = cat.category
      updateData.ai_confidence = confidence
    } else {
      // Track as skipped due to low confidence
      skippedItems.push({
        transaction_id: cat.transaction_id,
        original_name: txDetails?.name || 'Unknown',
        current_category: txDetails?.category,
        amount: txDetails?.amount || 0,
        date: txDetails?.date || '',
        suggested_category: cat.category,
        suggested_name: cat.clean_name,
        confidence,
        reason: `Confidence ${confidence}% below threshold ${confidenceThreshold}%`
      })

      if (reviewLowConfidence) {
        // Mark for review but don't auto-apply
        updateData.ai_suggested_category = cat.category
        updateData.ai_confidence = confidence
        updateData.needs_review = true
        needsReview++
      }
    }

    // Apply merchant cleanup if enabled and clean name provided
    if (merchantCleanup && cat.clean_name) {
      updateData.display_name = cat.clean_name
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', cat.transaction_id)
        .eq('user_id', userId)

      if (updateError) {
        console.error(`Failed to update transaction ${cat.transaction_id}:`, updateError.message)
        // Try updating just the core fields if the new columns don't exist
        if (updateError.message.includes('column')) {
          const fallbackData: Record<string, unknown> = {}
          if (confidence >= confidenceThreshold) {
            fallbackData.ai_category = cat.category
          }
          const nameWasApplied = merchantCleanup && cat.clean_name
          if (nameWasApplied) {
            fallbackData.display_name = cat.clean_name
          }
          if (Object.keys(fallbackData).length > 0) {
            const { error: fallbackError } = await supabase
              .from('transactions')
              .update(fallbackData)
              .eq('id', cat.transaction_id)
              .eq('user_id', userId)
            if (!fallbackError && confidence >= confidenceThreshold) {
              updated++
              // Track successfully categorized item - only include new_name if it was actually applied
              categorizedItems.push({
                transaction_id: cat.transaction_id,
                original_name: txDetails?.name || 'Unknown',
                amount: txDetails?.amount || 0,
                date: txDetails?.date || '',
                new_category: cat.category,
                new_name: nameWasApplied ? cat.clean_name : undefined,
                confidence,
              })
            }
          }
        }
      } else if (confidence >= confidenceThreshold) {
        updated++
        // Track successfully categorized item - only include new_name if it was actually applied
        const nameWasApplied = merchantCleanup && cat.clean_name
        categorizedItems.push({
          transaction_id: cat.transaction_id,
          original_name: txDetails?.name || 'Unknown',
          amount: txDetails?.amount || 0,
          date: txDetails?.date || '',
          new_category: cat.category,
          new_name: nameWasApplied ? cat.clean_name : undefined,
          confidence,
        })
      }
    }
  }

  console.log(`Categorization complete: ${updated} updated, ${needsReview} need review, ${skippedItems.length} skipped out of ${categories.length} processed`)

  return {
    categorized: updated,
    needs_review: needsReview,
    found: transactions.length,
    categorized_items: categorizedItems.length > 0 ? categorizedItems : undefined,
    skipped_items: skippedItems.length > 0 ? skippedItems : undefined,
  }
}

/**
 * Process ALL uncategorized transactions in batches
 * This is for the "Categorize All" button in settings
 */
export async function categorizeAllTransactions(
  supabase: SupabaseClient,
  userId: string,
  onProgress?: (processed: number, total: number) => void
): Promise<CategorizeResult> {
  const BATCH_SIZE = 25

  // First, count total uncategorized transactions
  const { count } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .or('ai_category.is.null,display_name.is.null')

  const totalUncategorized = count || 0

  if (totalUncategorized === 0) {
    return {
      categorized: 0,
      needs_review: 0,
      message: 'All transactions are already categorized'
    }
  }

  console.log(`Starting batch categorization of ${totalUncategorized} transactions`)

  let totalCategorized = 0
  let totalNeedsReview = 0
  let processed = 0
  const allCategorizedItems: CategorizedItem[] = []
  const allSkippedItems: SkippedItem[] = []

  // Process in batches
  while (processed < totalUncategorized) {
    // Get next batch of uncategorized transactions
    const { data: batchIds } = await supabase
      .from('transactions')
      .select('id')
      .eq('user_id', userId)
      .or('ai_category.is.null,display_name.is.null')
      .order('date', { ascending: false })
      .limit(BATCH_SIZE)

    if (!batchIds || batchIds.length === 0) {
      break // No more transactions to process
    }

    const ids = batchIds.map(t => t.id)

    // Categorize this batch
    let batchCategorized = 0
    let batchNeedsReview = 0
    try {
      const result = await categorizeTransactions(supabase, userId, ids)

      batchCategorized = result.categorized
      batchNeedsReview = result.needs_review
      totalCategorized += result.categorized
      totalNeedsReview += result.needs_review

      if (result.categorized_items) {
        allCategorizedItems.push(...result.categorized_items)
      }
      if (result.skipped_items) {
        allSkippedItems.push(...result.skipped_items)
      }
    } catch (batchError) {
      console.error(`Error processing batch:`, batchError)
      // Continue with next batch even if this one fails
    }

    processed += batchIds.length

    // Report progress
    if (onProgress) {
      onProgress(processed, totalUncategorized)
    }

    console.log(`Batch progress: ${processed}/${totalUncategorized} (${totalCategorized} categorized)`)

    // Safety: if we've processed a batch but nothing changed, stop to prevent infinite loop
    if (batchCategorized === 0 && batchNeedsReview === 0 && batchIds.length === BATCH_SIZE) {
      console.log('No progress made in batch, stopping to prevent infinite loop')
      break
    }
  }

  return {
    categorized: totalCategorized,
    needs_review: totalNeedsReview,
    found: processed,
    categorized_items: allCategorizedItems.length > 0 ? allCategorizedItems : undefined,
    skipped_items: allSkippedItems.length > 0 ? allSkippedItems : undefined,
    message: `Processed ${processed} transactions in batches`
  }
}
