'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DollarSign,
  Briefcase,
  Building2,
  PiggyBank,
  TrendingUp,
  Home,
  Plus,
  MoreVertical,
  Trash2,
  Pencil,
  History,
  Loader2,
  Zap,
  Check,
  AlertCircle,
  Calendar,
  RefreshCw,
  Banknote,
} from 'lucide-react'
import { toast } from 'sonner'
import { MerchantLogo } from '@/components/ui/merchant-logo'

// Income type configuration
const INCOME_TYPES = {
  payroll: {
    label: 'Payroll',
    description: 'Employment salary & wages',
    icon: Briefcase,
    color: 'emerald',
    bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    iconBg: 'bg-emerald-500',
  },
  government: {
    label: 'Government',
    description: 'Social Security, benefits',
    icon: Building2,
    color: 'blue',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    textClass: 'text-blue-700 dark:text-blue-300',
    iconBg: 'bg-blue-500',
  },
  retirement: {
    label: 'Retirement',
    description: 'Pension, 401k distributions',
    icon: PiggyBank,
    color: 'purple',
    bgClass: 'bg-purple-100 dark:bg-purple-900/30',
    textClass: 'text-purple-700 dark:text-purple-300',
    iconBg: 'bg-purple-500',
  },
  self_employment: {
    label: 'Self-Employment',
    description: 'Freelance, gig work',
    icon: TrendingUp,
    color: 'orange',
    bgClass: 'bg-orange-100 dark:bg-orange-900/30',
    textClass: 'text-orange-700 dark:text-orange-300',
    iconBg: 'bg-orange-500',
  },
  investment: {
    label: 'Investment',
    description: 'Dividends, interest',
    icon: TrendingUp,
    color: 'cyan',
    bgClass: 'bg-cyan-100 dark:bg-cyan-900/30',
    textClass: 'text-cyan-700 dark:text-cyan-300',
    iconBg: 'bg-cyan-500',
  },
  rental: {
    label: 'Rental',
    description: 'Rent payments received',
    icon: Home,
    color: 'amber',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
    textClass: 'text-amber-700 dark:text-amber-300',
    iconBg: 'bg-amber-500',
  },
  other: {
    label: 'Other',
    description: 'Miscellaneous income',
    icon: DollarSign,
    color: 'gray',
    bgClass: 'bg-gray-100 dark:bg-gray-900/30',
    textClass: 'text-gray-700 dark:text-gray-300',
    iconBg: 'bg-gray-500',
  },
}

const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly', multiplier: 52 },
  { value: 'bi-weekly', label: 'Bi-weekly', multiplier: 26 },
  { value: 'semi-monthly', label: 'Semi-monthly', multiplier: 24 },
  { value: 'monthly', label: 'Monthly', multiplier: 12 },
  { value: 'quarterly', label: 'Quarterly', multiplier: 4 },
  { value: 'yearly', label: 'Yearly', multiplier: 1 },
  { value: 'irregular', label: 'Irregular/Project-based', multiplier: 0 },
]

interface IncomeSource {
  id: string
  name: string
  display_name: string
  income_type: keyof typeof INCOME_TYPES
  merchant_pattern: string
  amount: number
  average_amount: number
  frequency: string
  pay_day: number | null
  next_expected_date: string | null
  last_received_date: string | null
  employer_name: string | null
  occurrences: number
  total_received: number
  confidence: string
  is_verified: boolean
  recentTransactions?: Array<{
    id: string
    name: string
    amount: number
    date: string
  }>
}

