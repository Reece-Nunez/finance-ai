import { useState } from 'react'
import { View, Image, Text } from 'react-native'

interface MerchantLogoProps {
  name: string
  size?: number
}

export function MerchantLogo({ name, size = 40 }: MerchantLogoProps) {
  const [error, setError] = useState(false)

  // Generate initials for fallback
  const getInitials = (name: string) => {
    const words = name.split(' ').filter(Boolean)
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  // Generate a consistent color based on the name
  const getColor = (name: string) => {
    const colors = [
      '#ef4444', // red
      '#f97316', // orange
      '#eab308', // yellow
      '#22c55e', // green
      '#14b8a6', // teal
      '#3b82f6', // blue
      '#8b5cf6', // violet
      '#ec4899', // pink
    ]
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  // Clean merchant name for Clearbit URL
  const cleanName = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20)

  const logoUrl = `https://logo.clearbit.com/${cleanName}.com`

  if (error) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: getColor(name),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: 'white',
            fontSize: size * 0.35,
            fontWeight: '600',
          }}
        >
          {getInitials(name)}
        </Text>
      </View>
    )
  }

  return (
    <Image
      source={{ uri: logoUrl }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#1e293b',
      }}
      onError={() => setError(true)}
    />
  )
}
