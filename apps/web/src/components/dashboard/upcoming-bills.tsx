'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Calendar, DollarSign } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { MerchantLogo } from '@/components/ui/merchant-logo'

interface Transaction {
  id: string
  name: string
  display_name: string | null
  merchant_name: string | null
  amount: number
  date: string
  category: string | null
  is_income?: boolean
}

interface RecurringBill {
  name: string
  amount: number
  dayOfMonth: number
  category: string | null
  isPayday?: boolean
}

interface UpcomingBillsProps {
  transactions: Transaction[]
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

function detectRecurringBills(transactions: Transaction[]): RecurringBill[] {
  // Group transactions by merchant/name
  const merchantMap: Record<string, { amounts: number[]; dates: string[]; category: string | null }> = {}

  transactions.forEach((tx) => {
    if (tx.amount <= 0) return // Skip income
    const key = tx.display_name || tx.merchant_name || tx.name
    if (!merchantMap[key]) {
      merchantMap[key] = { amounts: [], dates: [], category: tx.category }
    }
    merchantMap[key].amounts.push(tx.amount)
    merchantMap[key].dates.push(tx.date)
  })

  const recurring: RecurringBill[] = []

  Object.entries(merchantMap).forEach(([name, data]) => {
    if (data.amounts.length >= 2) {
      // Check if amounts are similar (within 10%)
      const avgAmount = data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length
      const allSimilar = data.amounts.every(
        (a) => Math.abs(a - avgAmount) / avgAmount < 0.1
      )

      if (allSimilar) {
        // Extract day of month from most recent transaction
        const lastDate = new Date(data.dates[0])
        recurring.push({
          name,
          amount: avgAmount,
          dayOfMonth: lastDate.getDate(),
          category: data.category,
        })
      }
    }
  })

  return recurring.sort((a, b) => a.dayOfMonth - b.dayOfMonth)
}

function detectPaydays(transactions: Transaction[]): number[] {
  // First, look for transactions explicitly marked as income
  const markedIncomeTransactions = transactions.filter((tx) => tx.is_income === true)

  // If we have marked income transactions, use those
  if (markedIncomeTransactions.length > 0) {
    const dayMap: Record<number, number> = {}
    markedIncomeTransactions.forEach((tx) => {
      const day = new Date(tx.date).getDate()
      dayMap[day] = (dayMap[day] || 0) + 1
    })
    // Return days that appear at least once (since they're explicitly marked)
    return Object.entries(dayMap)
      .filter(([, count]) => count >= 1)
      .map(([day]) => parseInt(day))
  }

  // Fallback: Look for large deposits (income) based on amount
  const incomeTransactions = transactions.filter((tx) => tx.amount < 0 && Math.abs(tx.amount) > 500)

  const dayMap: Record<number, number> = {}
  incomeTransactions.forEach((tx) => {
    const day = new Date(tx.date).getDate()
    dayMap[day] = (dayMap[day] || 0) + 1
  })

  // Return days that appear more than once
  return Object.entries(dayMap)
    .filter(([, count]) => count >= 2)
    .map(([day]) => parseInt(day))
}

export function UpcomingBills({ transactions }: UpcomingBillsProps) {
  const [weekOffset, setWeekOffset] = useState(0)

  const recurringBills = useMemo(() => detectRecurringBills(transactions), [transactions])
  const paydays = useMemo(() => detectPaydays(transactions), [transactions])

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
    return recurringBills.filter((bill) => bill.dayOfMonth === dayOfMonth)
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

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg">Upcoming</CardTitle>
            <p className="text-sm text-muted-foreground">
              {upcomingCount > 0
                ? `${upcomingCount} bill${upcomingCount > 1 ? 's' : ''} due this week totaling ${formatCurrency(totalUpcoming)}`
                : 'No upcoming bills detected this week'}
            </p>
            {daysUntilPayday !== null && (
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                {daysUntilPayday === 0
                  ? '🎉 Today is payday!'
                  : `Payday is in ${daysUntilPayday} day${daysUntilPayday > 1 ? 's' : ''}`}
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
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="py-1 text-center text-xs font-medium text-muted-foreground"
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
                  className={`relative flex min-h-[120px] flex-col items-center rounded-lg border p-2 ${
                    todayCheck ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : ''
                  }`}
                >
                  <span
                    className={`text-sm font-medium ${
                      todayCheck ? 'text-emerald-600 dark:text-emerald-400' : ''
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  {payday && (
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-green-500">
                          <DollarSign className="h-3.5 w-3.5 text-white" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Payday</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {bills.length > 0 && (
                    <div className="mt-1 flex flex-col items-center gap-1">
                      <div className="flex flex-wrap justify-center gap-1">
                        {bills.slice(0, 4).map((bill, idx) => (
                          <Tooltip key={idx}>
                            <TooltipTrigger>
                              <MerchantLogo
                                merchantName={bill.name}
                                category={bill.category}
                                size="sm"
                                className="h-5 w-5"
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">{bill.name}</p>
                              <p className="text-red-400">{formatCurrency(bill.amount)}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                      {bills.length > 4 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{bills.length - 4} more
                        </span>
                      )}
                      <span className="text-xs font-medium text-red-600 dark:text-red-400">
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
                Detected Recurring Bills ({recurringBills.length})
              </p>
              <div className="max-h-[400px] space-y-1.5 overflow-y-auto">
                {recurringBills.map((bill, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <MerchantLogo
                        merchantName={bill.name}
                        category={bill.category}
                        size="sm"
                      />
                      <span className="truncate">{bill.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {bill.dayOfMonth}{getOrdinalSuffix(bill.dayOfMonth)}
                      </span>
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        {formatCurrency(bill.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
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
