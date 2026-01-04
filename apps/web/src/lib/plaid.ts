import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'

// Lazy initialization to avoid build-time errors
let _plaidClient: PlaidApi | null = null

export function getPlaidEnv() {
  return {
    clientId: process.env.PLAID_CLIENT_ID,
    secret: process.env.PLAID_SECRET,
    env: process.env.PLAID_ENV || 'sandbox',
  }
}

export function getPlaidClient(): PlaidApi {
  if (!_plaidClient) {
    const { clientId, secret, env } = getPlaidEnv()
    const configuration = new Configuration({
      basePath: PlaidEnvironments[env as keyof typeof PlaidEnvironments],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': clientId,
          'PLAID-SECRET': secret,
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
