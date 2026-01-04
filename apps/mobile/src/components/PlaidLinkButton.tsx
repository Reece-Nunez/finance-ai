import { useState, useCallback } from 'react'
import { TouchableOpacity, Text, ActivityIndicator, Alert, View } from 'react-native'
import {
  create,
  open,
  dismissLink,
  LinkSuccess,
  LinkExit,
  LinkIOSPresentationStyle,
  LinkLogLevel,
} from 'react-native-plaid-link-sdk'
import { Ionicons } from '@expo/vector-icons'

import { useCreateLinkToken, useExchangeToken, useSyncTransactions } from '@/hooks/useApi'

interface PlaidLinkButtonProps {
  onSuccess?: () => void
  variant?: 'primary' | 'secondary'
  label?: string
}

export function PlaidLinkButton({
  onSuccess,
  variant = 'primary',
  label = 'Connect Bank Account',
}: PlaidLinkButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const createLinkToken = useCreateLinkToken()
  const exchangeToken = useExchangeToken()
  const syncTransactions = useSyncTransactions()

  const handlePress = useCallback(async () => {
    setIsLoading(true)

    try {
      // 1. Create a link token from our API
      const { link_token } = await createLinkToken.mutateAsync()

      // 2. Create the Plaid Link configuration
      const linkTokenConfiguration = {
        token: link_token,
        logLevel: LinkLogLevel.ERROR,
        noLoadingState: false,
      }

      // 3. Create and open Plaid Link
      create(linkTokenConfiguration)

      const openProps = {
        onSuccess: async (success: LinkSuccess) => {
          setIsLoading(true)
          try {
            // 4. Exchange public token for access token
            await exchangeToken.mutateAsync({
              publicToken: success.publicToken,
              metadata: success.metadata,
            })

            // 5. Sync transactions
            await syncTransactions.mutateAsync(undefined)

            Alert.alert(
              'Success!',
              'Your bank account has been connected successfully.',
              [{ text: 'OK' }]
            )

            onSuccess?.()
          } catch (error) {
            console.error('Error exchanging token:', error)
            Alert.alert(
              'Connection Error',
              'There was a problem connecting your account. Please try again.'
            )
          } finally {
            setIsLoading(false)
          }
        },
        onExit: (exit: LinkExit) => {
          setIsLoading(false)
          if (exit.error) {
            console.error('Plaid Link error:', exit.error)
            Alert.alert(
              'Connection Cancelled',
              exit.error.displayMessage || 'The connection was cancelled.'
            )
          }
        },
        iOSPresentationStyle: LinkIOSPresentationStyle.MODAL,
      }

      open(openProps)
    } catch (error) {
      console.error('Error creating link token:', error)
      Alert.alert(
        'Error',
        'Unable to start bank connection. Please try again later.'
      )
      setIsLoading(false)
    }
  }, [createLinkToken, exchangeToken, syncTransactions, onSuccess])

  if (variant === 'secondary') {
    return (
      <TouchableOpacity
        className="bg-slate-900 border border-slate-700 rounded-xl py-4 px-5 flex-row items-center justify-center"
        onPress={handlePress}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text className="text-white font-medium ml-2">{label}</Text>
          </>
        )}
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity
      className={`rounded-xl py-4 px-5 flex-row items-center justify-center ${
        isLoading ? 'bg-slate-700' : 'bg-white'
      }`}
      onPress={handlePress}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color="#020617" />
      ) : (
        <>
          <Ionicons name="link-outline" size={20} color="#020617" />
          <Text className="text-slate-950 font-semibold ml-2">{label}</Text>
        </>
      )}
    </TouchableOpacity>
  )
}
