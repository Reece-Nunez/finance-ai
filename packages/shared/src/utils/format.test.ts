import { formatCurrency, formatDate, formatDateShort, formatRelativeTime, formatCategory } from './format'

describe('formatCurrency', () => {
  it('formats positive numbers correctly', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56')
  })

  it('formats zero correctly', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('formats negative numbers correctly', () => {
    expect(formatCurrency(-500.25)).toBe('-$500.25')
  })

  it('formats large numbers correctly', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00')
  })

  it('handles decimal precision', () => {
    expect(formatCurrency(99.999)).toBe('$100.00')
  })
})

describe('formatDate', () => {
  it('formats date correctly', () => {
    expect(formatDate('2024-01-15')).toMatch(/Jan 15, 2024/)
  })
})

describe('formatDateShort', () => {
  it('formats short date correctly', () => {
    expect(formatDateShort('2024-06-20')).toMatch(/Jun 20/)
  })
})

describe('formatRelativeTime', () => {
  it('returns Today for today', () => {
    const today = new Date().toISOString()
    expect(formatRelativeTime(today)).toBe('Today')
  })

  it('returns Yesterday for yesterday', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    expect(formatRelativeTime(yesterday)).toBe('Yesterday')
  })
})

describe('formatCategory', () => {
  it('returns category as-is', () => {
    expect(formatCategory('Food & Drink')).toBe('Food & Drink')
  })

  it('returns Uncategorized for null', () => {
    expect(formatCategory(null)).toBe('Uncategorized')
  })
})
