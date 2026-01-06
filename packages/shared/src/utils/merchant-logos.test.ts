import { getMerchantDomain, normalizeMerchantName, getMerchantLogoUrl } from './merchant-logos'

describe('normalizeMerchantName', () => {
  it('removes special characters', () => {
    expect(normalizeMerchantName("McDonald's")).toBe('mcdonalds')
  })

  it('removes store numbers', () => {
    expect(normalizeMerchantName('WALMART #1234')).toBe('walmart')
  })

  it('converts to lowercase', () => {
    expect(normalizeMerchantName('STARBUCKS')).toBe('starbucks')
  })

  it('removes long number sequences', () => {
    expect(normalizeMerchantName('Amazon 12345678')).toBe('amazon')
  })
})

describe('getMerchantDomain', () => {
  it('returns domain for known merchants', () => {
    expect(getMerchantDomain('Netflix')).toBe('netflix.com')
    expect(getMerchantDomain('Starbucks')).toBe('starbucks.com')
    expect(getMerchantDomain('Amazon')).toBe('amazon.com')
  })

  it('handles variations in merchant names', () => {
    expect(getMerchantDomain("McDonald's #1234")).toBe('mcdonalds.com')
    expect(getMerchantDomain('WALMART STORE')).toBe('walmart.com')
  })

  it('returns null for unknown merchants', () => {
    expect(getMerchantDomain('Random Local Shop XYZ')).toBeNull()
  })

  it('handles null input', () => {
    expect(getMerchantDomain(null)).toBeNull()
  })

  it('handles partial matches', () => {
    expect(getMerchantDomain('Chipotle Mexican Grill')).toBe('chipotle.com')
  })
})

describe('getMerchantLogoUrl', () => {
  it('returns Google favicon URL for known merchants', () => {
    const url = getMerchantLogoUrl('Netflix')
    expect(url).toBe('https://www.google.com/s2/favicons?domain=netflix.com&sz=128')
  })

  it('returns null for unknown merchants', () => {
    expect(getMerchantLogoUrl('Unknown Shop ABC123')).toBeNull()
  })

  it('respects size parameter', () => {
    const url = getMerchantLogoUrl('Netflix', 64)
    expect(url).toBe('https://www.google.com/s2/favicons?domain=netflix.com&sz=64')
  })

  it('caps size at 256', () => {
    const url = getMerchantLogoUrl('Netflix', 500)
    expect(url).toBe('https://www.google.com/s2/favicons?domain=netflix.com&sz=256')
  })
})
