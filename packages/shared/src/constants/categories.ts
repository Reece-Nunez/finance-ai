export const CATEGORY_ICONS: Record<string, string> = {
  'Food & Dining': 'utensils',
  Groceries: 'shopping-cart',
  Transportation: 'car',
  'Housing & Utilities': 'home',
  Entertainment: 'gamepad-2',
  Shopping: 'shopping-bag',
  Healthcare: 'heart',
  'Personal Care': 'sparkles',
  Education: 'graduation-cap',
  Travel: 'plane',
  'Bills & Subscriptions': 'credit-card',
  'Income': 'dollar-sign',
  'Transfer': 'arrow-right-left',
  'Investment': 'trending-up',
  'Gifts & Donations': 'gift',
  'Fees & Charges': 'alert-circle',
  'Other': 'more-horizontal',
}

export const CATEGORY_COLORS: Record<string, string> = {
  'Food & Dining': '#ef4444',
  Groceries: '#f97316',
  Transportation: '#eab308',
  'Housing & Utilities': '#22c55e',
  Entertainment: '#06b6d4',
  Shopping: '#3b82f6',
  Healthcare: '#8b5cf6',
  'Personal Care': '#ec4899',
  Education: '#6366f1',
  Travel: '#14b8a6',
  'Bills & Subscriptions': '#64748b',
  Income: '#10b981',
  Transfer: '#94a3b8',
  Investment: '#059669',
  'Gifts & Donations': '#f43f5e',
  'Fees & Charges': '#dc2626',
  Other: '#71717a',
}

export const DEFAULT_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Transportation',
  'Housing & Utilities',
  'Entertainment',
  'Shopping',
  'Healthcare',
  'Personal Care',
  'Education',
  'Travel',
  'Bills & Subscriptions',
  'Income',
  'Transfer',
  'Investment',
  'Gifts & Donations',
  'Fees & Charges',
  'Other',
] as const

// Map Plaid's SCREAMING_SNAKE_CASE categories to display names
export const PLAID_CATEGORY_MAP: Record<string, string> = {
  FOOD_AND_DRINK: 'Food & Dining',
  GENERAL_MERCHANDISE: 'Shopping',
  GENERAL_SERVICES: 'Services',
  TRANSPORTATION: 'Transportation',
  TRAVEL: 'Travel',
  RENT_AND_UTILITIES: 'Housing & Utilities',
  HOME_IMPROVEMENT: 'Home Improvement',
  ENTERTAINMENT: 'Entertainment',
  PERSONAL_CARE: 'Personal Care',
  MEDICAL: 'Healthcare',
  EDUCATION: 'Education',
  GOVERNMENT_AND_NON_PROFIT: 'Government & Non-Profit',
  BANK_FEES: 'Fees & Charges',
  LOAN_PAYMENTS: 'Loans',
  TRANSFER_IN: 'Transfer',
  TRANSFER_OUT: 'Transfer',
  INCOME: 'Income',
}

// Format a category name for display
export function formatCategoryName(category: string): string {
  // Check if it's in our Plaid mapping
  if (PLAID_CATEGORY_MAP[category]) {
    return PLAID_CATEGORY_MAP[category]
  }

  // Check if it's already a properly formatted name
  if (DEFAULT_CATEGORIES.includes(category as typeof DEFAULT_CATEGORIES[number])) {
    return category
  }

  // Convert SCREAMING_SNAKE_CASE to Title Case
  return category
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
