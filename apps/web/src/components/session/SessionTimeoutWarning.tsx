'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Clock, Shield } from 'lucide-react'
import { SESSION_CONFIG } from '@/lib/security/session-config'

interface SessionTimeoutWarningProps {
  open: boolean
  onExtendSession: () => void
  onLogout: () => void
  timeUntilExpiry?: number
}

export function SessionTimeoutWarning({
  open,
  onExtendSession,
  onLogout,
  timeUntilExpiry = SESSION_CONFIG.WARNING_BEFORE_TIMEOUT,
}: SessionTimeoutWarningProps) {
  const [countdown, setCountdown] = useState(
    Math.ceil(timeUntilExpiry / 1000)
  )

  // Update countdown every second
  useEffect(() => {
    if (!open) {
      setCountdown(Math.ceil(SESSION_CONFIG.WARNING_BEFORE_TIMEOUT / 1000))
      return
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          onLogout()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [open, onLogout])

  // Reset countdown when timeUntilExpiry changes
  useEffect(() => {
    if (open && timeUntilExpiry > 0) {
      setCountdown(Math.ceil(timeUntilExpiry / 1000))
    }
  }, [open, timeUntilExpiry])

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }
    return `${secs} seconds`
  }, [])

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        hideCloseButton
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-500" />
          </div>
          <DialogTitle className="text-center text-xl">
            Session Expiring Soon
          </DialogTitle>
          <DialogDescription className="text-center">
            For your security, your session will expire due to inactivity.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4">
          <div className="flex items-center justify-center gap-2 rounded-lg bg-muted p-4">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <span className="text-2xl font-bold tabular-nums">
              {formatTime(countdown)}
            </span>
          </div>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Click &quot;Stay Logged In&quot; to continue your session, or you will be
            automatically logged out.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/50">
          <Shield className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            This security measure protects your financial information from
            unauthorized access.
          </p>
        </div>

        <DialogFooter className="mt-4 flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={onLogout}
            className="w-full sm:w-auto"
          >
            Log Out Now
          </Button>
          <Button
            onClick={onExtendSession}
            className="w-full sm:w-auto"
            autoFocus
          >
            Stay Logged In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
