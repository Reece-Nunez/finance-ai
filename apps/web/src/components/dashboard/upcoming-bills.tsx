'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Calendar, DollarSign, Loader2 } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { MerchantLogo } from '@/components/ui/merchant-logo'

interface RecurringBill {
  id: string
  name: string
  displayName: string
  amount: number
  frequency: string
  nextDate: string
  category: string | null
  isIncome: boolean
}

interface IncomeSource {
  id: string
  name: string
  display_name: string
  income_type: string
  amount: number
  frequency: string
  next_expected_date: string | null
  last_received_date: string | null
}

interface UpcomingBillsProps {
  isPro?: boolean
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatCurrencyShort(amount: number) {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`
  }
  return `$${Math.round(amount)}`
}

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return 'th'
  switch (day % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

export function UpcomingBills({ isPro = false }: UpcomingBillsProps) {
  const router = useRouter()
  const [weekOffset, setWeekOffset] = useState(0)
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([])
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch recurring bills from database
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [recurringRes, incomeRes] = await Promise.all([
          fetch('/api/recurring'),
          fetch('/api/income'),
        ])

        if (recurringRes.ok) {
          const data = await recurringRes.json()
          // Filter to only expenses (not income)
          const expenses = (data.recurring || []).filter((r: RecurringBill) => !r.isIncome)
          setRecurringBills(expenses)
        }

        if (incomeRes.ok) {
          const data = await incomeRes.json()
          setIncomeSources(data.sources || [])
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Get paydays from income sources
  const paydays = useMemo(() => {
    const days: number[] = []

    incomeSources.forEach(source => {
      // Skip irregular income - no set payday
      if (source.frequency === 'irregular') return
      // Skip far-future placeholder dates
      if (source.next_expected_date?.startsWith('9999')) return

      if (source.next_expected_date) {
        const [, , day] = source.next_expected_date.split('-').map(Number)
        if (!days.includes(day)) {
          days.push(day)
        }
      } else if (source.last_received_date) {
        // Fallback to last received date
        const [, , day] = source.last_received_date.split('-').map(Number)
        if (!days.includes(day)) {
          days.push(day)
        }
      }
    })

    return days
  }, [incomeSources])

  // Convert recurring bills to day-of-month format for calendar display
  const billsByDay = useMemo(() => {
    const map: Record<number, RecurringBill[]> = {}

    recurringBills.forEach(bill => {
      if (!bill.nextDate) return

      // Get day of month from next expected date
      const [, , day] = bill.nextDate.split('-').map(Number)
      if (!map[day]) map[day] = []
      map[day].push(bill)
    })

    return map
  }, [recurringBills])

  // Get the week's dates
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay() + weekOffset * 7)

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfWeek)
    date.setDate(startOfWeek.getDate() + i)
    return date
  })

  // Get bills for each day
  const getBillsForDay = (date: Date) => {
    const dayOfMonth = date.getDate()
    return billsByDay[dayOfMonth] || []
  }

  const isPayday = (date: Date) => {
    return paydays.includes(date.getDate())
  }

  const isToday = (date: Date) => {
    const now = new Date()
    return (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    )
  }

  // Calculate total upcoming bills for the week
  const totalUpcoming = weekDates.reduce((sum, date) => {
    const bills = getBillsForDay(date)
    return sum + bills.reduce((s, b) => s + b.amount, 0)
  }, 0)

  const upcomingCount = weekDates.reduce((count, date) => {
    return count + getBillsForDay(date).length
  }, 0)

  // Calculate days until next payday
  const daysUntilPayday = useMemo(() => {
    if (paydays.length === 0) return null
    const todayDay = today.getDate()
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()

    // Find the next payday
    let minDays = Infinity
    for (const payday of paydays) {
      let daysUntil: number
      if (payday > todayDay) {
        // Payday is later this month
        daysUntil = payday - todayDay
      } else if (payday === todayDay) {
        // Today is payday!
        daysUntil = 0
      } else {
        // Payday already passed this month, calculate for next month
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
        daysUntil = (daysInMonth - todayDay) + payday
      }
      if (daysUntil < minDays) {
        minDays = daysUntil
      }
    }
    return minDays === Infinity ? null : minDays
  }, [paydays, today])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upcoming</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg">Upcoming</CardTitle>
            <p className="text-sm text-muted-foreground">
              {upcomingCount > 0
                ? `${upcomingCount} bill${upcomingCount > 1 ? 's' : ''} due this week totaling ${formatCurrency(totalUpcoming)}`
                : 'No upcoming bills this week'}
            </p>
            {daysUntilPayday !== null && (
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                {daysUntilPayday === 0
                  ? 'Today is payday!'
                  : `Payday in ${daysUntilPayday} day${daysUntilPayday > 1 ? 's' : ''}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setWeekOffset((w) => w - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
            >
              <Calendar className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setWeekOffset((w) => w + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Week Calendar */}
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
            {/* Day headers */}
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
              <div
                key={idx}
                className="py-1 text-center text-[10px] sm:text-xs font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
            {/* Date cells */}
            {weekDates.map((date) => {
              const bills = getBillsForDay(date)
              const payday = isPayday(date)
              const todayCheck = isToday(date)
              const dayTotal = bills.reduce((sum, b) => sum + b.amount, 0)

              return (
                <div
                  key={date.toISOString()}
                  className={`relative flex min-h-[80px] sm:min-h-[120px] flex-col items-center rounded-md sm:rounded-lg border p-1 sm:p-2 ${
                    todayCheck ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : ''
                  }`}
                >
                  <span
                    className={`text-xs sm:text-sm font-medium ${
                      todayCheck ? 'text-emerald-600 dark:text-emerald-400' : ''
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  {payday && (
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="mt-0.5 sm:mt-1 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-green-500">
                          <DollarSign className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Payday</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {bills.length > 0 && (
                    <div className="mt-0.5 sm:mt-1 flex flex-col items-center gap-0.5 sm:gap-1">
                      <div className="flex flex-wrap justify-center gap-0.5 sm:gap-1">
                        {bills.slice(0, 2).map((bill, idx) => (
                          <Tooltip key={idx}>
                            <TooltipTrigger>
                              <MerchantLogo
                                merchantName={bill.displayName || bill.name}
                                category={bill.category}
                                size="sm"
                                className="h-4 w-4 sm:h-5 sm:w-5"
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">{bill.displayName || bill.name}</p>
                              <p className="text-red-400">{formatCurrency(bill.amount)}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                      {bills.length > 2 && (
                        <span className="text-[8px] sm:text-[10px] text-muted-foreground">
                          +{bills.length - 2}
                        </span>
                      )}
                      <span className="text-[10px] sm:text-xs font-medium text-red-600 dark:text-red-400">
                        {formatCurrencyShort(dayTotal)}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <span className="text-[8px]">$</span>
              </div>
              <span>Bill due</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                <DollarSign className="h-3 w-3 text-white" />
              </div>
              <span>Payday</span>
            </div>
          </div>

          {/* Show all recurring bills */}
          {recurringBills.length > 0 && (
            <div className="mt-4 flex-1 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Recurring Bills ({recurringBills.length})
              </p>
              <div className="max-h-[400px] space-y-1.5 overflow-y-auto">
                {recurringBills.map((bill) => {
                  // Get day from next date
                  const dayOfMonth = bill.nextDate
                    ? parseInt(bill.nextDate.split('-')[2])
                    : 1

                  return (
                    <button
                      key={bill.id}
                      onClick={() => router.push(`/dashboard/recurring?highlight=${encodeURIComponent(bill.name)}`)}
                      className="flex w-full items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MerchantLogo
                          merchantName={bill.displayName || bill.name}
                          category={bill.category}
                          size="sm"
                        />
                        <div className="flex flex-col items-start min-w-0">
                          <span className="truncate">{bill.displayName || bill.name}</span>
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {bill.frequency}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {dayOfMonth}{getOrdinalSuffix(dayOfMonth)}
                        </span>
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          {formatCurrency(bill.amount)}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {recurringBills.length === 0 && incomeSources.length === 0 && (
            <div className="mt-4 text-center py-4">
              <p className="text-sm text-muted-foreground">
                No recurring bills or income set up yet.
              </p>
              <Button
                variant="link"
                size="sm"
                onClick={() => router.push('/dashboard/recurring')}
                className="mt-1"
              >
                Add recurring bills
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
