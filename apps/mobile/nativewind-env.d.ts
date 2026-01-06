/// <reference types="nativewind/types" />

import 'react-native'
import 'react-native-safe-area-context'

declare module 'react-native' {
  interface TextInputProps {
    className?: string
    cssInterop?: boolean
  }
}

declare module 'react-native-safe-area-context' {
  interface NativeSafeAreaViewProps {
    className?: string
  }
}
