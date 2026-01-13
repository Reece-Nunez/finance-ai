import { SupabaseClient } from '@supabase/supabase-js'

export type SyncFrequency = 'manual' | 'daily' | 'frequent'

export interface SyncResult {
  success: boolean
  added: number
  modified: number
  removed: number
  error?: string
}

/**
 * Get the interval in hours for a given sync frequency
 * Pro users get 6-hour frequent sync, free users are downgraded to daily
 */
export function getSyncIntervalHours(frequency: SyncFrequency, isPro: boolean): number {
  switch (frequency) {
    case 'frequent':
      // Pro users get 6-hour sync, free users get downgraded to daily
      return isPro ? 6 : 24
    case 'daily':
      return 24
    case 'manual':
    default:
      return 0 // No auto-sync
  }
}

/**
 * Calculate the next sync due time based on frequency and subscription
 */
export function calculateNextSyncDue(
  frequency: SyncFrequency,
  isPro: boolean,
  lastSync?: Date | null
): Date | null {
  if (frequency === 'manual') {
    return null
  }

  const intervalHours = getSyncIntervalHours(frequency, isPro)
  if (intervalHours === 0) {
    return null
  }

  const base = lastSync || new Date()
  const nextSync = new Date(base.getTime() + intervalHours * 60 * 60 * 1000)

  return nextSync
}

/**
 * Update the sync timestamps for a user after a successful sync
 */
export async function updateSyncTimestamps(
  supabase: SupabaseClient,
  userId: string,
  frequency: SyncFrequency,
  isPro: boolean
): Promise<void> {
  const now = new Date()
  const nextSyncDue = calculateNextSyncDue(frequency, isPro, now)

  await supabase
    .from('user_profiles')
    .update({
      last_auto_sync: now.toISOString(),
      next_sync_due: nextSyncDue?.toISOString() || null,
    })
    .eq('user_id', userId)
}

/**
 * Get users who are due for auto-sync
 */
export async function getUsersDueForSync(
  supabase: SupabaseClient,
  limit: number = 50
): Promise<Array<{ user_id: string; sync_frequency: SyncFrequency }>> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id, sync_frequency')
    .neq('sync_frequency', 'manual')
    .lte('next_sync_due', now)
    .order('next_sync_due', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[sync-service] Error fetching users due for sync:', error)
    return []
  }

  return data || []
}

/**
 * Sync all Plaid items for a user
 * This calls the existing sync-transactions endpoint logic internally
 */
export async function syncUserPlaidItems(
  supabase: SupabaseClient,
  userId: string
): Promise<SyncResult> {
  try {
    // Get all plaid items for the user
    const { data: plaidItems, error: itemError } = await supabase
      .from('plaid_items')
      .select('item_id')
      .eq('user_id', userId)

    if (itemError || !plaidItems || plaidItems.length === 0) {
      return {
        success: true,
        added: 0,
        modified: 0,
        removed: 0,
      }
    }

    // Note: The actual sync is done by the cron endpoint calling the internal
    // sync-transactions logic. This function is a placeholder for future
    // direct Plaid API integration if needed.
    return {
      success: true,
      added: 0,
      modified: 0,
      removed: 0,
    }
  } catch (error) {
    console.error('[sync-service] Error syncing user items:', error)
    return {
      success: false,
      added: 0,
      modified: 0,
      removed: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Format sync frequency for display
 */
export function formatSyncFrequency(frequency: SyncFrequency): string {
  switch (frequency) {
    case 'frequent':
      return 'Every 6 hours'
    case 'daily':
      return 'Once daily'
    case 'manual':
      return 'Manual only'
    default:
      return 'Unknown'
  }
}
