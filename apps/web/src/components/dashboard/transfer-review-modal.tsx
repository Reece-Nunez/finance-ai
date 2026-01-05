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
  ArrowLeftRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { MerchantLogo } from '@/components/ui/merchant-logo'

interface Transfer {
  id: string
  name: string
  merchant_name: string | null
  display_name: string | null
  amount: number
  date: string
  category: string | null
  reason: string
}

interface TransferReviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: () => void
}

export function TransferReviewModal({
  open,
  onOpenChange,
  onComplete,
}: TransferReviewModalProps) {
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<{ success: boolean; count: number } | null>(null)
  const [expandedReasons, setExpandedReasons] = useState(false)

  useEffect(() => {
    if (open) {
      loadTransfers()
    }
  }, [open])

  const loadTransfers = async () => {
    setLoading(true)
    setResult(null)
    try {
      const response = await fetch('/api/transactions/transfers')
      if (response.ok) {
        const data = await response.json()
        setTransfers(data.potentialTransfers || [])
        // Pre-select all by default
        setSelectedIds(new Set(data.potentialTransfers?.map((t: Transfer) => t.id) || []))
      }
    } catch (error) {
      console.error('Error loading transfers:', error)
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
    setSelectedIds(new Set(transfers.map(t => t.id)))
  }

  const selectNone = () => {
    setSelectedIds(new Set())
  }

  const handleIgnoreSelected = async () => {
    if (selectedIds.size === 0) return

    setProcessing(true)
    try {
      const response = await fetch('/api/transactions/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionIds: Array.from(selectedIds),
          ignore: true,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setResult({ success: true, count: data.updated })
        // Remove ignored transactions from list
        setTransfers(prev => prev.filter(t => !selectedIds.has(t.id)))
        setSelectedIds(new Set())
        onComplete?.()
      } else {
        setResult({ success: false, count: 0 })
      }
    } catch (error) {
      console.error('Error ignoring transfers:', error)
      setResult({ success: false, count: 0 })
    } finally {
      setProcessing(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Group by reason for summary
  const reasonCounts = transfers.reduce((acc, t) => {
    acc[t.reason] = (acc[t.reason] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Review Potential Transfers
          </DialogTitle>
          <DialogDescription>
            We detected transactions that look like internal transfers between your accounts.
            Select the ones you want to ignore from your spending and budgets.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : result?.success ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" />
            <p className="text-lg font-medium">
              {result.count} transaction{result.count !== 1 ? 's' : ''} ignored
            </p>
            <p className="text-muted-foreground mt-1">
              {transfers.length > 0
                ? `${transfers.length} more to review`
                : 'All detected transfers have been processed'}
            </p>
            {transfers.length > 0 ? (
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
        ) : transfers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-4" />
            <p className="text-lg font-medium">No transfers detected</p>
            <p className="text-muted-foreground mt-1">
              Your transactions look clean!
            </p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-3 mb-2">
              <div className="flex items-center justify-between">
                <p className="text-sm">
                  Found <span className="font-semibold">{transfers.length}</span> potential transfers
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedReasons(!expandedReasons)}
                  className="h-7 px-2"
                >
                  {expandedReasons ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {expandedReasons && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(reasonCounts).map(([reason, count]) => (
                    <Badge key={reason} variant="secondary" className="text-xs">
                      {reason}: {count}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Selection controls */}
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size === transfers.length && transfers.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) selectAll()
                    else selectNone()
                  }}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size} of {transfers.length} selected
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

            {/* Transaction list */}
            <div className="flex-1 min-h-0 -mx-6 overflow-y-auto max-h-[50vh]">
              <div className="space-y-1 py-2 px-6">
                {transfers.map((tx) => {
                  const isSelected = selectedIds.has(tx.id)
                  const displayName = tx.display_name || tx.merchant_name || tx.name
                  const isIncome = tx.amount < 0

                  return (
                    <button
                      key={tx.id}
                      onClick={() => toggleSelect(tx.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800'
                          : 'hover:bg-muted/50 border border-transparent'
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(tx.id)}
                        onClick={(e) => e.stopPropagation()}
                      />

                      <MerchantLogo
                        merchantName={tx.merchant_name || tx.name}
                        category={tx.category}
                        size="sm"
                      />

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(tx.date)} · {tx.reason}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className={`font-semibold ${isIncome ? 'text-emerald-600' : ''}`}>
                          {isIncome ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t mt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleIgnoreSelected}
                disabled={selectedIds.size === 0 || processing}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Ignore ${selectedIds.size} Transaction${selectedIds.size !== 1 ? 's' : ''}`
                )}
              </Button>
            </div>
          </>
        )}

        {result && !result.success && (
          <div className="flex items-center gap-2 text-red-500 text-sm mt-2">
            <AlertCircle className="h-4 w-4" />
            Failed to ignore transactions. Please try again.
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
