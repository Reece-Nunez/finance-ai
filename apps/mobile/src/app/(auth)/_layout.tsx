import { Stack } from 'expo-router'
import { View } from 'react-native'

export default function AuthLayout() {
  return (
    <View className="flex-1 bg-slate-950">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#020617' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
      </Stack>
    </View>
  )
}
