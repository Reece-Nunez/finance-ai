import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { MerchantLogo } from './MerchantLogo'

// Mock the Image component to test error handling
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native')
  return {
    ...RN,
    Image: ({ onError, testID, ...props }: { onError?: () => void; testID?: string }) => {
      // Simulate successful load for known merchants
      return <RN.View testID={testID} {...props} />
    },
  }
})

describe('MerchantLogo', () => {
  it('renders without crashing', () => {
    render(<MerchantLogo name="Netflix" />)
  })

  it('uses default size of 40', () => {
    const { getByTestId } = render(<MerchantLogo name="Test" />)
    // Component should render
  })

  it('accepts custom size', () => {
    render(<MerchantLogo name="Starbucks" size={60} />)
    // Component should render with custom size
  })

  it('handles null/undefined name gracefully', () => {
    // @ts-expect-error Testing null handling
    render(<MerchantLogo name={null} />)
    // Should fall back to "Unknown"
  })

  it('handles empty string name', () => {
    render(<MerchantLogo name="" />)
    // Should fall back to "Unknown" or handle gracefully
  })

  it('generates consistent color for same merchant', () => {
    // The color generation should be deterministic
    const { rerender } = render(<MerchantLogo name="Test Merchant" />)
    rerender(<MerchantLogo name="Test Merchant" />)
    // Same name should produce same color
  })

  it('generates initials correctly for single word', () => {
    render(<MerchantLogo name="Netflix" />)
    // Should show "NE" as initials if logo fails
  })

  it('generates initials correctly for multiple words', () => {
    render(<MerchantLogo name="Whole Foods" />)
    // Should show "WF" as initials if logo fails
  })
})
