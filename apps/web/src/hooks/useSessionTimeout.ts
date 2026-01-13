'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SESSION_CONFIG, SessionState, SessionInfo } from '@/lib/security/session-config'
import { toast } from 'sonner'

interface UseSessionTimeoutOptions {
  enabled?: boolean
  onWarning?: () => void
  onExpired?: () => void
  onActivity?: () => void
}

export function useSessionTimeout(options: UseSessionTimeoutOptions = {}) {
  const { enabled = true, onWarning, onExpired, onActivity } = options
  const router = useRouter()
  const supabase = createClient()

  const [sessionState, setSessionState] = useState<SessionState>('active')
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [showWarning, setShowWarning] = useState(false)

  // Initialize refs with 0 to avoid calling impure Date.now() during render
  // Actual timestamp is set in useEffect on mount
  const lastActivityRef = useRef<number>(0)
  const sessionStartRef = useRef<number>(0)
  const warningShownRef = useRef<boolean>(false)
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isExtendedSessionRef = useRef<boolean>(false)

  // Get the appropriate timeout based on session type
  const getIdleTimeout = useCallback(() => {
    return isExtendedSessionRef.current
      ? SESSION_CONFIG.EXTENDED_SESSION_TIMEOUT
      : SESSION_CONFIG.IDLE_TIMEOUT
  }, [])

  // Update last activity timestamp
  const updateActivity = useCallback(() => {
    const now = Date.now()
    lastActivityRef.current = now

    // Persist to localStorage for cross-tab sync
    try {
      localStorage.setItem(SESSION_CONFIG.STORAGE_KEYS.LAST_ACTIVITY, now.toString())
    } catch {
      // localStorage might be unavailable
    }

    // Reset warning state if user becomes active
    if (warningShownRef.current) {
      warningShownRef.current = false
      setShowWarning(false)
      setSessionState('active')
    }

    onActivity?.()
  }, [onActivity])

  // Perform logout
  const performLogout = useCallback(async (reason: 'timeout' | 'manual' | 'absolute_timeout' = 'timeout') => {
    try {
      // Clear local storage
      Object.values(SESSION_CONFIG.STORAGE_KEYS).forEach((key) => {
        try {
          localStorage.removeItem(key)
        } catch {
          // Ignore errors
        }
      })

      // Broadcast logout to other tabs
      try {
        localStorage.setItem(
          SESSION_CONFIG.STORAGE_KEYS.LOGOUT_EVENT,
          JSON.stringify({ timestamp: Date.now(), reason })
        )
      } catch {
        // Ignore errors
      }

      // Sign out from Supabase
      await supabase.auth.signOut()

      setSessionState('logged_out')
      onExpired?.()

      // Redirect to login with appropriate message
      const message = reason === 'timeout'
        ? 'session_timeout'
        : reason === 'absolute_timeout'
        ? 'session_expired'
        : 'logged_out'

      router.push(`/login?message=${message}`)
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
      // Force redirect even if logout fails
      window.location.href = '/login?message=session_error'
    }
  }, [supabase, router, onExpired])

  // Extend session (user clicked "Stay Logged In")
  const extendSession = useCallback(() => {
    updateActivity()
    warningShownRef.current = false
    setShowWarning(false)
    setSessionState('active')
    toast.success('Session Extended', {
      description: 'Your session has been extended. You can continue working.',
      duration: 3000,
    })
  }, [updateActivity])

  // Check session status
  const checkSession = useCallback(() => {
    const now = Date.now()
    const idleTime = now - lastActivityRef.current
    const sessionDuration = now - sessionStartRef.current
    const idleTimeout = getIdleTimeout()

    // Check absolute session timeout (max 8 hours regardless of activity)
    if (sessionDuration >= SESSION_CONFIG.ABSOLUTE_SESSION_TIMEOUT) {
      performLogout('absolute_timeout')
      return
    }

    // Calculate time until warning and expiry
    const timeUntilExpiry = idleTimeout - idleTime
    const timeUntilWarning = timeUntilExpiry - SESSION_CONFIG.WARNING_BEFORE_TIMEOUT

    // Update session info
    setSessionInfo({
      state: sessionState,
      lastActivity: lastActivityRef.current,
      sessionStart: sessionStartRef.current,
      timeUntilWarning: Math.max(0, timeUntilWarning),
      timeUntilExpiry: Math.max(0, timeUntilExpiry),
      isExtendedSession: isExtendedSessionRef.current,
    })

    // Check if session has expired
    if (idleTime >= idleTimeout) {
      performLogout('timeout')
      return
    }

    // Check if we should show warning
    if (timeUntilWarning <= 0 && !warningShownRef.current) {
      warningShownRef.current = true
      setShowWarning(true)
      setSessionState('warning')
      onWarning?.()
    }
  }, [sessionState, getIdleTimeout, performLogout, onWarning])

  // Check if session expired while browser was closed
  const checkSessionOnLoad = useCallback(async () => {
    try {
      const storedLastActivity = localStorage.getItem(SESSION_CONFIG.STORAGE_KEYS.LAST_ACTIVITY)
      const storedSessionStart = localStorage.getItem(SESSION_CONFIG.STORAGE_KEYS.SESSION_START)
      const rememberMe = localStorage.getItem(SESSION_CONFIG.STORAGE_KEYS.REMEMBER_ME) === 'true'

      if (storedLastActivity && storedSessionStart) {
        const lastActivity = parseInt(storedLastActivity, 10)
        const sessionStart = parseInt(storedSessionStart, 10)
        const now = Date.now()
        const idleTime = now - lastActivity
        const sessionDuration = now - sessionStart
        const idleTimeout = rememberMe ? SESSION_CONFIG.EXTENDED_SESSION_TIMEOUT : SESSION_CONFIG.IDLE_TIMEOUT

        // Check if session expired while away
        if (idleTime >= idleTimeout || sessionDuration >= SESSION_CONFIG.ABSOLUTE_SESSION_TIMEOUT) {
          // Session expired - force logout
          await supabase.auth.signOut()
          Object.values(SESSION_CONFIG.STORAGE_KEYS).forEach((key) => {
            try { localStorage.removeItem(key) } catch { /* ignore */ }
          })
          router.push('/login?message=session_expired')
          router.refresh()
          return false
        }
      }
      return true
    } catch {
      return true // Continue if localStorage unavailable
    }
  }, [supabase, router])

  // Initialize session tracking
  useEffect(() => {
    if (!enabled) return

    // Check if session is still valid on load
    checkSessionOnLoad().then((isValid) => {
      if (!isValid) return
    })

    // Check for extended session preference
    try {
      const rememberMe = localStorage.getItem(SESSION_CONFIG.STORAGE_KEYS.REMEMBER_ME)
      isExtendedSessionRef.current = rememberMe === 'true'
    } catch {
      // Ignore errors
    }

    // Initialize timestamps
    const now = Date.now()
    lastActivityRef.current = now
    sessionStartRef.current = now

    try {
      localStorage.setItem(SESSION_CONFIG.STORAGE_KEYS.LAST_ACTIVITY, now.toString())
      localStorage.setItem(SESSION_CONFIG.STORAGE_KEYS.SESSION_START, now.toString())
    } catch {
      // Ignore errors
    }

    // Set up activity listeners
    const handleActivity = () => {
      updateActivity()
    }

    SESSION_CONFIG.ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    // Set up session check interval
    checkIntervalRef.current = setInterval(checkSession, SESSION_CONFIG.ACTIVITY_CHECK_INTERVAL)

    // Listen for logout events from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SESSION_CONFIG.STORAGE_KEYS.LOGOUT_EVENT && e.newValue) {
        // Another tab triggered logout
        setSessionState('logged_out')
        router.push('/login?message=logged_out_other_tab')
        router.refresh()
      }

      // Sync activity across tabs
      if (e.key === SESSION_CONFIG.STORAGE_KEYS.LAST_ACTIVITY && e.newValue) {
        const otherTabActivity = parseInt(e.newValue, 10)
        if (otherTabActivity > lastActivityRef.current) {
          lastActivityRef.current = otherTabActivity
          if (warningShownRef.current) {
            warningShownRef.current = false
            setShowWarning(false)
            setSessionState('active')
          }
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // Handle beforeunload - mark last activity for session check on return
    const handleBeforeUnload = () => {
      try {
        localStorage.setItem(SESSION_CONFIG.STORAGE_KEYS.LAST_ACTIVITY, Date.now().toString())
      } catch {
        // Ignore errors
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    // Cleanup
    return () => {
      SESSION_CONFIG.ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)

      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }
    }
  }, [enabled, updateActivity, checkSession, checkSessionOnLoad, router])

  // Handle visibility change (user switches tabs)
  useEffect(() => {
    if (!enabled) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check session immediately when tab becomes visible
        checkSession()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, checkSession])

  return {
    sessionState,
    sessionInfo,
    showWarning,
    extendSession,
    logout: () => performLogout('manual'),
    updateActivity,
  }
}
