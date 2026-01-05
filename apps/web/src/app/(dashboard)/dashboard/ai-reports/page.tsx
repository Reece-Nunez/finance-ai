'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
} from 'lucide-react'
import { SterlingIcon } from '@/components/ui/sterling-icon'

interface AIReport {
  id: string
  transactions_found: number
  transactions_categorized: number
  transactions_skipped: number
  trigger_type: 'auto' | 'manual'
  reviewed: boolean
  created_at: string
}

export default function AIReportsPage() {
  const router = useRouter()
  const [reports, setReports] = useState<AIReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadReports() {
      try {
        const response = await fetch('/api/ai/reports')
        if (response.ok) {
          const data = await response.json()
          setReports(data.reports || [])
        }
      } catch (error) {
        console.error('Error loading reports:', error)
      } finally {
        setLoading(false)
      }
    }

    loadReports()
  }, [])

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">AI Categorization Reports</h1>
          <p className="text-muted-foreground mt-1">
            View history of AI categorization runs
          </p>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto mb-4">
            <SterlingIcon size="xl" className="opacity-50" />
          </div>
          <h2 className="text-xl font-semibold">No Reports Yet</h2>
          <p className="text-muted-foreground mt-2">
            AI categorization reports will appear here after transactions are synced and processed.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const needsReview = report.transactions_skipped > 0 && !report.reviewed
            const date = new Date(report.created_at)

            return (
              <Card
                key={report.id}
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                  needsReview ? 'border-amber-200 dark:border-amber-800' : ''
                }`}
                onClick={() => router.push(`/dashboard/ai-report/${report.id}`)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className={`rounded-full p-2 ${
                      needsReview
                        ? 'bg-amber-100 dark:bg-amber-900/30'
                        : report.reviewed
                          ? 'bg-emerald-100 dark:bg-emerald-900/30'
                          : 'bg-muted'
                    }`}>
                      {needsReview ? (
                        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      ) : report.reviewed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Clock className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">
                          {date.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        <span className="text-sm text-muted-foreground">
                          {date.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {report.trigger_type === 'auto' ? 'Auto' : 'Manual'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{report.transactions_found} analyzed</span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {report.transactions_categorized} categorized
                        </span>
                        {report.transactions_skipped > 0 && (
                          <span className="text-amber-600 dark:text-amber-400">
                            {report.transactions_skipped} need review
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
