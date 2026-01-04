'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { Button } from '@/components/ui/button'
import { Plus, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface PlaidLinkButtonProps {
  onSuccess?: () => void
}

export function PlaidLinkButton({ onSuccess }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const createLinkToken = async () => {
      try {
        const response = await fetch('/api/plaid/create-link-token', {
          method: 'POST',
        })
        const data = await response.json()

        if (!response.ok) {
          console.error('Plaid error:', data)
          setError(data.error || 'Failed to initialize bank connection')
          toast.error('Bank Connection Error', {
            description: data.error || 'Failed to initialize. Please try again later.'
          })
          return
        }

        setLinkToken(data.link_token)
      } catch (err) {
        console.error('Error fetching link token:', err)
        setError('Failed to connect to server')
      }
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

          // Show syncing toast
          const syncToastId = toast.loading('Syncing transactions...', {
            description: 'Importing your transaction history. This may take a moment.',
          })

          // Sync transactions after connecting
          const syncResponse = await fetch('/api/plaid/sync-transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_id: data.item_id }),
          })

          if (syncResponse.ok) {
            const syncData = await syncResponse.json()
            toast.success('Account connected!', {
              id: syncToastId,
              description: `Imported ${syncData.added} transactions. Welcome to Sterling!`,
            })
          } else {
            toast.error('Sync issue', {
              id: syncToastId,
              description: 'Account connected but transactions sync had an issue. Try syncing again.',
            })
          }

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

  if (error) {
    return (
      <Button
        disabled
        variant="destructive"
        className="opacity-80"
      >
        <AlertCircle className="mr-2 h-4 w-4" />
        Connection Unavailable
      </Button>
    )
  }

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
