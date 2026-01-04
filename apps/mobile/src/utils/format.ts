// Currency formatting
export function formatCurrency(
  amount: number,
  options: { showSign?: boolean; compact?: boolean } = {}
): string {
  const { showSign = false, compact = false } = options

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 0 : 2,
    notation: compact && Math.abs(amount) >= 10000 ? 'compact' : 'standard',
  })

  const formatted = formatter.format(Math.abs(amount))

  if (showSign) {
    return amount >= 0 ? `+${formatted}` : `-${formatted}`
  }

  return amount < 0 ? `-${formatted}` : formatted
}

// Date formatting
export function formatDate(date: string | Date, format: 'short' | 'long' | 'relative' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date

  if (format === 'relative') {
    return formatRelativeDate(d)
  }

  if (format === 'long') {
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatRelativeDate(date: Date): string {
  const now = new Date()
  const diffTime = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return 'Today'
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return formatDate(date, 'short')
  }
}

// Percentage formatting
export function formatPercent(value: number, decimals = 0): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

// Compact number formatting
export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}
