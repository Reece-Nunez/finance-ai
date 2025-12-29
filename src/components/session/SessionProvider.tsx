'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useSessionTimeout } from '@/hooks/useSessionTimeout'
import { SessionTimeoutWarning } from './SessionTimeoutWarning'
import { SessionState, SessionInfo } from '@/lib/security/session-config'

interface SessionContextValue {
  sessionState: SessionState
  sessionInfo: SessionInfo | null
  logout: () => void
  extendSession: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

interface SessionProviderProps {
  children: ReactNode
  enabled?: boolean
}

export function SessionProvider({ children, enabled = true }: SessionProviderProps) {
  const {
    sessionState,
    sessionInfo,
    showWarning,
    extendSession,
    logout,
  } = useSessionTimeout({ enabled })

  return (
    <SessionContext.Provider
      value={{
        sessionState,
        sessionInfo,
        logout,
        extendSession,
      }}
    >
      {children}
      <SessionTimeoutWarning
        open={showWarning}
        onExtendSession={extendSession}
        onLogout={logout}
        timeUntilExpiry={sessionInfo?.timeUntilExpiry}
      />
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}
