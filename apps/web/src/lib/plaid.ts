import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'

// Lazy initialization to avoid build-time errors
let _plaidClient: PlaidApi | null = null

export function getPlaidClient(): PlaidApi {
  if (!_plaidClient) {
    const env = process.env.PLAID_ENV || 'sandbox'
    const configuration = new Configuration({
      basePath: PlaidEnvironments[env as keyof typeof PlaidEnvironments],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
          'PLAID-SECRET': process.env.PLAID_SECRET,
        },
      },
    })
    _plaidClient = new PlaidApi(configuration)
  }
  return _plaidClient
}

// Backward compatible export using proxy
export const plaidClient = new Proxy({} as PlaidApi, {
  get(_, prop) {
    return getPlaidClient()[prop as keyof PlaidApi]
  },
})
