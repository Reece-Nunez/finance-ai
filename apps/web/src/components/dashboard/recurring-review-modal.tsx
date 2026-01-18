'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
} from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { MerchantLogo } from '@/components/ui/merchant-logo'

interface RecurringSuggestion {
  id: string
  name: string
  display_name: string | null
  merchant_pattern: string
  frequency: string | null
  amount: number | null
  average_amount: number | null
  is_income: boolean
  category: string | null
  confidence: string
  occurrences: number
  bill_type: string | null
  detection_reason: string | null
}

interface RecurringReviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: () => void
}

const DENIAL_REASONS = [
  { value: 'not_recurring', label: 'Not a recurring payment' },
  { value: 'one_time', label: 'One-time purchase' },
  { value: 'discretionary', label: 'Regular shopping, not a bill' },
  { value: 'incorrect_frequency', label: 'Wrong frequency detected' },
  { value: 'incorrect_amount', label: 'Wrong amount' },
  { value: 'duplicate', label: 'Already tracking this differently' },
  { value: 'other', label: 'Other reason' },
]

export function RecurringReviewModal({
  open,
  onOpenChange,
  onComplete,
}: RecurringReviewModalProps) {
  const [suggestions, setSuggestions] = useState<RecurringSuggestion[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<{ success: boolean; action: string; count: number } | null>(null)
  const [expandedDetails, setExpandedDetails] = useState(false)
  const [denialReason, setDenialReason] = useState<string>('not_recurring')

  useEffect(() => {
    if (open) {
      loadSuggestions()
    }
  }, [open])

  const loadSuggestions = async () => {
    setLoading(true)
    setResult(null)
    try {
      const response = await fetch('/api/recurring/review')
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.suggestions || [])
        // Pre-select high confidence suggestions
        const highConfidence = (data.suggestions || [])
          .filter((s: RecurringSuggestion) => s.confidence === 'high')
          .map((s: RecurringSuggestion) => s.id)
        setSelectedIds(new Set(highConfidence))
      }
    } catch (error) {
      console.error('Error loading suggestions:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const selectAll = () => {
    setSelectedIds(new Set(suggestions.map(s => s.id)))
  }

  const selectNone = () => {
    setSelectedIds(new Set())
  }

  const handleAction = async (action: 'confirm' | 'deny') => {
    if (selectedIds.size === 0) return

    setProcessing(true)
    try {
      const response = await fetch('/api/recurring/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          action,
          denial_reason: action === 'deny' ? denialReason : undefined,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const count = action === 'confirm' ? data.confirmed : data.denied
        setResult({ success: true, action, count })
        // Remove processed suggestions from list
        setSuggestions(prev => prev.filter(s => !selectedIds.has(s.id)))
        setSelectedIds(new Set())
        onComplete?.()
      } else {
        setResult({ success: false, action, count: 0 })
      }
    } catch (error) {
      console.error(`Error ${action}ing suggestions:`, error)
      setResult({ success: false, action, count: 0 })
    } finally {
      setProcessing(false)
    }
  }

  const formatFrequency = (freq: string | null) => {
    if (!freq) return 'unknown'
    return freq.charAt(0).toUpperCase() + freq.slice(1)
  }

  // Group by confidence for summary
  const confidenceCounts = suggestions.reduce((acc, s) => {
    acc[s.confidence] = (acc[s.confidence] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Review Recurring Suggestions
          </DialogTitle>
          <DialogDescription>
            AI detected these potential recurring transactions. Review and confirm the ones that are actual bills/subscriptions.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : result?.success ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            {result.action === 'confirm' ? (
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" />
            ) : (
              <XCircle className="h-12 w-12 text-red-500 mb-4" />
            )}
            <p className="text-lg font-medium">
              {result.count} suggestion{result.count !== 1 ? 's' : ''} {result.action === 'confirm' ? 'confirmed' : 'denied'}
            </p>
            <p className="text-muted-foreground mt-1">
              {suggestions.length > 0
                ? `${suggestions.length} more to review`
                : 'All suggestions have been processed'}
            </p>
            {suggestions.length > 0 ? (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setResult(null)}
              >
                Review Remaining
              </Button>
            ) : (
              <Button
                className="mt-4"
                onClick={() => onOpenChange(false)}
              >
                Done
              </Button>
            )}
          </div>
        ) : suggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" />
            <p className="text-lg font-medium">No suggestions to review</p>
            <p className="text-muted-foreground mt-1">
              All caught up! Run AI detection to find more recurring transactions.
            </p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-3 mb-2">
              <div className="flex items-center justify-between">
                <p className="text-sm">
                  <span className="font-semibold">{suggestions.length}</span> suggestions to review
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedDetails(!expandedDetails)}
                  className="h-7 px-2"
                >
                  {expandedDetails ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {expandedDetails && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(confidenceCounts).map(([confidence, count]) => (
                    <Badge
                      key={confidence}
                      variant={confidence === 'high' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {confidence}: {count}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Selection controls */}
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size === suggestions.length && suggestions.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) selectAll()
                    else selectNone()
                  }}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size} of {suggestions.length} selected
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={selectNone}>
                  Select None
                </Button>
              </div>
            </div>

            {/* Suggestion list */}
            <div className="flex-1 min-h-0 -mx-6 overflow-y-auto max-h-[40vh]">
              <div className="space-y-1 py-2 px-6">
                {suggestions.map((suggestion) => {
                  const isSelected = selectedIds.has(suggestion.id)
                  const displayName = suggestion.display_name || suggestion.name

                  return (
                    <button
                      key={suggestion.id}
                      onClick={() => toggleSelect(suggestion.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800'
                          : 'hover:bg-muted/50 border border-transparent'
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(suggestion.id)}
                        onClick={(e) => e.stopPropagation()}
                      />

                      <MerchantLogo
                        merchantName={suggestion.name}
                        category={suggestion.category}
                        size="sm"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{displayName}</p>
                          <Badge
                            variant={suggestion.confidence === 'high' ? 'default' : 'secondary'}
                            className="text-xs shrink-0"
                          >
                            {suggestion.confidence}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatFrequency(suggestion.frequency)}</span>
                          {suggestion.bill_type && (
                            <>
                              <span>·</span>
                              <span>{suggestion.bill_type}</span>
                            </>
                          )}
                          {suggestion.occurrences > 0 && (
                            <>
                              <span>·</span>
                              <span>{suggestion.occurrences} occurrences</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className={`font-semibold ${suggestion.is_income ? 'text-emerald-600' : ''}`}>
                          {suggestion.is_income ? '+' : ''}{formatCurrency(Math.abs(suggestion.average_amount || suggestion.amount || 0))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          avg/month
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Denial reason selector */}
            <div className="py-3 border-t">
              <label htmlFor="denial-reason" className="text-sm text-muted-foreground block mb-2">
                If denying, select reason:
              </label>
              <Select value={denialReason} onValueChange={setDenialReason}>
                <SelectTrigger id="denial-reason" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DENIAL_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="destructive"
                onClick={() => handleAction('deny')}
                disabled={selectedIds.size === 0 || processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Deny Selected ({selectedIds.size})
                  </>
                )}
              </Button>
              <Button
                onClick={() => handleAction('confirm')}
                disabled={selectedIds.size === 0 || processing}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Confirm Selected ({selectedIds.size})
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {result && !result.success && (
          <div className="flex items-center gap-2 text-red-500 text-sm mt-2">
            <AlertCircle className="h-4 w-4" />
            Failed to process suggestions. Please try again.
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
