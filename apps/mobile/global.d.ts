/* eslint-disable @typescript-eslint/no-empty-object-type */
// NativeWind className type extensions for React Native components
// This extends the React Native types to support className prop with NativeWind

import type { ViewStyle, TextStyle, ImageStyle } from 'react-native'

// Declare global __DEV__ variable
declare global {
  const __DEV__: boolean
}

// Extend React Native components to support className
declare module 'react-native' {
  interface ViewProps {
    className?: string
    tw?: string
  }

  interface TextProps {
    className?: string
    tw?: string
  }

  interface TextInputProps {
    className?: string
    tw?: string
  }

  interface ImageProps {
    className?: string
    tw?: string
  }

  interface ScrollViewProps {
    className?: string
    tw?: string
    contentContainerClassName?: string
  }

  interface TouchableOpacityProps {
    className?: string
    tw?: string
  }

  interface TouchableHighlightProps {
    className?: string
    tw?: string
  }

  interface TouchableWithoutFeedbackProps {
    className?: string
    tw?: string
  }

  interface PressableProps {
    className?: string
    tw?: string
  }

  interface FlatListProps<ItemT> {
    className?: string
    tw?: string
    contentContainerClassName?: string
  }

  interface SectionListProps<ItemT, SectionT> {
    className?: string
    tw?: string
    contentContainerClassName?: string
  }

  interface KeyboardAvoidingViewProps {
    className?: string
    tw?: string
  }

  interface ModalProps {
    className?: string
    tw?: string
  }

  interface ActivityIndicatorProps {
    className?: string
    tw?: string
  }

  interface SwitchProps {
    className?: string
    tw?: string
  }

  interface RefreshControlProps {
    className?: string
    tw?: string
  }
}

// Extend SafeAreaView from react-native-safe-area-context
declare module 'react-native-safe-area-context' {
  interface SafeAreaViewProps {
    className?: string
    tw?: string
  }
}

// Extend Animated components
declare module 'react-native-reanimated' {
  interface AnimatedProps<T> {
    className?: string
    tw?: string
  }
}

export {}
