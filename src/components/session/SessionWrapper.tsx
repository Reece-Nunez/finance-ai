'use client'

import { ReactNode } from 'react'
import { SessionProvider } from './SessionProvider'

interface SessionWrapperProps {
  children: ReactNode
}

export function SessionWrapper({ children }: SessionWrapperProps) {
  return <SessionProvider>{children}</SessionProvider>
}
