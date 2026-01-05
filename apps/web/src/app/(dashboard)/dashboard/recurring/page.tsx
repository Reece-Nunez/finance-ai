'use client'

import { useState, useEffect, useMemo } from 'react'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
} from 'lucide-react'
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
}: {
  item: RecurringTransaction
  onViewDetails: () => void
  onViewHistory: () => void
  onRemove: () => void
  showAsCharged?: boolean
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
    <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
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
}: {
  recurring: RecurringTransaction[]
  onViewDetails: (item: RecurringTransaction) => void
  onViewHistory: (item: RecurringTransaction) => void
  onRemove: (item: RecurringTransaction) => void
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
            {recentlyCharged.map((item) => (
              <RecurringItem
                key={item.id}
                item={item}
                onViewDetails={() => onViewDetails(item)}
                onViewHistory={() => onViewHistory(item)}
                onRemove={() => onRemove(item)}
                showAsCharged={true}
              />
            ))}
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
            {next7Days.map((item) => (
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
            {comingLater.slice(0, 10).map((item) => (
              <RecurringItem
                key={item.id}
                item={item}
                onViewDetails={() => onViewDetails(item)}
                onViewHistory={() => onViewHistory(item)}
                onRemove={() => onRemove(item)}
              />
            ))}
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
    let result = [...recurring]

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
  const incomeCount = recurring.filter((r) => r.isIncome).length

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
              <CreditCard className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Subscriptions</p>
              <p className="text-2xl font-bold">{subscriptionCount}</p>
              <p className="text-xs text-muted-foreground">bills & expenses</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Recurring Income</p>
              <p className="text-2xl font-bold">{incomeCount}</p>
              <p className="text-xs text-muted-foreground">paychecks & deposits</p>
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
              <p className="text-xs text-muted-foreground">on subscriptions</p>
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
              {search ? 'No matching recurring transactions' : 'No recurring transactions detected'}
            </p>
            {!search && (
              <p className="mt-1 text-sm text-muted-foreground">
                AI will detect patterns as more transactions are synced
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: RecurringTransaction | null
  onRemove: () => void
}) {
  if (!item) return null

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
            <div className="flex justify-between rounded-lg bg-muted/50 p-3">
              <span className="text-muted-foreground">Frequency</span>
              <Badge variant="secondary">{getFrequencyLabel(item.frequency)}</Badge>
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

// Main Page Component
export default function RecurringPage() {
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([])
  const [yearlySpend, setYearlySpend] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('upcoming')

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

  useEffect(() => {
    const fetchRecurring = async () => {
      try {
        const response = await fetch('/api/recurring')
        if (response.ok) {
          const data = await response.json()
          setRecurring(data.recurring || [])
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

  const handleReanalyze = async () => {
    setReanalyzing(true)
    try {
      const response = await fetch('/api/recurring', { method: 'POST' })
      const data = await response.json()

      if (response.ok) {
        setRecurring(data.recurring || [])
        setYearlySpend(data.yearlySpend || 0)
        setAiPowered(data.aiPowered || true)
        setLastAnalysis(data.lastAnalysis || new Date().toISOString())
        toast.success(`AI detected ${data.recurring?.length || 0} recurring bills`)
      } else if (response.status === 403) {
        toast.error('Pro subscription required for AI analysis')
      } else if (response.status === 429) {
        toast.error('Rate limit reached. Please try again later.')
      } else {
        toast.error(data.error || 'Failed to analyze recurring transactions')
      }
    } catch (error) {
      console.error('Error reanalyzing:', error)
      toast.error('Failed to analyze recurring transactions')
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
            variant="outline"
            size="sm"
            onClick={handleReanalyze}
            disabled={reanalyzing}
          >
            {reanalyzing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {reanalyzing ? 'Analyzing...' : 'Re-analyze with AI'}
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
    </div>
  )
}
