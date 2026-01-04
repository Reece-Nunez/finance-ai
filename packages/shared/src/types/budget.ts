export interface Budget {
  id: string
  user_id: string
  category: string
  amount: number
  period: 'monthly' | 'weekly'
  created_at?: string
  updated_at?: string
}

export interface BudgetAnalytics {
  period: {
    month: number
    year: number
    daysLeft: number
    daysPassed: number
    daysInMonth: number
    startDate: string
    endDate: string
  }
  summary: {
    totalBudgeted: number
    totalSpent: number
    totalRemaining: number
    totalPercentUsed: number
    lastMonthTotal: number
    monthOverMonthChange: number
    dailyAverage: number
    projectedTotal: number
    projectedRemaining: number
    isOnTrack: boolean
    trackingDifference: number
    budgetedCategoriesCount: number
  }
  categories: BudgetCategory[]
  alerts: BudgetAlert[]
  suggestedCategories: SuggestedBudget[]
}

export interface BudgetCategory {
  category: string
  budgetId: string | null
  budgeted: number
  spent: number
  remaining: number
  percentUsed: number
  lastMonthSpent: number
  changeFromLastMonth: number
  dailyAverage: number
  projectedSpend: number
  status: 'under' | 'warning' | 'over'
  transactions: Array<{
    id: string
    name: string
    amount: number
    date: string
  }>
}

export interface BudgetAlert {
  category: string
  type: 'over' | 'warning' | 'projected_over'
  message: string
  amount: number
}

export interface SuggestedBudget {
  category: string
  averageSpend: number
  suggestedBudget: number
}
