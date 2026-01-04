export interface RecurringTransaction {
  id: string
  name: string
  displayName: string
  amount: number
  averageAmount: number
  frequency: RecurringFrequency
  nextDate: string
  lastDate: string
  category: string | null
  accountId: string
  isIncome: boolean
  confidence: ConfidenceLevel
  occurrences: number
  transactions?: Array<{
    id: string
    date: string
    amount: number
  }>
}

export type RecurringFrequency =
  | 'weekly'
  | 'bi-weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface RecurringResponse {
  recurring: RecurringTransaction[]
  yearlySpend: number
  count: number
}
