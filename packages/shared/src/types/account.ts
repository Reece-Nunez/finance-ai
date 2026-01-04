export interface Account {
  id: string
  plaid_account_id: string
  name: string
  official_name: string | null
  institution_name: string | null
  mask: string | null
  type: AccountType
  subtype: string
  current_balance: number
  available_balance: number | null
  hidden?: boolean
  last_synced?: string
}

export type AccountType =
  | 'depository'
  | 'credit'
  | 'loan'
  | 'investment'
  | 'other'

export interface PlaidItem {
  id: string
  institution_id: string
  institution_name: string
  last_synced: string | null
  error?: string | null
}
