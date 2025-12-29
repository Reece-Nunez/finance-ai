'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { Button } from '@/components/ui/button'
import { Plus, Loader2 } from 'lucide-react'

interface PlaidLinkButtonProps {
  onSuccess?: () => void
}

export function PlaidLinkButton({ onSuccess }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const createLinkToken = async () => {
      const response = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
      })
      const data = await response.json()
      setLinkToken(data.link_token)
    }
    createLinkToken()
  }, [])

  const onPlaidSuccess = useCallback(
    async (publicToken: string, metadata: unknown) => {
      setLoading(true)
      try {
        const response = await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token: publicToken, metadata }),
        })

        if (response.ok) {
          const data = await response.json()
          // Sync transactions after connecting
          await fetch('/api/plaid/sync-transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_id: data.item_id }),
          })
          onSuccess?.()
        }
      } catch (error) {
        console.error('Error connecting account:', error)
      } finally {
        setLoading(false)
      }
    },
    [onSuccess]
  )

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
  })

  return (
    <Button
      onClick={() => open()}
      disabled={!ready || loading}
      className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <Plus className="mr-2 h-4 w-4" />
          Connect Bank Account
        </>
      )}
    </Button>
  )
}
