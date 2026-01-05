'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Calendar,
  Clock,
  DollarSign,
  Repeat,
  ChevronDown,
  ChevronUp,
  Banknote,
  Pencil,
  FileText,
  Wand2,
  Check,
  X,
  EyeOff,
  CreditCard,
  Split,
} from 'lucide-react'
import { SterlingIcon } from '@/components/ui/sterling-icon'
import { CategorySelector } from './category-selector'
import { MerchantLogo } from '@/components/ui/merchant-logo'

interface AccountInfo {
  name: string
  official_name: string | null
  institution_name: string | null
  mask: string | null
}

interface Transaction {
  id: string
  name: string
  merchant_name: string | null
  amount: number
  date: string
  category: string | null
  pending: boolean
  is_income?: boolean
  ignore_type?: 'none' | 'budget' | 'all'
  display_name?: string | null
  plaid_account_id?: string
}

interface TransactionDetailProps {
  transaction: Transaction | null
  allTransactions: Transaction[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate?: (id: string, updates: Partial<Transaction>) => void
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function formatCategory(category: string | null): string {
  if (!category) return 'Uncategorized'
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface RecurringAnalysis {
  isRecurring: boolean
  confidence: 'high' | 'medium' | 'low'
  frequency: string | null
  averageAmount: number
  occurrences: number
  reason: string
}

function analyzeRecurringPattern(
  transaction: Transaction,
  history: Transaction[]
): RecurringAnalysis {
  if (history.length < 2) {
    return {
      isRecurring: false,
      confidence: 'low',
      frequency: null,
      averageAmount: Math.abs(transaction.amount),
      occurrences: 1,
      reason: 'Not enough transaction history to determine pattern',
    }
  }

  const sorted = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const intervals: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].date)
    const curr = new Date(sorted[i].date)
    const daysDiff = Math.round(
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    )
    intervals.push(daysDiff)
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length

  const amounts = history.map((t) => Math.abs(t.amount))
  const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length
  const amountVariance =
    amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) /
    amounts.length
  const amountStdDev = Math.sqrt(amountVariance)
  const amountConsistent = amountStdDev / avgAmount < 0.15

  const intervalVariance =
    intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) /
    intervals.length
  const intervalStdDev = Math.sqrt(intervalVariance)
  const intervalConsistent = intervalStdDev < 7

  let frequency: string | null = null
  if (avgInterval <= 8) frequency = 'weekly'
  else if (avgInterval <= 16) frequency = 'bi-weekly'
  else if (avgInterval <= 35) frequency = 'monthly'
  else if (avgInterval <= 95) frequency = 'quarterly'
  else if (avgInterval <= 370) frequency = 'yearly'

  let isRecurring = false
  let confidence: 'high' | 'medium' | 'low' = 'low'
  let reason = ''

  if (amountConsistent && intervalConsistent && history.length >= 3) {
    isRecurring = true
    confidence = 'high'
    reason = `Consistent ${frequency} payments of ~${formatCurrency(avgAmount)}`
  } else if (amountConsistent && history.length >= 3) {
    isRecurring = true
    confidence = 'medium'
    reason = `Similar amounts (~${formatCurrency(avgAmount)}) but varying schedule`
  } else if (intervalConsistent && history.length >= 3) {
    isRecurring = true
    confidence = 'medium'
    reason = `Regular ${frequency} schedule but amounts vary`
  } else if (history.length >= 4) {
    isRecurring = true
    confidence = 'low'
    reason = 'Multiple occurrences but inconsistent pattern'
  } else {
    reason = 'Not enough evidence of recurring pattern'
  }

  return {
    isRecurring,
    confidence,
    frequency,
    averageAmount: avgAmount,
    occurrences: history.length,
    reason,
  }
}

