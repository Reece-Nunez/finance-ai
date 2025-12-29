// Format Plaid category strings to be human-readable
// Converts "FOOD_AND_DRINK" to "Food & Drink"
export function formatCategory(category: string | null | undefined): string {
  if (!category) return 'Uncategorized'

  return category
    .toLowerCase()
    .split('_')
    .map(word => {
      // Handle common words that should stay lowercase
      if (['and', 'or', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for'].includes(word)) {
        return word
      }
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
    .replace(' and ', ' & ')
    .replace(' And ', ' & ')
}

// Format currency amounts
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

// Format currency without decimals (for charts, summaries)
export function formatCurrencyCompact(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Format date
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Format date short (for charts)
export function formatDateShort(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

// Format merchant name (capitalize properly)
export function formatMerchantName(name: string | null | undefined): string {
  if (!name) return 'Unknown'

  // If it's already mixed case, return as-is
  if (name !== name.toUpperCase() && name !== name.toLowerCase()) {
    return name
  }

  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
