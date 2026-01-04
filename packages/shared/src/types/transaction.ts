export interface Transaction {
  id: string
  name: string
  merchant_name: string | null
  display_name: string | null
  amount: number
  date: string
  category: string | null
  ai_category: string | null
  is_income: boolean
  pending: boolean
  plaid_account_id: string
  notes?: string
  ignore_type?: 'none' | 'budget' | 'all'
}

export interface TransactionUpdate {
  id: string
  category?: string
  is_income?: boolean
  ignore_type?: 'none' | 'budget' | 'all'
  notes?: string
  display_name?: string
  date?: string
}
