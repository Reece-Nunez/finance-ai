'use client'

import { useEffect } from 'react'
import { captureException } from '@/lib/sentry'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    captureException(error, { digest: error.digest, global: true })
  }, [error])

  return (
    <html lang="en">
      <body className="bg-neutral-50 dark:bg-neutral-950">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <svg
                  className="h-6 w-6 text-red-600 dark:text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-neutral-900 dark:text-white">
                Application Error
              </h1>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                A critical error occurred. Please try refreshing the page.
              </p>
              <button
                onClick={reset}
                className="mt-4 w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
              >
                Refresh Page
              </button>
              {/* Using plain anchor instead of Link because Next.js router may be broken in global error */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/"
                className="mt-2 block text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              >
                Return to Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
