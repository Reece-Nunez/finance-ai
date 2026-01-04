'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Calendar, DollarSign, Sparkles, Loader2 } from 'lucide-react'
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
  confidence?: number
  frequency?: string
  amountVaries?: boolean
  aiDetected?: boolean
}

interface AIRecurringItem {
  name: string
  type: 'expense' | 'income'
  frequency: string
  typical_day: number
  amount: number
  amount_varies: boolean
  confidence: number
  next_expected_date: string
  category: string
}

interface UpcomingBillsProps {
  transactions: Transaction[]
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

// Parse date string as local date (not UTC) to avoid timezone issues
function parseLocalDate(dateStr: string): Date {
  // dateStr is in format "YYYY-MM-DD"
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// Common shopping/retail merchants that should NOT be considered bills
const SHOPPING_KEYWORDS = [
  'walmart', 'target', 'costco', 'amazon', 'dollar general', 'dollar tree',
  'family dollar', 'walgreens', 'cvs', 'rite aid', 'grocery', 'market',
  'food', 'restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'taco',
  'mcdonald', 'wendys', 'subway', 'chipotle', 'starbucks', 'dunkin',
  'gas', 'shell', 'exxon', 'chevron', 'bp', 'phillips', 'conoco', 'qt', 'quiktrip',
  'circle k', '7-eleven', 'wawa', 'sheetz', 'oncue', 'loves', 'pilot',
  'staples', 'office depot', 'best buy', 'home depot', 'lowes', 'menards',
  'braums', 'sonic', 'arbys', 'chick-fil-a', 'popeyes', 'kfc',
  'hobby lobby', 'michaels', 'joann', 'petsmart', 'petco',
  'ross', 'marshalls', 'tjmaxx', 'burlington', 'goodwill',
]

// Categories that are typically shopping, not bills
const SHOPPING_CATEGORIES = [
  'FOOD_AND_DRINK', 'SHOPPING', 'TRANSPORTATION', // gas is transportation
  'PERSONAL_CARE', 'ENTERTAINMENT', // unless it's a subscription
]

function detectRecurringBills(transactions: Transaction[]): RecurringBill[] {
  // Group transactions by merchant/name
  const merchantMap: Record<string, { amounts: number[]; dates: string[]; category: string | null; name: string }> = {}

  transactions.forEach((tx) => {
    if (tx.amount <= 0) return // Skip income
    const key = (tx.display_name || tx.merchant_name || tx.name).toLowerCase()
    const displayName = tx.display_name || tx.merchant_name || tx.name

    // Skip common shopping/retail merchants
    if (SHOPPING_KEYWORDS.some(keyword => key.includes(keyword))) return

    // Skip shopping categories (but allow subscriptions and utilities)
    if (tx.category && SHOPPING_CATEGORIES.includes(tx.category)) {
      // Exception: allow if amount is exactly the same (likely a subscription)
      // Check later in the grouping logic
    }

    if (!merchantMap[key]) {
      merchantMap[key] = { amounts: [], dates: [], category: tx.category, name: displayName }
    }
    merchantMap[key].amounts.push(tx.amount)
    merchantMap[key].dates.push(tx.date)
  })

  const recurring: RecurringBill[] = []

  Object.entries(merchantMap).forEach(([, data]) => {
    if (data.amounts.length >= 2) {
      // Check if amounts are similar (within 10% for potential bills)
      const avgAmount = data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length
      const allSimilar = data.amounts.every(
        (a) => Math.abs(a - avgAmount) / avgAmount < 0.1
      )

      // For shopping categories, require EXACT same amount (subscription)
      const isShoppingCategory = data.category && SHOPPING_CATEGORIES.includes(data.category)
      const allExact = data.amounts.every((a) => Math.abs(a - data.amounts[0]) < 0.01)

      // Skip if it's a shopping category and amounts aren't exactly the same
      if (isShoppingCategory && !allExact) return

      if (allSimilar) {
        // Check if dates are roughly monthly (within same week each month)
        const sortedDates = data.dates.map(d => parseLocalDate(d)).sort((a, b) => b.getTime() - a.getTime())
        if (sortedDates.length >= 2) {
          const days = sortedDates.map(d => d.getDate())
          const dayVariance = Math.max(...days) - Math.min(...days)

          // If day of month varies by more than 10 days, probably not a bill
          if (dayVariance > 10) return
        }

        const lastDate = parseLocalDate(data.dates[0])
        recurring.push({
          name: data.name,
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
      const day = parseLocalDate(tx.date).getDate()
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
    const day = parseLocalDate(tx.date).getDate()
    dayMap[day] = (dayMap[day] || 0) + 1
  })

  // Return days that appear more than once
  return Object.entries(dayMap)
    .filter(([, count]) => count >= 2)
    .map(([day]) => parseInt(day))
}

export function UpcomingBills({ transactions, isPro = false }: UpcomingBillsProps) {
  const router = useRouter()
  const [weekOffset, setWeekOffset] = useState(0)
  const [aiRecurringBills, setAiRecurringBills] = useState<RecurringBill[]>([])
  const [aiPaydays, setAiPaydays] = useState<number[]>([])
  const [loadingAI, setLoadingAI] = useState(false)
  const [usingAI, setUsingAI] = useState(false)

  // Fetch AI-detected recurring bills for Pro users
  useEffect(() => {
    if (!isPro) return

    const fetchAIRecurring = async () => {
      setLoadingAI(true)
      try {
        const response = await fetch('/api/recurring/detect')
        if (response.ok) {
          const data = await response.json()
          if (data.aiPowered && data.recurring?.length > 0) {
            // Convert AI results to RecurringBill format
            const bills: RecurringBill[] = []
            const paydays: number[] = []

            data.recurring.forEach((item: AIRecurringItem) => {
              if (item.type === 'income') {
                paydays.push(item.typical_day)
              } else {
                bills.push({
                  name: item.name,
                  amount: item.amount,
                  dayOfMonth: item.typical_day,
                  category: item.category,
                  confidence: item.confidence,
                  frequency: item.frequency,
                  amountVaries: item.amount_varies,
                  aiDetected: true,
                })
              }
            })

            setAiRecurringBills(bills)
            setAiPaydays(paydays)
            setUsingAI(true)
          }
        }
      } catch (error) {
        console.error('Failed to fetch AI recurring:', error)
      } finally {
        setLoadingAI(false)
      }
    }

    fetchAIRecurring()
  }, [isPro])

  // Use AI results if available, otherwise fall back to basic pattern matching
  const basicRecurringBills = useMemo(() => detectRecurringBills(transactions), [transactions])
  const basicPaydays = useMemo(() => detectPaydays(transactions), [transactions])

  const recurringBills = usingAI ? aiRecurringBills : basicRecurringBills
  const paydays = usingAI ? aiPaydays : basicPaydays

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
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Upcoming</CardTitle>
              {loadingAI && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {usingAI && !loadingAI && (
                <Badge variant="secondary" className="text-xs gap-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  <Sparkles className="h-3 w-3" />
                  AI Enhanced
                </Badge>
              )}
            </div>
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
                {usingAI && <span className="ml-1 text-purple-600">- AI Powered</span>}
              </p>
              <div className="max-h-[400px] space-y-1.5 overflow-y-auto">
                {recurringBills.map((bill, idx) => (
                  <button
                    key={idx}
                    onClick={() => router.push(`/dashboard/recurring?highlight=${encodeURIComponent(bill.name)}`)}
                    className="flex w-full items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <MerchantLogo
                        merchantName={bill.name}
                        category={bill.category}
                        size="sm"
                      />
                      <div className="flex flex-col items-start min-w-0">
                        <span className="truncate">{bill.name}</span>
                        {bill.aiDetected && (
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            {bill.frequency && (
                              <span className="capitalize">{bill.frequency}</span>
                            )}
                            {bill.amountVaries && (
                              <span className="text-amber-600">~varies</span>
                            )}
                            {bill.confidence && (
                              <span className={bill.confidence >= 90 ? 'text-green-600' : bill.confidence >= 75 ? 'text-amber-600' : 'text-muted-foreground'}>
                                {bill.confidence}% sure
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {bill.dayOfMonth}{getOrdinalSuffix(bill.dayOfMonth)}
                      </span>
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        {bill.amountVaries ? '~' : ''}{formatCurrency(bill.amount)}
                      </span>
                    </div>
                  </button>
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
