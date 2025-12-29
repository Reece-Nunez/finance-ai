'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Check,
  X,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { formatCategory, formatCurrency } from '@/lib/format'

interface CategorizedItem {
  transaction_id: string
  original_name: string
  amount: number
  date: string
  new_category: string
  new_name?: string
  confidence: number
}

interface SkippedItem {
  transaction_id: string
  original_name: string
  current_category?: string
  amount: number
  date: string
  suggested_category: string
  suggested_name?: string
  confidence: number
  reason: string
}

interface AIReport {
  id: string
  user_id: string
  transactions_found: number
  transactions_categorized: number
  transactions_skipped: number
  categorized_items: CategorizedItem[]
  skipped_items: SkippedItem[]
  trigger_type: 'auto' | 'manual'
  reviewed: boolean
  reviewed_at: string | null
  created_at: string
}

export default function AIReportPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const reportId = params.id as string

  const [report, setReport] = useState<AIReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<string | null>(null)
  const [appliedItems, setAppliedItems] = useState<Set<string>>(new Set())
  const [rejectedItems, setRejectedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function loadReport() {
      setLoading(true)
      try {
        const response = await fetch(`/api/ai/reports?id=${reportId}`)
        if (response.ok) {
          const data = await response.json()
          setReport(data)
        }
      } catch (error) {
        console.error('Error loading report:', error)
      } finally {
        setLoading(false)
      }
    }

    loadReport()
  }, [reportId])

  const acceptSuggestion = async (item: SkippedItem) => {
    setApplying(item.transaction_id)
    try {
      const updateData: Record<string, unknown> = {
        ai_category: item.suggested_category,
        needs_review: false,
      }
      if (item.suggested_name) {
        updateData.display_name = item.suggested_name
      }

      const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', item.transaction_id)

      if (!error) {
        setAppliedItems(prev => new Set(prev).add(item.transaction_id))
      }
    } catch (error) {
      console.error('Error accepting suggestion:', error)
    } finally {
      setApplying(null)
    }
  }

  const rejectSuggestion = async (item: SkippedItem) => {
    setApplying(item.transaction_id)
    try {
      // Just clear the suggestion flags
      const { error } = await supabase
        .from('transactions')
        .update({
          ai_suggested_category: null,
          needs_review: false,
        })
        .eq('id', item.transaction_id)

      if (!error) {
        setRejectedItems(prev => new Set(prev).add(item.transaction_id))
      }
    } catch (error) {
      console.error('Error rejecting suggestion:', error)
    } finally {
      setApplying(null)
    }
  }

  const markAsReviewed = async () => {
    try {
      await fetch('/api/ai/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reportId, reviewed: true }),
      })
      setReport(prev => prev ? { ...prev, reviewed: true } : prev)
    } catch (error) {
      console.error('Error marking as reviewed:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="text-center py-16">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Report Not Found</h2>
          <p className="text-muted-foreground mt-2">This AI categorization report doesn't exist or has been deleted.</p>
          <Button onClick={() => router.back()} className="mt-6">
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  const pendingReview = report.skipped_items.filter(
    item => !appliedItems.has(item.transaction_id) && !rejectedItems.has(item.transaction_id)
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">AI Categorization Report</h1>
            {report.reviewed && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Reviewed
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            {new Date(report.created_at).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
            {' • '}
            {report.trigger_type === 'auto' ? 'Automatic sync' : 'Manual run'}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold">{report.transactions_found}</p>
            <p className="text-sm text-muted-foreground">Analyzed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-emerald-600">{report.transactions_categorized}</p>
            <p className="text-sm text-muted-foreground">Categorized</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-amber-600">{pendingReview.length}</p>
            <p className="text-sm text-muted-foreground">Need Review</p>
          </CardContent>
        </Card>
      </div>

      {/* Needs Review Section */}
      {report.skipped_items.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-lg">Needs Your Review</CardTitle>
              </div>
              {pendingReview.length === 0 && !report.reviewed && (
                <Button size="sm" onClick={markAsReviewed}>
                  Mark Complete
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              These transactions had low confidence scores. Review and accept or reject each suggestion.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.skipped_items.map((item) => {
                const isApplied = appliedItems.has(item.transaction_id)
                const isRejected = rejectedItems.has(item.transaction_id)
                const isProcessing = applying === item.transaction_id

                return (
                  <div
                    key={item.transaction_id}
                    className={`p-4 rounded-xl border transition-all ${
                      isApplied
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                        : isRejected
                        ? 'bg-muted/50 border-muted opacity-60'
                        : 'bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium truncate">{item.original_name}</p>
                          <span className="text-muted-foreground shrink-0">
                            ${Math.abs(item.amount).toFixed(2)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {new Date(item.date).toLocaleDateString()}
                          {item.current_category && (
                            <> • Currently: {formatCategory(item.current_category)}</>
                          )}
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <Sparkles className="h-4 w-4 text-purple-500" />
                          <span>
                            Suggested: <strong>{formatCategory(item.suggested_category)}</strong>
                          </span>
                          {item.suggested_name && (
                            <span className="text-emerald-600">→ {item.suggested_name}</span>
                          )}
                          <Badge variant="outline" className="ml-auto">
                            {item.confidence}% confident
                          </Badge>
                        </div>
                      </div>

                      {!isApplied && !isRejected && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 w-9 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => acceptSuggestion(item)}
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 w-9 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => rejectSuggestion(item)}
                            disabled={isProcessing}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}

                      {isApplied && (
                        <div className="flex items-center gap-2 text-emerald-600">
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="text-sm font-medium">Applied</span>
                        </div>
                      )}

                      {isRejected && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <X className="h-5 w-5" />
                          <span className="text-sm">Dismissed</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Successfully Categorized Section */}
      {report.categorized_items.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-lg">Successfully Categorized</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              These transactions were automatically categorized with high confidence.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {report.categorized_items.map((item) => (
                <div
                  key={item.transaction_id}
                  className="flex items-center justify-between py-3 border-b last:border-b-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {item.new_name || item.original_name}
                      </p>
                      {item.new_name && item.new_name !== item.original_name && (
                        <span className="text-xs text-muted-foreground">
                          (was: {item.original_name})
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatCategory(item.new_category)} • {item.confidence}% confident
                    </p>
                  </div>
                  <span className="text-sm font-medium tabular-nums">
                    ${Math.abs(item.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {report.categorized_items.length === 0 && report.skipped_items.length === 0 && (
        <div className="text-center py-16">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold">No Changes Made</h2>
          <p className="text-muted-foreground mt-2">
            AI didn't find any transactions to categorize in this run.
          </p>
        </div>
      )}
    </div>
  )
}
