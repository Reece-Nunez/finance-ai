import React, { ReactElement } from 'react'
import { render, RenderOptions, RenderResult } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock providers wrapper
function AllTheProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

// Custom render function that includes providers
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  const user = userEvent.setup()
  return {
    user,
    ...render(ui, { wrapper: AllTheProviders, ...options }),
  }
}

// Re-export everything from testing-library
export * from '@testing-library/react'

// Override render with custom render
export { customRender as render }

// Helper to create mock API responses
export function mockApiResponse<T>(data: T, delay = 0): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delay)
  })
}

// Helper to create mock error responses
export function mockApiError(message: string, status = 500): Promise<never> {
  return Promise.reject({
    message,
    status,
  })
}

// Wait for async operations
export const waitForAsync = (ms = 0) =>
  new Promise((resolve) => setTimeout(resolve, ms))

// Mock transaction data factory
export function createMockTransaction(overrides = {}) {
  return {
    id: 'tx_123',
    name: 'Test Transaction',
    merchant_name: 'Test Merchant',
    display_name: null,
    amount: 25.99,
    date: '2024-01-15',
    category: 'FOOD_AND_DRINK',
    is_income: false,
    pending: false,
    account_id: 'acc_123',
    account_name: 'Checking',
    user_id: 'user_123',
    plaid_transaction_id: 'plaid_tx_123',
    notes: null,
    ignore_type: 'none',
    is_exceptional: false,
    created_at: '2024-01-15T12:00:00Z',
    ...overrides,
  }
}

// Mock account data factory
export function createMockAccount(overrides = {}) {
  return {
    id: 'acc_123',
    name: 'Test Checking',
    type: 'depository',
    subtype: 'checking',
    current_balance: 1500.0,
    available_balance: 1450.0,
    institution_name: 'Test Bank',
    mask: '1234',
    user_id: 'user_123',
    ...overrides,
  }
}

// Mock user data factory
export function createMockUser(overrides = {}) {
  return {
    id: 'user_123',
    email: 'test@example.com',
    user_metadata: {
      firstName: 'Test',
      lastName: 'User',
    },
    ...overrides,
  }
}
