import { TouchableOpacity, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface PlaidLinkButtonProps {
  onSuccess?: () => void
  variant?: 'primary' | 'secondary'
  label?: string
}

// Web stub - Plaid Link only works on native platforms
export function PlaidLinkButton({
  variant = 'primary',
  label = 'Connect Bank Account',
}: PlaidLinkButtonProps) {
  const handlePress = () => {
    alert('Bank connection is only available in the mobile app.')
  }

  if (variant === 'secondary') {
    return (
      <TouchableOpacity
        className="bg-slate-900 border border-slate-700 rounded-xl py-4 px-5 flex-row items-center justify-center opacity-50"
        onPress={handlePress}
      >
        <Ionicons name="add-circle-outline" size={20} color="#fff" />
        <Text className="text-white font-medium ml-2">{label}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity
      className="rounded-xl py-4 px-5 flex-row items-center justify-center bg-slate-700 opacity-50"
      onPress={handlePress}
    >
      <Ionicons name="link-outline" size={20} color="#94a3b8" />
      <Text className="text-slate-400 font-semibold ml-2">{label} (Mobile Only)</Text>
    </TouchableOpacity>
  )
}