interface DetectedSource {
  name: string
  merchantPattern: string
  incomeType: string
  amount: number
  frequency: string
  occurrences: number
  lastDate: string
  confidence: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A'
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getYearlyAmount(amount: number, frequency: string): number {
  const freq = FREQUENCIES.find(f => f.value === frequency)
  return amount * (freq?.multiplier || 12)
}

function getMonthlyAmount(amount: number, frequency: string): number {
  return getYearlyAmount(amount, frequency) / 12
}

// Income Source Card
function IncomeSourceCard({
  source,
  onEdit,
  onViewHistory,
  onDelete,
}: {
  source: IncomeSource
  onEdit: () => void
  onViewHistory: () => void
  onDelete: () => void
}) {
  const config = INCOME_TYPES[source.income_type] || INCOME_TYPES.other
  const Icon = config.icon
  const monthlyAmount = getMonthlyAmount(source.amount, source.frequency)
  const yearlyAmount = getYearlyAmount(source.amount, source.frequency)

  // Don't calculate days for irregular income or far-future placeholder dates
  const daysUntilNext = source.next_expected_date &&
    source.frequency !== 'irregular' &&
    !source.next_expected_date.startsWith('9999')
    ? Math.ceil((new Date(source.next_expected_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <Card className="overflow-hidden">
      <div className={`h-1 ${config.iconBg}`} />
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`rounded-lg p-2 ${config.bgClass}`}>
              <Icon className={`h-5 w-5 ${config.textClass}`} />
            </div>
            <div>
              <h3 className="font-semibold">{source.display_name || source.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {config.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {FREQUENCIES.find(f => f.value === source.frequency)?.label}
                </span>
              </div>
              {source.employer_name && (
                <p className="text-xs text-muted-foreground mt-1">{source.employer_name}</p>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onViewHistory}>
                <History className="mr-2 h-4 w-4" />
                View History
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Per Payment</p>
            <p className="text-lg font-bold text-green-600">+{formatCurrency(source.amount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {source.frequency === 'irregular' ? 'Total Received' : 'Yearly'}
            </p>
            <p className="text-lg font-semibold">
              {source.frequency === 'irregular'
                ? formatCurrency(source.total_received || source.amount)
                : formatCurrency(yearlyAmount)}
            </p>
          </div>
        </div>

        {source.frequency === 'irregular' ? (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground italic">Project-based (no set schedule)</span>
          </div>
        ) : daysUntilNext !== null && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className={daysUntilNext <= 3 ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
              {daysUntilNext === 0
                ? 'Expected today'
                : daysUntilNext === 1
                  ? 'Expected tomorrow'
                  : daysUntilNext < 0
                    ? `${Math.abs(daysUntilNext)} days ago`
                    : `in ${daysUntilNext} days`}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Add Income Modal
function AddIncomeModal({
  open,
  onOpenChange,
  onSuccess,
  editSource,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  editSource?: IncomeSource | null
}) {
  const [name, setName] = useState('')
  const [incomeType, setIncomeType] = useState<string>('payroll')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState('bi-weekly')
  const [employerName, setEmployerName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editSource) {
      setName(editSource.display_name || editSource.name)
      setIncomeType(editSource.income_type)
      setAmount(editSource.amount.toString())
      setFrequency(editSource.frequency)
      setEmployerName(editSource.employer_name || '')
    } else {
      setName('')
      setIncomeType('payroll')
      setAmount('')
      setFrequency('bi-weekly')
      setEmployerName('')
    }
  }, [editSource, open])

  const handleSubmit = async () => {
    if (!name.trim() || !amount) {
      toast.error('Please fill in name and amount')
      return
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    setSaving(true)
    try {
      const endpoint = '/api/income'
      const method = editSource ? 'PATCH' : 'PUT'
      const body = editSource
        ? { id: editSource.id, name, income_type: incomeType, amount: amountNum, frequency, employer_name: employerName || null }
        : { name, incomeType, amount: amountNum, frequency, employerName: employerName || undefined }

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        toast.success(editSource ? 'Income source updated' : 'Income source added')
        onSuccess()
        onOpenChange(false)
      } else {
        const data = await response.json()
        console.error('Income API error:', data)
        const errorMsg = data.details || data.error || 'Failed to save'
        toast.error(errorMsg)

        // Show hint if available (e.g., constraint violations)
        if (data.hint) {
          toast.error(`Hint: ${data.hint}`, { duration: 5000 })
        }
      }
    } catch {
      toast.error('Failed to save income source')
    } finally {
      setSaving(false)
    }
  }

  const config = INCOME_TYPES[incomeType as keyof typeof INCOME_TYPES] || INCOME_TYPES.other

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            {editSource ? 'Edit Income Source' : 'Add Income Source'}
          </DialogTitle>
          <DialogDescription>
            {editSource ? 'Update your income source details' : 'Add a recurring income source like your paycheck'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Income Type */}
          <div className="space-y-2">
            <Label>Income Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(INCOME_TYPES).filter(([key]) => key !== 'other').map(([key, cfg]) => {
                const Icon = cfg.icon
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setIncomeType(key)}
                    className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-all ${
                      incomeType === key
                        ? `${cfg.bgClass} border-2 border-current ${cfg.textClass}`
                        : 'hover:bg-muted'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <div>
                      <p className="text-sm font-medium">{cfg.label}</p>
                      <p className="text-xs text-muted-foreground">{cfg.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder={incomeType === 'payroll' ? 'e.g., Main Job Paycheck' : 'e.g., Monthly Pension'}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Employer (for payroll) */}
          {incomeType === 'payroll' && (
            <div className="space-y-2">
              <Label htmlFor="employer">Employer Name (optional)</Label>
              <Input
                id="employer"
                placeholder="e.g., Acme Corporation"
                value={employerName}
                onChange={(e) => setEmployerName(e.target.value)}
              />
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (per payment)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label htmlFor="frequency">Pay Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          {amount && (
            <div className={`rounded-lg p-3 ${config.bgClass}`}>
              <p className="text-sm font-medium">Projected Income</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Monthly</p>
                  <p className="font-semibold">{formatCurrency(getMonthlyAmount(parseFloat(amount) || 0, frequency))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Yearly</p>
                  <p className="font-semibold">{formatCurrency(getYearlyAmount(parseFloat(amount) || 0, frequency))}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !name.trim() || !amount}>
            {saving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
            ) : (
              <><Check className="mr-2 h-4 w-4" /> {editSource ? 'Save Changes' : 'Add Income'}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// History Sheet
function HistorySheet({
  open,
  onOpenChange,
  source,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: IncomeSource | null
}) {
  if (!source) return null

  const config = INCOME_TYPES[source.income_type] || INCOME_TYPES.other

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{source.display_name || source.name}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {source.occurrences} payments received
          </p>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Summary */}
          <div className={`rounded-lg p-4 ${config.bgClass}`}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Received</p>
                <p className="text-lg font-bold">{formatCurrency(source.total_received)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Average</p>
                <p className="text-lg font-semibold">{formatCurrency(source.average_amount)}</p>
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div>
            <h4 className="font-medium mb-3">Recent Payments</h4>
            {source.recentTransactions && source.recentTransactions.length > 0 ? (
              <div className="space-y-2">
                {source.recentTransactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm text-muted-foreground">{formatDate(tx.date)}</p>
                    </div>
                    <p className="font-semibold text-green-600">+{formatCurrency(Math.abs(tx.amount))}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent transactions found</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Detect Income Modal
function DetectIncomeModal({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (source: DetectedSource) => void
}) {
  const [detecting, setDetecting] = useState(false)
  const [detected, setDetected] = useState<DetectedSource[]>([])

  useEffect(() => {
    if (open) {
      runDetection()
    }
  }, [open])

  const runDetection = async () => {
    setDetecting(true)
    try {
      const response = await fetch('/api/income', { method: 'POST' })
      const data = await response.json()
      setDetected(data.detected || [])
    } catch {
      toast.error('Failed to detect income patterns')
    } finally {
      setDetecting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Detect Income Patterns
          </DialogTitle>
          <DialogDescription>
            Automatically find recurring income in your transactions
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {detecting ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <p className="mt-4 text-muted-foreground">Analyzing transactions...</p>
            </div>
          ) : detected.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No recurring income patterns detected</p>
              <p className="text-sm text-muted-foreground">Add income sources manually instead</p>
            </div>
          ) : (
            <div className="space-y-3">
              {detected.map((source, idx) => {
                const config = INCOME_TYPES[source.incomeType as keyof typeof INCOME_TYPES] || INCOME_TYPES.other
                const Icon = config.icon

                return (
                  <div key={idx} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2 ${config.bgClass}`}>
                        <Icon className={`h-4 w-4 ${config.textClass}`} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{source.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="text-xs">{config.label}</Badge>
                          <span>{source.occurrences} occurrences</span>
                          <Badge
                            variant="outline"
                            className={
                              source.confidence === 'high'
                                ? 'border-green-500 text-green-600'
                                : source.confidence === 'medium'
                                  ? 'border-yellow-500 text-yellow-600'
                                  : 'border-gray-500 text-gray-600'
                            }
                          >
                            {source.confidence}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="font-semibold text-green-600">+{formatCurrency(source.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {FREQUENCIES.find(f => f.value === source.frequency)?.label}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => onAdd(source)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button variant="secondary" onClick={runDetection} disabled={detecting}>
            <RefreshCw className={`mr-2 h-4 w-4 ${detecting ? 'animate-spin' : ''}`} />
            Re-scan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Main Page
export default function IncomePage() {
  const [sources, setSources] = useState<IncomeSource[]>([])
  const [stats, setStats] = useState<{
    monthlyTotal: number
    yearlyProjection: number
    sourceCount: number
    byType: Record<string, { count: number; monthly: number; yearly: number }>
  } | null>(null)
  const [loading, setLoading] = useState(true)

  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editSource, setEditSource] = useState<IncomeSource | null>(null)
  const [historySource, setHistorySource] = useState<IncomeSource | null>(null)
  const [detectModalOpen, setDetectModalOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<IncomeSource | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchIncome()
  }, [])

  const fetchIncome = async () => {
    try {
      const response = await fetch('/api/income')
      if (response.ok) {
        const data = await response.json()
        setSources(data.sources || [])
        setStats(data.stats || null)
      }
    } catch (error) {
      console.error('Error fetching income:', error)
      toast.error('Failed to load income data')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      const response = await fetch('/api/income', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteConfirm.id }),
      })

      if (response.ok) {
        toast.success('Income source removed')
        fetchIncome()
        setDeleteConfirm(null)
      } else {
        toast.error('Failed to remove')
      }
    } catch {
      toast.error('Failed to remove')
    } finally {
      setDeleting(false)
    }
  }

  const handleAddDetected = async (detected: DetectedSource) => {
    try {
      const response = await fetch('/api/income', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: detected.name,
          incomeType: detected.incomeType,
          amount: detected.amount,
          frequency: detected.frequency,
          originalName: detected.name,
        }),
      })

      if (response.ok) {
        toast.success(`Added "${detected.name}" to income sources`)
        fetchIncome()
      } else {
        toast.error('Failed to add income source')
      }
    } catch {
      toast.error('Failed to add income source')
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-muted-foreground">Loading income data...</p>
        </div>
      </div>
    )
  }

  // Group sources by type
  const sourcesByType = sources.reduce((acc, source) => {
    if (!acc[source.income_type]) acc[source.income_type] = []
    acc[source.income_type].push(source)
    return acc
  }, {} as Record<string, IncomeSource[]>)

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Income</h1>
          <p className="text-muted-foreground">
            Track your recurring income sources
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setDetectModalOpen(true)}>
            <Zap className="mr-2 h-4 w-4" />
            Detect Income
          </Button>
          <Button onClick={() => { setEditSource(null); setAddModalOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Income
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Income</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.monthlyTotal)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/20">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Yearly Projection</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.yearlyProjection)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/20">
                <Briefcase className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Income Sources</p>
                <p className="text-2xl font-bold">{stats.sourceCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Income Sources */}
      {sources.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Banknote className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No Income Sources</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              Add your recurring income sources like paychecks, Social Security, pension, or other regular income.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" onClick={() => setDetectModalOpen(true)}>
                <Zap className="mr-2 h-4 w-4" />
                Auto-Detect
              </Button>
              <Button onClick={() => { setEditSource(null); setAddModalOpen(true) }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Manually
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({sources.length})</TabsTrigger>
            {Object.entries(sourcesByType).map(([type, items]) => {
              const config = INCOME_TYPES[type as keyof typeof INCOME_TYPES]
              return (
                <TabsTrigger key={type} value={type}>
                  {config?.label || type} ({items.length})
                </TabsTrigger>
              )
            })}
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sources.map(source => (
                <IncomeSourceCard
                  key={source.id}
                  source={source}
                  onEdit={() => { setEditSource(source); setAddModalOpen(true) }}
                  onViewHistory={() => setHistorySource(source)}
                  onDelete={() => setDeleteConfirm(source)}
                />
              ))}
            </div>
          </TabsContent>

          {Object.entries(sourcesByType).map(([type, items]) => (
            <TabsContent key={type} value={type} className="mt-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {items.map(source => (
                  <IncomeSourceCard
                    key={source.id}
                    source={source}
                    onEdit={() => { setEditSource(source); setAddModalOpen(true) }}
                    onViewHistory={() => setHistorySource(source)}
                    onDelete={() => setDeleteConfirm(source)}
                  />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Modals */}
      <AddIncomeModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={fetchIncome}
        editSource={editSource}
      />

      <HistorySheet
        open={!!historySource}
        onOpenChange={(open) => !open && setHistorySource(null)}
        source={historySource}
      />

      <DetectIncomeModal
        open={detectModalOpen}
        onOpenChange={setDetectModalOpen}
        onAdd={handleAddDetected}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Income Source?</DialogTitle>
            <DialogDescription>
              This will remove &quot;{deleteConfirm?.display_name || deleteConfirm?.name}&quot; from your income tracking.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
