'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import {
  Repeat,
  Calendar as CalendarIcon,
  Clock,
  DollarSign,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Eye,
  History,
  Trash2,
  CreditCard,
  Filter,
  RefreshCw,
  Loader2,
  Zap,
  Check,
  AlertTriangle,
  Plus,
} from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { SterlingIcon } from '@/components/ui/sterling-icon'
import { MerchantLogo } from '@/components/ui/merchant-logo'

interface Transaction {
  id: string
  name: string
  merchant_name: string | null
  display_name: string | null
  amount: number
  date: string
  category: string | null
  plaid_account_id: string
  is_income: boolean
}

interface RecurringTransaction {
  id: string
  name: string
  displayName: string
  amount: number
  averageAmount: number
  frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'yearly'
  nextDate: string
  lastDate: string
  category: string | null
  accountId: string
  isIncome: boolean
  confidence: 'high' | 'medium' | 'low'
  occurrences: number
  transactions: Transaction[]
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Math.abs(amount))
}

function formatDate(dateStr: string): string {
  // Parse date parts to avoid timezone issues
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatFullDate(dateStr: string): string {
  // Parse date parts to avoid timezone issues
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function getFrequencyLabel(frequency: string): string {
  const labels: Record<string, string> = {
    'weekly': 'Weekly',
    'bi-weekly': 'Bi-weekly',
    'monthly': 'Monthly',
    'quarterly': 'Quarterly',
    'yearly': 'Yearly',
  }
  return labels[frequency] || frequency
}

// Normalize merchant name for API calls
function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .slice(0, 3)
    .join(' ')
    .trim()
}

function getDaysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Parse date parts to avoid timezone issues
  const [year, month, day] = dateStr.split('-').map(Number)
  const target = new Date(year, month - 1, day)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

// Recurring Item Component
function RecurringItem({
  item,
  onViewDetails,
  onViewHistory,
  onRemove,
  showAsCharged = false,
  highlighted = false,
  highlightRef,
}: {
  item: RecurringTransaction
  onViewDetails: () => void
  onViewHistory: () => void
  onRemove: () => void
  showAsCharged?: boolean
  highlighted?: boolean
  highlightRef?: React.RefObject<HTMLDivElement | null>
}) {
  const daysUntil = getDaysUntil(item.nextDate)
  const isOverdue = daysUntil < 0
  const daysSinceCharged = Math.abs(daysUntil)

  // Format the timing text based on context
  const getTimingText = () => {
    if (showAsCharged || isOverdue) {
      // Show as already charged
      if (daysSinceCharged === 0) {
        return <span className="text-emerald-600">Charged today</span>
      } else if (daysSinceCharged === 1) {
        return <span className="text-muted-foreground">Charged yesterday</span>
      } else {
        return <span className="text-muted-foreground">Charged {daysSinceCharged} days ago</span>
      }
    } else {
      // Show as upcoming
      if (daysUntil === 0) {
        return <span className="text-amber-600">Due today</span>
      } else if (daysUntil === 1) {
        return <span className="text-muted-foreground">Tomorrow</span>
      } else {
        return <span className="text-muted-foreground">in {daysUntil} days</span>
      }
    }
  }

  return (
    <div
      ref={highlighted ? highlightRef : undefined}
      className={`flex items-center justify-between rounded-lg border p-4 transition-all hover:bg-muted/50 ${
        highlighted ? 'ring-2 ring-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : ''
      }`}
    >
      <div className="flex items-center gap-4">
        <MerchantLogo
          merchantName={item.displayName || item.name}
          category={item.category}
          size="md"
        />
        <div>
          <p className="font-medium">{item.displayName}</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              {getFrequencyLabel(item.frequency)}
            </Badge>
            {getTimingText()}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p
            className={`font-semibold ${
              item.isIncome ? 'text-green-600' : 'text-foreground'
            }`}
          >
            {item.isIncome ? '+' : '-'}{formatCurrency(item.averageAmount)}
          </p>
          <p className="text-xs text-muted-foreground">
            {item.occurrences} occurrences
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onViewDetails}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onViewHistory}>
              <History className="mr-2 h-4 w-4" />
              View History
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRemove} className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Remove from List
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// Upcoming Tab Component
function UpcomingTab({
  recurring,
  onViewDetails,
  onViewHistory,
  onRemove,
  highlightedName,
  highlightRef,
}: {
  recurring: RecurringTransaction[]
  onViewDetails: (item: RecurringTransaction) => void
  onViewHistory: (item: RecurringTransaction) => void
  onRemove: (item: RecurringTransaction) => void
  highlightedName?: string | null
  highlightRef?: React.RefObject<HTMLDivElement | null>
}) {
  // Recently charged (overdue items - already happened)
  const recentlyCharged = recurring
    .filter((r) => getDaysUntil(r.nextDate) < 0)
    .sort((a, b) => getDaysUntil(b.nextDate) - getDaysUntil(a.nextDate)) // Most recent first

  // Coming up in the next 7 days
  const next7Days = recurring
    .filter((r) => {
      const days = getDaysUntil(r.nextDate)
      return days >= 0 && days <= 7
    })
    .sort((a, b) => getDaysUntil(a.nextDate) - getDaysUntil(b.nextDate)) // Soonest first

  const comingLater = recurring.filter((r) => {
    const days = getDaysUntil(r.nextDate)
    return days > 7
  })

  const next7DaysTotal = next7Days.reduce((sum, r) => {
    return sum + (r.isIncome ? -r.averageAmount : r.averageAmount)
  }, 0)

  return (
    <div className="space-y-6">
      {/* Recently Charged Section */}
      {recentlyCharged.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Recently Charged</h3>
              <p className="text-sm text-muted-foreground">
                {recentlyCharged.length} recent {recentlyCharged.length === 1 ? 'charge' : 'charges'}
              </p>
            </div>
            <Badge variant="outline" className="text-lg px-3 py-1">
              {recentlyCharged.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {recentlyCharged.map((item) => {
              const isHighlighted = highlightedName?.toLowerCase() === item.name.toLowerCase() ||
                highlightedName?.toLowerCase() === item.displayName?.toLowerCase()
              return (
                <RecurringItem
                  key={item.id}
                  item={item}
                  onViewDetails={() => onViewDetails(item)}
                  onViewHistory={() => onViewHistory(item)}
                  onRemove={() => onRemove(item)}
                  showAsCharged={true}
                  highlighted={isHighlighted}
                  highlightRef={isHighlighted ? highlightRef : undefined}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Next 7 Days Section */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Next 7 Days</h3>
            <p className="text-sm text-muted-foreground">
              {next7Days.length} {next7Days.length === 1 ? 'transaction' : 'transactions'} totaling{' '}
              <span className={next7DaysTotal > 0 ? 'text-red-600' : 'text-green-600'}>
                {formatCurrency(Math.abs(next7DaysTotal))}
              </span>
            </p>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            <Clock className="mr-2 h-4 w-4" />
            {next7Days.length}
          </Badge>
        </div>

        {next7Days.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <CalendarIcon className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">
                No upcoming transactions in the next 7 days
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {next7Days.map((item) => {
              const isHighlighted = highlightedName?.toLowerCase() === item.name.toLowerCase() ||
                highlightedName?.toLowerCase() === item.displayName?.toLowerCase()
              return (
                <RecurringItem
                  key={item.id}
                  item={item}
                  onViewDetails={() => onViewDetails(item)}
                  onViewHistory={() => onViewHistory(item)}
                  onRemove={() => onRemove(item)}
                  highlighted={isHighlighted}
                  highlightRef={isHighlighted ? highlightRef : undefined}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Coming Later Section */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Coming Later</h3>
          <p className="text-sm text-muted-foreground">
            {comingLater.length} upcoming {comingLater.length === 1 ? 'transaction' : 'transactions'}
          </p>
        </div>

        {comingLater.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Repeat className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">
                No additional recurring transactions detected
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {comingLater.slice(0, 10).map((item) => {
              const isHighlighted = highlightedName?.toLowerCase() === item.name.toLowerCase() ||
                highlightedName?.toLowerCase() === item.displayName?.toLowerCase()
              return (
                <RecurringItem
                  key={item.id}
                  item={item}
                  onViewDetails={() => onViewDetails(item)}
                  onViewHistory={() => onViewHistory(item)}
                  onRemove={() => onRemove(item)}
                  highlighted={isHighlighted}
                  highlightRef={isHighlighted ? highlightRef : undefined}
                />
              )
            })}
            {comingLater.length > 10 && (
              <p className="text-center text-sm text-muted-foreground">
                +{comingLater.length - 10} more recurring transactions
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// All Recurring Tab Component
function AllRecurringTab({
  recurring,
  yearlySpend,
  onViewDetails,
  onViewHistory,
  onRemove,
}: {
  recurring: RecurringTransaction[]
  yearlySpend: number
  onViewDetails: (item: RecurringTransaction) => void
  onViewHistory: (item: RecurringTransaction) => void
  onRemove: (item: RecurringTransaction) => void
}) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'amount' | 'frequency' | 'next'>('next')

  const filtered = useMemo(() => {
    // Only show bills/expenses, not income (income is on its own page now)
    let result = recurring.filter(r => !r.isIncome)

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.displayName.toLowerCase().includes(searchLower) ||
          r.name.toLowerCase().includes(searchLower) ||
          r.category?.toLowerCase().includes(searchLower)
      )
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.displayName.localeCompare(b.displayName)
        case 'amount':
          return b.averageAmount - a.averageAmount
        case 'frequency':
          const freqOrder = { weekly: 1, 'bi-weekly': 2, monthly: 3, quarterly: 4, yearly: 5 }
          return (freqOrder[a.frequency] || 0) - (freqOrder[b.frequency] || 0)
        case 'next':
        default:
          return new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime()
      }
    })

    return result
  }, [recurring, search, sortBy])

  const subscriptionCount = recurring.filter((r) => !r.isIncome).length

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
              <CreditCard className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Recurring Bills</p>
              <p className="text-2xl font-bold">{subscriptionCount}</p>
              <p className="text-xs text-muted-foreground">subscriptions & expenses</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
              <DollarSign className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Yearly Spend</p>
              <p className="text-2xl font-bold">{formatCurrency(yearlySpend)}</p>
              <p className="text-xs text-muted-foreground">on recurring bills</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Sort */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search recurring transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Sort by: {sortBy === 'next' ? 'Next Date' : sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSortBy('next')}>Next Date</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('name')}>Name</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('amount')}>Amount</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('frequency')}>Frequency</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <SterlingIcon size="lg" className="opacity-50" />
            <p className="mt-2 text-muted-foreground">
              {search ? 'No matching recurring bills' : 'No recurring bills detected'}
            </p>
            {!search && (
              <p className="mt-1 text-sm text-muted-foreground">
                AI will detect patterns as more transactions are synced, or add manually below
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <RecurringItem
              key={item.id}
              item={item}
              onViewDetails={() => onViewDetails(item)}
              onViewHistory={() => onViewHistory(item)}
              onRemove={() => onRemove(item)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Calendar Tab Component
function CalendarTab({
  recurring,
  onDayClick,
}: {
  recurring: RecurringTransaction[]
  onDayClick: (date: Date, items: RecurringTransaction[]) => void
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startOffset = firstDay.getDay()
    const daysInMonth = lastDay.getDate()

    const days: { date: Date | null; items: RecurringTransaction[] }[] = []

    // Add empty slots for days before the first of the month
    for (let i = 0; i < startOffset; i++) {
      days.push({ date: null, items: [] })
    }

    // Add each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      // Use local date format to avoid timezone issues
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

      // Find recurring items for this day - only exact date match
      const items = recurring.filter((r) => r.nextDate === dateStr)

      days.push({ date, items })
    }

    return days
  }, [currentMonth, recurring])

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const goToPrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={goToPrevMonth}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h3 className="text-lg font-semibold">{monthName}</h3>
        <Button variant="ghost" size="icon" onClick={goToNextMonth}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-lg border">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            if (!day.date) {
              return <div key={idx} className="min-h-[100px] border-b border-r bg-muted/20" />
            }

            const isToday = day.date.getTime() === today.getTime()
            const hasItems = day.items.length > 0
            const totalAmount = day.items.reduce((sum, item) => {
              return sum + (item.isIncome ? -item.averageAmount : item.averageAmount)
            }, 0)

            return (
              <button
                key={idx}
                onClick={() => hasItems && onDayClick(day.date!, day.items)}
                disabled={!hasItems}
                className={`min-h-[100px] border-b border-r p-2 text-left transition-colors ${
                  hasItems ? 'cursor-pointer hover:bg-muted/50' : ''
                } ${isToday ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''}`}
              >
                <div className="flex flex-col h-full">
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                      isToday
                        ? 'bg-emerald-500 text-white font-bold'
                        : 'text-foreground'
                    }`}
                  >
                    {day.date.getDate()}
                  </span>

                  {hasItems && (
                    <div className="mt-auto space-y-1">
                      {day.items.slice(0, 2).map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-xs ${
                            item.isIncome
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                          }`}
                        >
                          <MerchantLogo
                            merchantName={item.displayName || item.name}
                            category={item.category}
                            size="sm"
                            className="h-4 w-4 shrink-0"
                          />
                          <span className="truncate">{item.displayName}</span>
                        </div>
                      ))}
                      {day.items.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{day.items.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Calendar Day Modal
function CalendarDayModal({
  open,
  onOpenChange,
  date,
  items,
  onViewHistory,
  onRemove,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: Date | null
  items: RecurringTransaction[]
  onViewHistory: (item: RecurringTransaction) => void
  onRemove: (item: RecurringTransaction) => void
}) {
  if (!date) return null

  const totalAmount = items.reduce((sum, item) => {
    return sum + (item.isIncome ? -item.averageAmount : item.averageAmount)
  }, 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{formatFullDate(date.toISOString())}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? 'charge' : 'charges'} for{' '}
            <span className={totalAmount > 0 ? 'text-red-600' : 'text-green-600'}>
              {formatCurrency(Math.abs(totalAmount))}
            </span>
          </p>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <MerchantLogo
                  merchantName={item.displayName || item.name}
                  category={item.category}
                  size="md"
                />
                <div>
                  <p className="font-medium">{item.displayName}</p>
                  <p className="text-sm text-muted-foreground">
                    {getFrequencyLabel(item.frequency)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <p
                  className={`font-semibold ${
                    item.isIncome ? 'text-green-600' : ''
                  }`}
                >
                  {item.isIncome ? '+' : '-'}{formatCurrency(item.averageAmount)}
                </p>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onViewHistory(item)}>
                      <History className="mr-2 h-4 w-4" />
                      View History
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onRemove(item)} className="text-red-600">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove from List
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Transaction History Modal
function HistoryModal({
  open,
  onOpenChange,
  item,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: RecurringTransaction | null
}) {
  if (!item) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{item.displayName}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Transaction history ({item.occurrences} occurrences)
          </p>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {item.transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div>
                <p className="text-sm text-muted-foreground">
                  {formatFullDate(tx.date)}
                </p>
              </div>
              <p
                className={`font-semibold ${
                  tx.amount < 0 ? 'text-green-600' : ''
                }`}
              >
                {tx.amount < 0 ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-lg bg-muted/50 p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Average Amount</span>
            <span className="font-medium">{formatCurrency(item.averageAmount)}</span>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Frequency</span>
            <span className="font-medium">{getFrequencyLabel(item.frequency)}</span>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Next Expected</span>
            <span className="font-medium">{formatDate(item.nextDate)}</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Detail Modal
function DetailModal({
  open,
  onOpenChange,
  item,
  onRemove,
  onUpdate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: RecurringTransaction | null
  onRemove: () => void
  onUpdate: (id: string, updates: { frequency?: string }) => Promise<void>
}) {
  const [editingFrequency, setEditingFrequency] = useState(false)
  const [selectedFrequency, setSelectedFrequency] = useState<string>('')
  const [saving, setSaving] = useState(false)

  // Reset state when item changes
  useEffect(() => {
    if (item) {
      setSelectedFrequency(item.frequency)
      setEditingFrequency(false)
    }
  }, [item])

  if (!item) return null

  const handleSaveFrequency = async () => {
    if (selectedFrequency === item.frequency) {
      setEditingFrequency(false)
      return
    }
    setSaving(true)
    try {
      await onUpdate(item.id, { frequency: selectedFrequency })
      setEditingFrequency(false)
      toast.success('Frequency updated')
    } catch {
      toast.error('Failed to update frequency')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="space-y-4">
          <div className="flex flex-col items-center pt-4">
            <div className="mb-3">
              <MerchantLogo
                merchantName={item.displayName || item.name}
                category={item.category}
                size="lg"
                className="h-16 w-16"
              />
            </div>
            <SheetTitle className="text-xl">{item.displayName}</SheetTitle>
            <p className="text-sm text-muted-foreground">{item.name}</p>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Amount */}
          <div className="rounded-lg border p-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span
                className={`text-xl font-bold ${
                  item.isIncome ? 'text-green-600' : ''
                }`}
              >
                {item.isIncome ? '+' : '-'}{formatCurrency(item.averageAmount)}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3">
            {/* Editable Frequency */}
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
              <span className="text-muted-foreground">Frequency</span>
              {editingFrequency ? (
                <div className="flex items-center gap-2">
                  <Select value={selectedFrequency} onValueChange={setSelectedFrequency}>
                    <SelectTrigger className="w-32 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" onClick={handleSaveFrequency} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingFrequency(true)}
                  className="flex items-center gap-1 hover:opacity-70"
                >
                  <Badge variant="secondary">{getFrequencyLabel(item.frequency)}</Badge>
                </button>
              )}
            </div>
            <div className="flex justify-between rounded-lg bg-muted/50 p-3">
              <span className="text-muted-foreground">Next Expected</span>
              <span className="font-medium">{formatDate(item.nextDate)}</span>
            </div>
            <div className="flex justify-between rounded-lg bg-muted/50 p-3">
              <span className="text-muted-foreground">Last Charge</span>
              <span className="font-medium">{formatDate(item.lastDate)}</span>
            </div>
            <div className="flex justify-between rounded-lg bg-muted/50 p-3">
              <span className="text-muted-foreground">Category</span>
              <span className="font-medium">{item.category || 'Uncategorized'}</span>
            </div>
            <div className="flex justify-between rounded-lg bg-muted/50 p-3">
              <span className="text-muted-foreground">Occurrences</span>
              <span className="font-medium">{item.occurrences}</span>
            </div>
            <div className="flex justify-between rounded-lg bg-muted/50 p-3">
              <span className="text-muted-foreground">Confidence</span>
              <Badge
                variant="outline"
                className={
                  item.confidence === 'high'
                    ? 'border-green-500 text-green-600'
                    : item.confidence === 'medium'
                      ? 'border-yellow-500 text-yellow-600'
                      : 'border-gray-500 text-gray-600'
                }
              >
                {item.confidence.charAt(0).toUpperCase() + item.confidence.slice(1)}
              </Badge>
            </div>
          </div>

          {/* Hint */}
          <p className="text-xs text-muted-foreground text-center">
            Click on Frequency to edit
          </p>

          {/* Actions */}
          <div className="pt-4">
            <Button
              variant="destructive"
              className="w-full"
              onClick={onRemove}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove from Recurring
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Patterns Breakdown Modal
function PatternsBreakdownModal({
  open,
  onOpenChange,
  recurring,
  onViewDetails,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  recurring: RecurringTransaction[]
  onViewDetails: (item: RecurringTransaction) => void
}) {
  const subscriptions = recurring.filter((r) => !r.isIncome)
  const income = recurring.filter((r) => r.isIncome)

  const frequencyGroups = {
    weekly: recurring.filter((r) => r.frequency === 'weekly'),
    'bi-weekly': recurring.filter((r) => r.frequency === 'bi-weekly'),
    monthly: recurring.filter((r) => r.frequency === 'monthly'),
    quarterly: recurring.filter((r) => r.frequency === 'quarterly'),
    yearly: recurring.filter((r) => r.frequency === 'yearly'),
  }

  const confidenceGroups = {
    high: recurring.filter((r) => r.confidence === 'high'),
    medium: recurring.filter((r) => r.confidence === 'medium'),
    low: recurring.filter((r) => r.confidence === 'low'),
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <SterlingIcon size="md" />
            AI-Detected Patterns
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {recurring.length} recurring patterns found in your transactions
          </p>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-red-50 dark:bg-red-950/30 p-3">
              <p className="text-sm text-muted-foreground">Subscriptions</p>
              <p className="text-2xl font-bold text-red-600">{subscriptions.length}</p>
              <p className="text-xs text-muted-foreground">bills & expenses</p>
            </div>
            <div className="rounded-lg border bg-green-50 dark:bg-green-950/30 p-3">
              <p className="text-sm text-muted-foreground">Income</p>
              <p className="text-2xl font-bold text-green-600">{income.length}</p>
              <p className="text-xs text-muted-foreground">recurring deposits</p>
            </div>
          </div>

          {/* By Frequency */}
          <div>
            <h4 className="font-medium mb-3">By Frequency</h4>
            <div className="space-y-2">
              {Object.entries(frequencyGroups).map(([freq, items]) => {
                if (items.length === 0) return null
                return (
                  <div key={freq} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                    <span className="capitalize">{freq.replace('-', ' ')}</span>
                    <span className="font-medium">{items.length}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* By Confidence */}
          <div>
            <h4 className="font-medium mb-3">Detection Confidence</h4>
            <div className="space-y-2">
              {Object.entries(confidenceGroups).map(([conf, items]) => {
                if (items.length === 0) return null
                const colors = {
                  high: 'bg-green-100 text-green-700 dark:bg-green-900/30',
                  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30',
                  low: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30',
                }
                return (
                  <div key={conf} className={`flex items-center justify-between rounded-lg p-3 ${colors[conf as keyof typeof colors]}`}>
                    <span className="capitalize">{conf} confidence</span>
                    <span className="font-medium">{items.length}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* All Patterns List */}
          <div>
            <h4 className="font-medium mb-3">All Detected Patterns</h4>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {recurring.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onViewDetails(item)
                    onOpenChange(false)
                  }}
                  className="w-full flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <MerchantLogo
                      merchantName={item.displayName || item.name}
                      category={item.category}
                      size="sm"
                    />
                    <div className="text-left">
                      <p className="font-medium text-sm">{item.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {getFrequencyLabel(item.frequency)} • {item.confidence} confidence
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${item.isIncome ? 'text-green-600' : ''}`}>
                      {item.isIncome ? '+' : '-'}{formatCurrency(item.averageAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.isIncome ? 'Income' : 'Expense'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Add Recurring Modal Component
function AddRecurringModal({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<string>('monthly')
  const [isIncome, setIsIncome] = useState(false)
  const [nextDate, setNextDate] = useState('')
  const [saving, setSaving] = useState(false)

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
      const response = await fetch('/api/recurring', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          amount: amountNum,
          frequency,
          isIncome,
          nextDate: nextDate || undefined,
        }),
      })

      if (response.ok) {
        toast.success(`Added "${name}" as recurring ${isIncome ? 'income' : 'expense'}`)
        onSuccess()
        onOpenChange(false)
        // Reset form
        setName('')
        setAmount('')
        setFrequency('monthly')
        setIsIncome(false)
        setNextDate('')
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to add recurring item')
      }
    } catch (error) {
      console.error('Error adding recurring:', error)
      toast.error('Failed to add recurring item')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Recurring {isIncome ? 'Income' : 'Transaction'}
          </DialogTitle>
          <DialogDescription>
            Manually add a recurring bill, subscription, or income that wasn&apos;t detected automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Type Toggle */}
          <div className="flex rounded-lg border p-1 gap-1">
            <button
              type="button"
              onClick={() => setIsIncome(false)}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                !isIncome
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Bill / Expense
            </button>
            <button
              type="button"
              onClick={() => setIsIncome(true)}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                isIncome
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Income
            </button>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder={isIncome ? "e.g., Paycheck, Rental Income" : "e.g., Netflix, Rent, Electric Bill"}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
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
            <Label htmlFor="frequency">Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Next Date (optional) */}
          <div className="space-y-2">
            <Label htmlFor="nextDate">Next Expected Date (optional)</Label>
            <Input
              id="nextDate"
              type="date"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !amount}
            className={isIncome ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add {isIncome ? 'Income' : 'Recurring'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Main Page Component
export default function RecurringPage() {
  const searchParams = useSearchParams()
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([])
  const [yearlySpend, setYearlySpend] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('upcoming')
  const [highlightedName, setHighlightedName] = useState<string | null>(null)
  const highlightRef = useRef<HTMLDivElement>(null)

  // AI status
  const [aiPowered, setAiPowered] = useState(false)
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null)
  const [reanalyzing, setReanalyzing] = useState(false)

  // Modal states
  const [detailItem, setDetailItem] = useState<RecurringTransaction | null>(null)
  const [historyItem, setHistoryItem] = useState<RecurringTransaction | null>(null)
  const [calendarDayDate, setCalendarDayDate] = useState<Date | null>(null)
  const [calendarDayItems, setCalendarDayItems] = useState<RecurringTransaction[]>([])
  const [showPatternsBreakdown, setShowPatternsBreakdown] = useState(false)

  // AI Analysis Modal states
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false)
  const [analysisStarted, setAnalysisStarted] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [analysisResult, setAnalysisResult] = useState<{
    count: number
    message?: string
    error?: string
  } | null>(null)

  // Add Recurring Modal state
  const [addRecurringOpen, setAddRecurringOpen] = useState(false)

  useEffect(() => {
    const fetchRecurring = async () => {
      try {
        const response = await fetch('/api/recurring')
        if (response.ok) {
          const data = await response.json()
          const recurringData = data.recurring || []
          setRecurring(recurringData)
          setYearlySpend(data.yearlySpend || 0)
          setAiPowered(data.aiPowered || false)
          setLastAnalysis(data.lastAnalysis || null)
        }
      } catch (error) {
        console.error('Error fetching recurring:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRecurring()
  }, [])

  // Handle highlight param from dashboard navigation
  useEffect(() => {
    const highlightParam = searchParams.get('highlight')
    if (highlightParam) {
      setHighlightedName(highlightParam)
      // Clear the query param from URL without page reload
      window.history.replaceState({}, '', '/dashboard/recurring')

      // Scroll to the highlighted item after a short delay (wait for render)
      setTimeout(() => {
        if (highlightRef.current) {
          highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 300)

      // Clear highlight after 3 seconds
      setTimeout(() => {
        setHighlightedName(null)
      }, 3000)
    }
  }, [searchParams, recurring])

  // Open analysis modal
  const openAnalysisModal = () => {
    setAnalysisModalOpen(true)
    setAnalysisStarted(false)
    setAnalysisProgress(0)
    setAnalysisResult(null)
  }

  // Run AI analysis with progress
  const runAnalysis = async () => {
    setAnalysisStarted(true)
    setAnalysisProgress(0)
    setAnalysisResult(null)
    setReanalyzing(true)

    // Simulate progress updates while waiting for the API
    const progressInterval = setInterval(() => {
      setAnalysisProgress((prev) => {
        // Gradually increase but never reach 100% until done
        const increment = Math.max(1, Math.floor((100 - prev) * 0.08))
        return Math.min(prev + increment, 92)
      })
    }, 1500)

    try {
      const response = await fetch('/api/recurring', { method: 'POST' })
      const data = await response.json()

      clearInterval(progressInterval)
      setAnalysisProgress(100)

      if (response.ok) {
        const recurringData = data.recurring || []
        setRecurring(recurringData)
        setYearlySpend(data.yearlySpend || 0)
        setAiPowered(data.aiPowered || true)
        setLastAnalysis(data.lastAnalysis || new Date().toISOString())
        setAnalysisResult({
          count: recurringData.length,
          message: data.message,
        })

        // Close modal after showing success
        setTimeout(() => {
          setAnalysisModalOpen(false)
          setAnalysisStarted(false)
        }, 2000)
      } else if (response.status === 403) {
        setAnalysisResult({
          count: 0,
          error: 'Pro subscription required for AI analysis',
        })
      } else if (response.status === 429) {
        setAnalysisResult({
          count: 0,
          error: 'Rate limit reached. Please try again later.',
        })
      } else {
        setAnalysisResult({
          count: 0,
          error: data.error || 'Failed to analyze recurring transactions',
        })
      }
    } catch (error) {
      console.error('Error reanalyzing:', error)
      clearInterval(progressInterval)
      setAnalysisResult({
        count: 0,
        error: 'Failed to analyze recurring transactions',
      })
    } finally {
      setReanalyzing(false)
    }
  }

  const handleRemove = async (item: RecurringTransaction) => {
    const merchantPattern = normalizeMerchant(item.displayName || item.name)

    try {
      const response = await fetch('/api/recurring', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantPattern,
          originalName: item.displayName || item.name,
          reason: 'user_dismissed',
        }),
      })

      if (response.ok) {
        // Remove from local state
        setRecurring(recurring.filter((r) => r.id !== item.id))
        setDetailItem(null)
        setCalendarDayDate(null)
        toast.success(`Removed "${item.displayName}" from recurring`)
      } else {
        toast.error('Failed to remove item')
      }
    } catch (error) {
      console.error('Error removing item:', error)
      toast.error('Failed to remove item')
    }
  }

  const handleDayClick = (date: Date, items: RecurringTransaction[]) => {
    setCalendarDayDate(date)
    setCalendarDayItems(items)
  }

  // Update a recurring pattern (e.g., change frequency)
  const handleUpdateRecurring = async (id: string, updates: { frequency?: string }) => {
    const response = await fetch('/api/recurring', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    })

    if (!response.ok) {
      throw new Error('Failed to update')
    }

    // Update local state
    const data = await response.json()
    if (data.pattern) {
      setRecurring(recurring.map(r => {
        if (r.id === id) {
          return {
            ...r,
            frequency: data.pattern.frequency || r.frequency,
            nextDate: data.pattern.next_expected_date || r.nextDate,
          }
        }
        return r
      }))
    }
  }

  // Refresh recurring data after adding manually
  const handleAddSuccess = async () => {
    try {
      const response = await fetch('/api/recurring')
      if (response.ok) {
        const data = await response.json()
        const recurringData = data.recurring || []
        setRecurring(recurringData)
        setYearlySpend(data.yearlySpend || 0)
      }
    } catch (error) {
      console.error('Error refreshing recurring:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="text-muted-foreground">Analyzing recurring patterns...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recurring Transactions</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>
              {aiPowered ? 'AI-detected' : 'Pattern-detected'} recurring bills and subscriptions
            </span>
            {aiPowered && lastAnalysis && (
              <Badge variant="outline" className="text-xs">
                <Zap className="h-3 w-3 mr-1" />
                Updated {new Date(lastAnalysis).toLocaleDateString()}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => setAddRecurringOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Recurring
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openAnalysisModal}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Re-analyze with AI
          </Button>
          <button
            onClick={() => setShowPatternsBreakdown(true)}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-muted/50 transition-colors"
          >
            <SterlingIcon size="md" />
            <span className="text-sm font-medium">
              {recurring.length} patterns
            </span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upcoming">
            <Clock className="mr-2 h-4 w-4" />
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="all">
            <Repeat className="mr-2 h-4 w-4" />
            All Recurring
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarIcon className="mr-2 h-4 w-4" />
            Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-6">
          <UpcomingTab
            recurring={recurring}
            onViewDetails={setDetailItem}
            onViewHistory={setHistoryItem}
            onRemove={handleRemove}
            highlightedName={highlightedName}
            highlightRef={highlightRef}
          />
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <AllRecurringTab
            recurring={recurring}
            yearlySpend={yearlySpend}
            onViewDetails={setDetailItem}
            onViewHistory={setHistoryItem}
            onRemove={handleRemove}
          />
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <CalendarTab recurring={recurring} onDayClick={handleDayClick} />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <DetailModal
        open={!!detailItem}
        onOpenChange={(open) => !open && setDetailItem(null)}
        item={detailItem}
        onRemove={() => detailItem && handleRemove(detailItem)}
        onUpdate={handleUpdateRecurring}
      />

      <HistoryModal
        open={!!historyItem}
        onOpenChange={(open) => !open && setHistoryItem(null)}
        item={historyItem}
      />

      <CalendarDayModal
        open={!!calendarDayDate}
        onOpenChange={(open) => !open && setCalendarDayDate(null)}
        date={calendarDayDate}
        items={calendarDayItems}
        onViewHistory={setHistoryItem}
        onRemove={handleRemove}
      />

      <PatternsBreakdownModal
        open={showPatternsBreakdown}
        onOpenChange={setShowPatternsBreakdown}
        recurring={recurring}
        onViewDetails={setDetailItem}
      />

      {/* Add Recurring Modal */}
      <AddRecurringModal
        open={addRecurringOpen}
        onOpenChange={setAddRecurringOpen}
        onSuccess={handleAddSuccess}
      />

      {/* AI Analysis Modal */}
      <Dialog open={analysisModalOpen} onOpenChange={(open) => !analysisStarted && setAnalysisModalOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SterlingIcon size="md" />
              AI Recurring Detection
            </DialogTitle>
            <DialogDescription>
              {!analysisStarted ? (
                <>
                  Analyze your transaction history to detect recurring bills, subscriptions, and income.
                  This typically takes <strong>30-60 seconds</strong>.
                </>
              ) : (
                'Analyzing your transactions...'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {!analysisStarted ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                        AI-Powered Detection
                      </p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        Sterling will analyze patterns in your transactions to identify bills, subscriptions, and regular income.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{analysisProgress}%</span>
                  </div>
                  <Progress value={analysisProgress} className="h-3" />
                  <p className="text-xs text-muted-foreground text-center">
                    {analysisResult?.error ? (
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        {analysisResult.error}
                      </span>
                    ) : analysisProgress === 100 && analysisResult ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        Complete! Detected {analysisResult.count} recurring transactions.
                      </span>
                    ) : (
                      <>Analyzing transaction patterns...</>
                    )}
                  </p>
                </div>

                {analysisProgress < 100 && !analysisResult?.error && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Please wait, this may take up to a minute...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            {!analysisStarted ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setAnalysisModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={runAnalysis}
                  className="bg-gradient-to-r from-slate-500 to-slate-700 hover:from-slate-600 hover:to-slate-800"
                >
                  <SterlingIcon size="sm" className="mr-2" />
                  Start Analysis
                </Button>
              </>
            ) : analysisResult?.error ? (
              <Button onClick={() => setAnalysisModalOpen(false)}>
                Close
              </Button>
            ) : analysisProgress === 100 && analysisResult ? (
              <Button onClick={() => setAnalysisModalOpen(false)}>
                <Check className="h-4 w-4 mr-2" />
                Done
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