export function TransactionDetail({
  transaction,
  allTransactions,
  open,
  onOpenChange,
  onUpdate,
}: TransactionDetailProps) {
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [showRuleCreator, setShowRuleCreator] = useState(false)
  const [rulePattern, setRulePattern] = useState('')
  const [ruleName, setRuleName] = useState('')
  const [ruleSetAsIncome, setRuleSetAsIncome] = useState(false)
  const [ruleSetAsIgnored, setRuleSetAsIgnored] = useState(false)
  const [creatingRule, setCreatingRule] = useState(false)

  // Account info state
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null)

  // Date editing state
  const [isEditingDate, setIsEditingDate] = useState(false)
  const [editedDate, setEditedDate] = useState('')

  // Split transaction state
  const [showSplitModal, setShowSplitModal] = useState(false)
  const [splitMode, setSplitMode] = useState<'specific' | 'equal' | 'percentage'>('specific')
  const [splitCount, setSplitCount] = useState(2)
  const [splitAmounts, setSplitAmounts] = useState<number[]>([])
  const [splitPercentages, setSplitPercentages] = useState<number[]>([])
  const [splitCategories, setSplitCategories] = useState<string[]>([])

  // Fetch account info when transaction changes
  useEffect(() => {
    const fetchAccountInfo = async () => {
      if (!transaction?.plaid_account_id) return
      try {
        const response = await fetch(`/api/accounts?account_id=${transaction.plaid_account_id}`)
        if (response.ok) {
          const data = await response.json()
          if (data.account) {
            setAccountInfo(data.account)
          }
        }
      } catch (error) {
        console.error('Error fetching account info:', error)
      }
    }

    if (open && transaction) {
      fetchAccountInfo()
      setEditedDate(transaction.date)
    }
  }, [transaction, open])

  // Find similar transactions (same merchant/name pattern)
  const transactionHistory = useMemo(() => {
    if (!transaction) return []

    const searchKey = transaction.merchant_name || transaction.name
    return allTransactions
      .filter((t) => {
        const key = t.merchant_name || t.name
        return (
          key.toLowerCase() === searchKey.toLowerCase() &&
          t.id !== transaction.id
        )
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [transaction, allTransactions])

  const analysis = useMemo(() => {
    if (!transaction) return null
    const allOccurrences = [transaction, ...transactionHistory]
    return analyzeRecurringPattern(transaction, allOccurrences)
  }, [transaction, transactionHistory])

  const displayedHistory = showAllHistory
    ? transactionHistory
    : transactionHistory.slice(0, 5)

  const isIncome = transaction && transaction.amount < 0

  // Get the display name (custom or original)
  const displayName = transaction?.display_name || transaction?.merchant_name || transaction?.name || ''

  const handleStartEditing = () => {
    setEditedName(displayName)
    setIsEditingName(true)
  }

  const handleSaveName = async () => {
    if (!transaction || !onUpdate) return
    setIsUpdating(true)
    try {
      await onUpdate(transaction.id, { display_name: editedName } as Partial<Transaction>)
      setIsEditingName(false)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancelEdit = () => {
    setIsEditingName(false)
    setEditedName('')
  }

  const handleMarkAsIncome = async () => {
    if (!transaction || !onUpdate) return
    setIsUpdating(true)
    try {
      await onUpdate(transaction.id, { is_income: true })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleStartRuleCreation = () => {
    // Pre-fill with a pattern from the transaction name
    const name = transaction?.name || ''
    // Try to extract a meaningful pattern (e.g., company name)
    const words = name.split(' ')
    // Use the first few words as default pattern
    const defaultPattern = words.slice(0, 3).join(' ')
    setRulePattern(defaultPattern)
    setRuleName(editedName || displayName)
    setRuleSetAsIncome(isIncome || false)
    setRuleSetAsIgnored(false)
    setShowRuleCreator(true)
  }

  const handleCreateRule = async () => {
    if (!rulePattern || (!ruleName && !ruleSetAsIgnored)) return
    setCreatingRule(true)
    try {
      const response = await fetch('/api/transaction-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_field: 'name',
          match_pattern: rulePattern,
          display_name: ruleSetAsIgnored ? null : ruleName,
          set_as_income: ruleSetAsIncome,
          set_as_ignored: ruleSetAsIgnored,
          description: ruleSetAsIgnored
            ? `Auto-ignore transactions matching "${rulePattern}"`
            : `Auto-rename "${rulePattern}" to "${ruleName}"`,
          apply_to_existing: true,
        }),
      })
      if (response.ok) {
        setShowRuleCreator(false)
        // Refresh the page to see updated transactions
        window.location.reload()
      }
    } catch (error) {
      console.error('Error creating rule:', error)
    } finally {
      setCreatingRule(false)
    }
  }

  const handleCategoryChange = async (category: string) => {
    if (!transaction || !onUpdate) return
    await onUpdate(transaction.id, { category } as Partial<Transaction>)
  }

  const handleIgnoreChange = async (ignoreType: 'none' | 'budget' | 'all') => {
    if (!transaction || !onUpdate) return
    setIsUpdating(true)
    try {
      await onUpdate(transaction.id, { ignore_type: ignoreType } as Partial<Transaction>)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleStartEditingDate = () => {
    setEditedDate(transaction?.date || '')
    setIsEditingDate(true)
  }

  const handleSaveDate = async () => {
    if (!transaction || !onUpdate || !editedDate) return
    setIsUpdating(true)
    try {
      await onUpdate(transaction.id, { date: editedDate } as Partial<Transaction>)
      setIsEditingDate(false)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancelDateEdit = () => {
    setIsEditingDate(false)
    setEditedDate(transaction?.date || '')
  }

  const initializeSplit = () => {
    if (!transaction) return
    const amount = Math.abs(transaction.amount)
    setSplitAmounts([amount / 2, amount / 2])
    setSplitPercentages([50, 50])
    setSplitCategories([transaction.category || '', ''])
    setSplitCount(2)
    setShowSplitModal(true)
  }

  const handleSplitCountChange = (count: number) => {
    if (!transaction) return
    const amount = Math.abs(transaction.amount)
    setSplitCount(count)

    if (splitMode === 'equal') {
      const equalAmount = amount / count
      setSplitAmounts(Array(count).fill(equalAmount))
    } else if (splitMode === 'percentage') {
      const equalPercent = 100 / count
      setSplitPercentages(Array(count).fill(equalPercent))
      setSplitAmounts(Array(count).fill(amount / count))
    } else {
      // Specific - redistribute remaining amount
      const newAmounts = Array(count).fill(0)
      newAmounts[0] = amount
      setSplitAmounts(newAmounts)
    }
    setSplitCategories(Array(count).fill(transaction.category || ''))
  }

  const updateSplitAmount = (index: number, value: number) => {
    const newAmounts = [...splitAmounts]
    newAmounts[index] = value
    setSplitAmounts(newAmounts)
  }

  const updateSplitPercentage = (index: number, value: number) => {
    if (!transaction) return
    const amount = Math.abs(transaction.amount)
    const newPercentages = [...splitPercentages]
    newPercentages[index] = value
    setSplitPercentages(newPercentages)
    setSplitAmounts(newPercentages.map(p => (p / 100) * amount))
  }

  const updateSplitCategory = (index: number, category: string) => {
    const newCategories = [...splitCategories]
    newCategories[index] = category
    setSplitCategories(newCategories)
  }

  const [isSavingSplit, setIsSavingSplit] = useState(false)

  const handleSaveSplit = async () => {
    if (!transaction) return

    const splits = splitAmounts.map((amount, idx) => ({
      amount,
      category: splitCategories[idx] || ''
    }))

    setIsSavingSplit(true)
    try {
      const response = await fetch('/api/transactions/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: transaction.id,
          splits
        })
      })

      if (response.ok) {
        setShowSplitModal(false)
        // Refresh to show updated transactions
        window.location.reload()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to split transaction')
      }
    } catch (error) {
      console.error('Error splitting transaction:', error)
      alert('Failed to split transaction')
    } finally {
      setIsSavingSplit(false)
    }
  }

  if (!transaction) return null

  // Format account info string
  const accountInfoString = accountInfo
    ? `${accountInfo.name}${accountInfo.institution_name ? ` | ${accountInfo.institution_name}` : ''}${accountInfo.mask ? ` | ****${accountInfo.mask}` : ''}`
    : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="space-y-4">
          {/* Amount Header */}
          <div className="flex flex-col items-center pt-4">
            <div className="mb-3">
              <MerchantLogo
                merchantName={transaction.merchant_name || transaction.name}
                category={transaction.category}
                size="lg"
                className="h-16 w-16"
              />
            </div>
            <SheetTitle
              className={`text-3xl font-bold ${
                isIncome ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {isIncome ? '+' : '-'}
              {formatCurrency(Math.abs(transaction.amount))}
            </SheetTitle>

            {/* Editable Name */}
            {isEditingName ? (
              <div className="mt-2 flex w-full items-center gap-2">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="text-center"
                  placeholder="Enter custom name"
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleSaveName}
                  disabled={isUpdating}
                >
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleCancelEdit}
                >
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <p className="text-lg text-muted-foreground">{displayName}</p>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={handleStartEditing}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            )}

            {transaction.pending && (
              <Badge variant="outline" className="mt-2">
                <Clock className="mr-1 h-3 w-3" />
                Pending
              </Badge>
            )}
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Account Info */}
          {accountInfoString && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <CreditCard className="h-3 w-3" />
                Account
              </div>
              <p className="text-sm font-medium">{accountInfoString}</p>
            </div>
          )}

          {/* Original Transaction Description */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              Original Description
            </div>
            <p className="text-sm font-mono break-all">{transaction.name}</p>
          </div>

          {/* Rule Creator */}
          {showRuleCreator ? (
            <div className="rounded-lg border border-emerald-500 bg-emerald-50 p-4 dark:bg-emerald-950/30">
              <div className="mb-3 flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-emerald-600" />
                <span className="font-semibold">Create Renaming Rule</span>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm">When description contains:</Label>
                  <Input
                    value={rulePattern}
                    onChange={(e) => setRulePattern(e.target.value)}
                    placeholder="e.g., Phillips 66"
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Transactions matching this pattern will be renamed
                  </p>
                </div>
                <div>
                  <Label className="text-sm">Rename to:</Label>
                  <Input
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="e.g., Paycheck"
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Mark as recurring income</Label>
                  <Switch
                    checked={ruleSetAsIncome}
                    onCheckedChange={(checked) => {
                      setRuleSetAsIncome(checked)
                      if (checked) setRuleSetAsIgnored(false)
                    }}
                    disabled={ruleSetAsIgnored}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Ignore (internal transfer)</Label>
                  <Switch
                    checked={ruleSetAsIgnored}
                    onCheckedChange={(checked) => {
                      setRuleSetAsIgnored(checked)
                      if (checked) setRuleSetAsIncome(false)
                    }}
                    disabled={ruleSetAsIncome}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                    onClick={handleCreateRule}
                    disabled={creatingRule || !rulePattern || (!ruleName && !ruleSetAsIgnored)}
                  >
                    {creatingRule ? 'Creating...' : 'Create Rule'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowRuleCreator(false)}
                  >
                    Cancel
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This will also apply to all existing matching transactions
                </p>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleStartRuleCreation}
            >
              <Wand2 className="mr-2 h-4 w-4" />
              Create Auto-Rename Rule
            </Button>
          )}

          {/* AI Analysis Card */}
          {analysis && (
            <div className="rounded-lg border bg-gradient-to-br from-emerald-50 to-teal-50 p-4 dark:from-emerald-950/30 dark:to-teal-950/30">
              <div className="mb-3 flex items-center gap-2">
                <SterlingIcon size="md" />
                <span className="font-semibold">AI Analysis</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Pattern Detected
                  </span>
                  <Badge
                    variant={analysis.isRecurring ? 'default' : 'secondary'}
                    className={
                      analysis.isRecurring
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : ''
                    }
                  >
                    {analysis.isRecurring ? (
                      <>
                        <Repeat className="mr-1 h-3 w-3" />
                        {analysis.frequency
                          ? analysis.frequency.charAt(0).toUpperCase() +
                            analysis.frequency.slice(1)
                          : 'Recurring'}
                      </>
                    ) : (
                      'One-time'
                    )}
                  </Badge>
                </div>
                {analysis.isRecurring && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Confidence
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        analysis.confidence === 'high'
                          ? 'border-green-500 text-green-600'
                          : analysis.confidence === 'medium'
                            ? 'border-yellow-500 text-yellow-600'
                            : 'border-gray-500 text-gray-600'
                      }
                    >
                      {analysis.confidence.charAt(0).toUpperCase() +
                        analysis.confidence.slice(1)}
                    </Badge>
                  </div>
                )}
                <p className="mt-2 text-sm text-muted-foreground">
                  {analysis.reason}
                </p>
                {analysis.occurrences > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Based on {analysis.occurrences} transactions
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Transaction Details */}
          <div className="space-y-3">
            <h3 className="font-semibold">Details</h3>
            <div className="space-y-2">
              {/* Date - Editable */}
              {isEditingDate ? (
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-1">Date</p>
                    <Input
                      type="date"
                      value={editedDate}
                      onChange={(e) => setEditedDate(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleSaveDate}
                    disabled={isUpdating}
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleCancelDateEdit}
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">{formatDate(transaction.date)}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={handleStartEditingDate}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* Category Selector */}
              <CategorySelector
                value={transaction.category}
                onChange={handleCategoryChange}
                disabled={isUpdating}
              />

              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">
                    {isIncome ? 'Income / Deposit' : 'Expense / Withdrawal'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Split Transaction */}
          {!showSplitModal ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={initializeSplit}
            >
              <Split className="mr-2 h-4 w-4" />
              Split Transaction
            </Button>
          ) : (
            <div className="rounded-lg border border-blue-500 bg-blue-50 p-4 dark:bg-blue-950/30">
              <div className="mb-3 flex items-center gap-2">
                <Split className="h-5 w-5 text-blue-600" />
                <span className="font-semibold">Split Transaction</span>
              </div>

              {/* Split Mode Tabs */}
              <Tabs value={splitMode} onValueChange={(v) => {
                setSplitMode(v as 'specific' | 'equal' | 'percentage')
                if (v === 'equal') {
                  const equalAmount = Math.abs(transaction.amount) / splitCount
                  setSplitAmounts(Array(splitCount).fill(equalAmount))
                } else if (v === 'percentage') {
                  const equalPercent = 100 / splitCount
                  setSplitPercentages(Array(splitCount).fill(equalPercent))
                }
              }}>
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="specific">Specific</TabsTrigger>
                  <TabsTrigger value="equal">Equal</TabsTrigger>
                  <TabsTrigger value="percentage">Percentage</TabsTrigger>
                </TabsList>

                <div className="mb-4">
                  <Label className="text-sm">Number of splits</Label>
                  <div className="flex gap-2 mt-1">
                    {[2, 3, 4, 5].map((count) => (
                      <Button
                        key={count}
                        size="sm"
                        variant={splitCount === count ? 'default' : 'outline'}
                        onClick={() => handleSplitCountChange(count)}
                      >
                        {count}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  {Array.from({ length: splitCount }).map((_, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground w-6">{idx + 1}.</span>
                      {splitMode === 'percentage' ? (
                        <div className="flex items-center gap-1 w-20">
                          <Input
                            type="number"
                            value={splitPercentages[idx] || 0}
                            onChange={(e) => updateSplitPercentage(idx, parseFloat(e.target.value) || 0)}
                            className="h-8 w-16"
                          />
                          <span className="text-sm">%</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 w-24">
                          <span className="text-sm">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={splitAmounts[idx]?.toFixed(2) || '0.00'}
                            onChange={(e) => updateSplitAmount(idx, parseFloat(e.target.value) || 0)}
                            className="h-8"
                            disabled={splitMode === 'equal'}
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <CategorySelector
                          value={splitCategories[idx]}
                          onChange={(cat) => updateSplitCategory(idx, cat)}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-sm text-muted-foreground mb-4">
                  Total: {formatCurrency(splitAmounts.reduce((a, b) => a + b, 0))} / {formatCurrency(Math.abs(transaction.amount))}
                  {Math.abs(splitAmounts.reduce((a, b) => a + b, 0) - Math.abs(transaction.amount)) > 0.01 && (
                    <span className="text-amber-600 ml-2">
                      (Difference: {formatCurrency(Math.abs(splitAmounts.reduce((a, b) => a + b, 0) - Math.abs(transaction.amount)))})
                    </span>
                  )}
                </div>
              </Tabs>

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                  disabled={Math.abs(splitAmounts.reduce((a, b) => a + b, 0) - Math.abs(transaction.amount)) > 0.01 || isSavingSplit}
                  onClick={handleSaveSplit}
                >
                  {isSavingSplit ? 'Splitting...' : 'Save Split'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSplitModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Ignore Options */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Ignore Transaction</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleIgnoreChange('none')}
                disabled={isUpdating}
                className={`rounded-lg border p-2 text-center text-sm transition-colors ${
                  (!transaction.ignore_type || transaction.ignore_type === 'none')
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                    : 'hover:bg-muted'
                }`}
              >
                Don&apos;t Ignore
              </button>
              <button
                onClick={() => handleIgnoreChange('budget')}
                disabled={isUpdating}
                className={`rounded-lg border p-2 text-center text-sm transition-colors ${
                  transaction.ignore_type === 'budget'
                    ? 'border-yellow-500 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400'
                    : 'hover:bg-muted'
                }`}
              >
                From Budget
              </button>
              <button
                onClick={() => handleIgnoreChange('all')}
                disabled={isUpdating}
                className={`rounded-lg border p-2 text-center text-sm transition-colors ${
                  transaction.ignore_type === 'all'
                    ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                    : 'hover:bg-muted'
                }`}
              >
                From All
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {transaction.ignore_type === 'budget'
                ? 'This transaction is hidden from budget calculations'
                : transaction.ignore_type === 'all'
                  ? 'This transaction is hidden from all reports'
                  : 'This transaction is included in all reports'}
            </p>
          </div>

          {/* Mark as Income button for deposits */}
          {isIncome && !transaction.is_income && onUpdate && (
            <Button
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
              onClick={handleMarkAsIncome}
              disabled={isUpdating}
            >
              <Banknote className="mr-2 h-4 w-4" />
              {isUpdating ? 'Saving...' : 'Mark as Recurring Income (Payday)'}
            </Button>
          )}

          {transaction.is_income && (
            <div className="rounded-lg border border-green-500 bg-green-50 p-3 dark:bg-green-950/30">
              <div className="flex items-center gap-2 text-green-600">
                <Banknote className="h-5 w-5" />
                <span className="font-medium">
                  This is marked as recurring income
                </span>
              </div>
            </div>
          )}

          {/* Transaction History */}
          {transactionHistory.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  Transaction History ({transactionHistory.length})
                </h3>
              </div>
              <div className="space-y-2">
                {displayedHistory.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {formatShortDate(tx.date)}
                      </p>
                    </div>
                    <p
                      className={`font-semibold ${
                        tx.amount < 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {tx.amount < 0 ? '+' : '-'}
                      {formatCurrency(Math.abs(tx.amount))}
                    </p>
                  </div>
                ))}
                {transactionHistory.length > 5 && (
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => setShowAllHistory(!showAllHistory)}
                  >
                    {showAllHistory ? (
                      <>
                        <ChevronUp className="mr-2 h-4 w-4" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="mr-2 h-4 w-4" />
                        Show All ({transactionHistory.length - 5} more)
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}

          {transactionHistory.length === 0 && (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              No other transactions found for this merchant
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
