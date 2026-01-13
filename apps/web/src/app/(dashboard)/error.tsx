'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { captureException } from '@/lib/sentry'
import { AlertTriangle, RefreshCw, Settings, LogIn } from 'lucide-react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    captureException(error, { digest: error.digest, area: 'dashboard' })
  }, [error])

  const isConnectionError =
    error.message?.toLowerCase().includes('network') ||
    error.message?.toLowerCase().includes('fetch') ||
    error.message?.toLowerCase().includes('failed to fetch')

  const isAuthError =
    error.message?.toLowerCase().includes('unauthorized') ||
    error.message?.toLowerCase().includes('401') ||
    error.message?.toLowerCase().includes('session')

  const getErrorTitle = () => {
    if (isConnectionError) return 'Connection Error'
    if (isAuthError) return 'Session Expired'
    return 'Something went wrong'
  }

  const getErrorDescription = () => {
    if (isConnectionError) {
      return 'Unable to connect. Please check your internet connection.'
    }
    if (isAuthError) {
      return 'Your session has expired. Please sign in again.'
    }
    return 'We encountered an error loading this page. Our team has been notified.'
  }

  return (
    <div className="flex items-center justify-center p-4 min-h-[50vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>{getErrorTitle()}</CardTitle>
          <CardDescription>{getErrorDescription()}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {isAuthError ? (
            <Button asChild className="w-full">
              <Link href="/login">
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </Link>
            </Button>
          ) : (
            <>
              <Button onClick={reset} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="/dashboard/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </Button>
            </>
          )}
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4 rounded-lg bg-muted p-4 text-sm">
              <summary className="cursor-pointer font-medium">
                Error details
              </summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground overflow-auto max-h-48">
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
