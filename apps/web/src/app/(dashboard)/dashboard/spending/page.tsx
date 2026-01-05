'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { formatCategory } from '@/lib/format'
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Pencil,
  DollarSign,
  CreditCard,
  ShoppingCart,
  Utensils,
  Car,
  Home,
  Zap,
  Heart,
  Plane,
  Gamepad2,
  GraduationCap,
  Gift,
  MoreHorizontal,
  PlusCircle,
  MinusCircle,
} from 'lucide-react'

interface MonthlyData {
  month: string
  year: number
  income: number
  bills: number
  spending: number
}

interface CategoryData {
  category: string
  amount: number
  percentage: number
  change: number
  transactionCount: number
}

interface FrequentMerchant {
  name: string
  count: number
  total: number
  average: number
}

interface LargestPurchase {
  id: string
  name: string
  amount: number
  date: string
}

interface SpendingData {
  period: { start: string; end: string }
  summary: {
    income: number
    bills: number
    spending: number
    spendingChange: number
  }
  uncategorizedCount: number
  categories: CategoryData[]
  monthlyData: MonthlyData[]
  frequentMerchants: FrequentMerchant[]
  largestPurchases: LargestPurchase[]
}

// Category icon mapping
const CATEGORY_ICONS: Record<string, typeof Utensils> = {
  'food': Utensils,
  'groceries': ShoppingCart,
  'shopping': ShoppingCart,
  'transportation': Car,
  'auto': Car,
  'home': Home,
  'bills': Zap,
  'utilities': Zap,
  'health': Heart,
  'travel': Plane,
  'entertainment': Gamepad2,
  'education': GraduationCap,
  'gifts': Gift,
  'dining': Utensils,
}

function getCategoryIcon(category: string) {
  const lower = category.toLowerCase()
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (lower.includes(key)) return icon
  }
  return MoreHorizontal
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatCompactCurrency(amount: number) {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`
  }
  return formatCurrency(amount)
}

// Donut Chart Component
function DonutChart({
  categories,
  totalSpend,
  spendingChange,
  includeBills,
  onIncludeBillsChange,
  onCategoryClick,
}: {
  categories: CategoryData[]
  totalSpend: number
  spendingChange: number
  includeBills: boolean
  onIncludeBillsChange: (value: boolean) => void
  onCategoryClick: (category: string) => void
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Generate colors for categories
  const colors = [
    '#f59e0b', // amber
    '#ef4444', // red
    '#22c55e', // green
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#6366f1', // indigo
    '#a855f7', // purple
  ]

  // Calculate donut segments
  const segments = useMemo(() => {
    let currentAngle = 0
    return categories.slice(0, 10).map((cat, idx) => {
      const angle = (cat.percentage / 100) * 360
      const segment = {
        ...cat,
        color: colors[idx % colors.length],
        startAngle: currentAngle,
        endAngle: currentAngle + angle,
      }
      currentAngle += angle
      return segment
    })
  }, [categories])

  // SVG arc path generator
  const getArcPath = (startAngle: number, endAngle: number, innerRadius: number, outerRadius: number, center: number = 150) => {
    const startRad = (startAngle - 90) * (Math.PI / 180)
    const endRad = (endAngle - 90) * (Math.PI / 180)

    const x1 = center + outerRadius * Math.cos(startRad)
    const y1 = center + outerRadius * Math.sin(startRad)
    const x2 = center + outerRadius * Math.cos(endRad)
    const y2 = center + outerRadius * Math.sin(endRad)
    const x3 = center + innerRadius * Math.cos(endRad)
    const y3 = center + innerRadius * Math.sin(endRad)
    const x4 = center + innerRadius * Math.cos(startRad)
    const y4 = center + innerRadius * Math.sin(startRad)

    const largeArc = endAngle - startAngle > 180 ? 1 : 0

    return `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
  }

  const hoveredCategory = hoveredIndex !== null ? segments[hoveredIndex] : null

  return (
    <div className="relative">
      {/* Include Bills Toggle */}
      <div className="absolute right-0 top-0 flex items-center gap-2">
        <Label htmlFor="include-bills" className="text-sm text-muted-foreground">
          Include bills
        </Label>
        <Switch
          id="include-bills"
          checked={includeBills}
          onCheckedChange={onIncludeBillsChange}
        />
      </div>

      <div className="flex flex-col items-center pt-8">
        {/* Chart Container */}
        <div
          ref={containerRef}
          className="relative w-[320px] sm:w-[380px] md:w-[500px] lg:w-[580px] xl:w-[450px]"
          onMouseMove={handleMouseMove}
        >
          <svg className="w-full h-auto" viewBox="0 0 300 300">
            {segments.map((segment, idx) => {
              const isHovered = hoveredIndex === idx
              return (
                <path
                  key={idx}
                  d={getArcPath(segment.startAngle, segment.endAngle, 70, isHovered ? 125 : 115, 150)}
                  fill={segment.color}
                  className="cursor-pointer transition-all duration-200"
                  style={{
                    opacity: hoveredIndex !== null && !isHovered ? 0.4 : 1,
                    filter: isHovered ? 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))' : 'none',
                  }}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => onCategoryClick(segment.category)}
                />
              )
            })}
          </svg>

          {/* Floating Tooltip near mouse */}
          {hoveredCategory && (
            <div
              className="absolute z-20 bg-white dark:bg-slate-800 rounded-lg shadow-lg border p-3 min-w-[180px] pointer-events-none"
              style={{
                left: mousePos.x + 15,
                top: mousePos.y - 60,
                transform: mousePos.x > 180 ? 'translateX(-100%) translateX(-30px)' : 'none',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: hoveredCategory.color }}
                />
                <p className="font-semibold">{formatCategory(hoveredCategory.category)}</p>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(hoveredCategory.amount)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {hoveredCategory.percentage}% of total
              </p>
              <p className={`flex items-center text-sm mt-1 ${hoveredCategory.change > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {hoveredCategory.change > 0 ? <ArrowUp className="h-4 w-4 mr-1" /> : <ArrowDown className="h-4 w-4 mr-1" />}
                {Math.abs(hoveredCategory.change)}% vs last month
              </p>
            </div>
          )}

          {/* Center Content - always shows total */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-sm text-muted-foreground font-medium">TOTAL SPEND</p>
            <p className="text-3xl font-bold mt-1">{formatCurrency(totalSpend)}</p>
            <p className={`flex items-center text-sm mt-2 ${spendingChange > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {spendingChange > 0 ? <ArrowUp className="h-4 w-4 mr-1" /> : <ArrowDown className="h-4 w-4 mr-1" />}
              {Math.abs(spendingChange)}% vs last month
            </p>
          </div>
        </div>

        {/* Category Legend */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 mt-8 w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl">
          {segments.map((segment, idx) => (
            <button
              key={idx}
              className={`flex items-center gap-2 text-left transition-all rounded-lg px-2 py-1 -mx-2 ${
                hoveredIndex === idx ? 'bg-muted' : 'hover:bg-muted/50'
              }`}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => onCategoryClick(segment.category)}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-sm truncate flex-1">{formatCategory(segment.category)}</span>
              <span className="text-sm font-medium text-muted-foreground">
                {segment.percentage}%
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Monthly Bar Chart Component
function MonthlyBarChart({
  data,
  selectedMonth,
  onMonthSelect,
}: {
  data: MonthlyData[]
  selectedMonth: number
  onMonthSelect: (index: number) => void
}) {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const chartRef = useRef<HTMLDivElement>(null)

  const maxValue = Math.max(...data.map(d => d.income + d.bills + d.spending)) * 1.1

  const handleMouseMove = (e: React.MouseEvent) => {
    if (chartRef.current) {
      const rect = chartRef.current.getBoundingClientRect()
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
  }

  const hoveredData = hoveredMonth !== null ? data[hoveredMonth] : null

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between px-4">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div
            ref={chartRef}
            className="flex flex-1 items-end justify-around gap-2 h-[180px] relative"
            onMouseMove={handleMouseMove}
          >
            {/* Floating Tooltip */}
            {hoveredData && (
              <div
                className="absolute z-20 bg-white dark:bg-slate-800 rounded-lg shadow-lg border p-3 min-w-[160px] pointer-events-none"
                style={{
                  left: mousePos.x + 15,
                  top: mousePos.y - 80,
                  transform: mousePos.x > (chartRef.current?.offsetWidth || 0) - 200 ? 'translateX(-100%) translateX(-30px)' : 'none',
                }}
              >
                <p className="font-semibold mb-3">{hoveredData.month}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-300" />
                    <div>
                      <p className="text-muted-foreground">Income</p>
                      <p className="font-semibold text-green-600">{formatCurrency(hoveredData.income)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-900" />
                    <div>
                      <p className="text-muted-foreground">Bills & Utilities</p>
                      <p className="font-semibold">{formatCurrency(hoveredData.bills)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <div>
                      <p className="text-muted-foreground">Spending</p>
                      <p className="font-semibold">{formatCurrency(hoveredData.spending)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {data.map((month, idx) => {
              const incomeHeight = (month.income / maxValue) * 100
              const billsHeight = (month.bills / maxValue) * 100
              const spendingHeight = ((month.spending - month.bills) / maxValue) * 100
              const isSelected = idx === selectedMonth

              return (
                <div key={idx} className="flex flex-col items-center gap-2 flex-1 relative">
                  {/* Bar */}
                  <button
                    className="w-full max-w-[60px] flex flex-col cursor-pointer"
                    onClick={() => onMonthSelect(idx)}
                    onMouseEnter={() => setHoveredMonth(idx)}
                    onMouseLeave={() => setHoveredMonth(null)}
                  >
                    <div className="flex flex-col w-full" style={{ height: '140px' }}>
                      <div className="flex-1" />
                      {/* Income (light blue) */}
                      <div
                        className="w-full bg-blue-300 rounded-t transition-all"
                        style={{ height: `${incomeHeight}%` }}
                      />
                      {/* Bills (dark blue) */}
                      <div
                        className="w-full bg-blue-900 transition-all"
                        style={{ height: `${billsHeight}%` }}
                      />
                      {/* Spending (medium blue) */}
                      <div
                        className="w-full bg-blue-500 rounded-b transition-all"
                        style={{ height: `${spendingHeight}%` }}
                      />
                    </div>
                  </button>

                  {/* Month Label */}
                  <span
                    className={`text-sm ${
                      isSelected
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-2 py-0.5 rounded-full font-medium'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {month.month}
                  </span>
                </div>
              )
            })}
          </div>

          <Button variant="ghost" size="icon">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Category List Component
function CategoryList({
  categories,
  onCategoryClick,
}: {
  categories: CategoryData[]
  onCategoryClick: (category: string) => void
}) {
  return (
    <div className="space-y-1">
      {/* Header - hidden on mobile */}
      <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b">
        <div className="col-span-5">Category</div>
        <div className="col-span-2 text-right">% Spend</div>
        <div className="col-span-3 text-center">Change</div>
        <div className="col-span-2 text-right">Amount</div>
      </div>

      {/* Rows */}
      {categories.map((cat) => {
        const Icon = getCategoryIcon(cat.category)
        return (
          <button
            key={cat.category}
            onClick={() => onCategoryClick(cat.category)}
            className="flex md:grid md:grid-cols-12 gap-3 md:gap-4 px-3 md:px-4 py-3 w-full text-left hover:bg-muted/50 rounded-lg transition-colors items-center"
          >
            {/* Mobile: Simple flex layout */}
            <div className="flex items-center gap-3 flex-1 md:col-span-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted flex-shrink-0">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-medium truncate block">{formatCategory(cat.category)}</span>
                {/* Mobile: show percentage and change inline */}
                <span className="md:hidden text-xs text-muted-foreground">
                  {cat.percentage}% •
                  <span className={cat.change > 0 ? 'text-red-500' : cat.change < 0 ? 'text-green-500' : ''}>
                    {cat.change > 0 ? '↑' : cat.change < 0 ? '↓' : ''}{Math.abs(cat.change)}%
                  </span>
                </span>
              </div>
            </div>
            {/* Desktop: grid columns */}
            <div className="hidden md:block col-span-2 text-right text-sm text-muted-foreground">
              {cat.percentage}%
            </div>
            <div className="hidden md:flex col-span-3 items-center justify-center">
              <span
                className={`flex items-center gap-1 text-sm ${
                  cat.change > 0 ? 'text-red-500' : cat.change < 0 ? 'text-green-500' : 'text-muted-foreground'
                }`}
              >
                {cat.change > 0 ? (
                  <ArrowUp className="h-3 w-3" />
                ) : cat.change < 0 ? (
                  <ArrowDown className="h-3 w-3" />
                ) : null}
                {Math.abs(cat.change)}%
              </span>
            </div>
            <div className="text-right font-semibold md:col-span-2 flex-shrink-0">
              {formatCompactCurrency(cat.amount)}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// Main Spending Page
export default function SpendingPage() {
  const router = useRouter()
  const [data, setData] = useState<SpendingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('this_month')
  const [selectedMonth, setSelectedMonth] = useState(5) // Current month (last in array)
  const [includeBills, setIncludeBills] = useState(true)

  // Custom date range state - separate "pending" dates from "applied" dates
  const [pendingStartDate, setPendingStartDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    return date.toISOString().split('T')[0]
  })
  const [pendingEndDate, setPendingEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  // Applied dates only update when user clicks "Apply"
  const [appliedStartDate, setAppliedStartDate] = useState(pendingStartDate)
  const [appliedEndDate, setAppliedEndDate] = useState(pendingEndDate)

  const handleApplyCustomDates = () => {
    setAppliedStartDate(pendingStartDate)
    setAppliedEndDate(pendingEndDate)
  }

  // Check if pending dates differ from applied dates
  const hasUnappliedChanges = period === 'custom' && (
    pendingStartDate !== appliedStartDate || pendingEndDate !== appliedEndDate
  )

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        let url = `/api/spending?period=${period}`
        if (period === 'custom') {
          url = `/api/spending?period=custom&start_date=${appliedStartDate}&end_date=${appliedEndDate}`
        }
        const response = await fetch(url)
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      } catch (error) {
        console.error('Error fetching spending data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [period, appliedStartDate, appliedEndDate])

  const handleCategoryClick = (category: string) => {
    // Pass current period and custom dates as query params
    const params = new URLSearchParams()
    params.set('period', period)
    if (period === 'custom') {
      params.set('start', appliedStartDate)
      params.set('end', appliedEndDate)
    }
    router.push(`/dashboard/spending/category/${encodeURIComponent(category)}?${params.toString()}`)
  }

  const handleUpdateUncategorized = () => {
    router.push('/dashboard/spending/uncategorized')
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="text-muted-foreground">Loading spending data...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Failed to load spending data</p>
      </div>
    )
  }

  const filteredCategories = includeBills
    ? data.categories
    : data.categories.filter(c => {
        const lower = c.category.toLowerCase()
        return !lower.includes('bill') && !lower.includes('utilit')
      })

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-bold">Spending</h1>

        {/* Period Tabs */}
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="last_month" className="flex-1 sm:flex-none text-xs sm:text-sm">Last Month</TabsTrigger>
            <TabsTrigger value="this_month" className="flex-1 sm:flex-none text-xs sm:text-sm">This Month</TabsTrigger>
            <TabsTrigger value="custom" className="flex-1 sm:flex-none text-xs sm:text-sm">Custom</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Custom Date Range Picker */}
      {period === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">From:</label>
            <input
              type="date"
              value={pendingStartDate}
              onChange={(e) => setPendingStartDate(e.target.value)}
              className="px-3 py-1.5 text-sm border rounded-md bg-background"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">To:</label>
            <input
              type="date"
              value={pendingEndDate}
              onChange={(e) => setPendingEndDate(e.target.value)}
              className="px-3 py-1.5 text-sm border rounded-md bg-background"
            />
          </div>
          <Button
            onClick={handleApplyCustomDates}
            disabled={!hasUnappliedChanges}
            className={hasUnappliedChanges
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : ''
            }
          >
            {hasUnappliedChanges ? 'Apply' : 'Applied'}
          </Button>
          {hasUnappliedChanges && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Click Apply to load data
            </span>
          )}
        </div>
      )}

      {/* Monthly Bar Chart */}
      <MonthlyBarChart
        data={data.monthlyData}
        selectedMonth={selectedMonth}
        onMonthSelect={setSelectedMonth}
      />

      {/* Main Content Grid */}
      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        {/* Left Column - Spending Breakdown */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          {/* Spending Breakdown Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                SPENDING BREAKDOWN
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DonutChart
                categories={filteredCategories}
                totalSpend={data.summary.spending}
                spendingChange={data.summary.spendingChange}
                includeBills={includeBills}
                onIncludeBillsChange={setIncludeBills}
                onCategoryClick={handleCategoryClick}
              />
            </CardContent>
          </Card>

          {/* Category List */}
          <Card>
            <CardContent className="pt-6">
              <CategoryList
                categories={filteredCategories}
                onCategoryClick={handleCategoryClick}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Summary & Insights */}
        <div className="space-y-4 md:space-y-6">
          {/* Needs Categorization */}
          {data.uncategorizedCount > 0 && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  NEEDS CATEGORIZATION
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={handleUpdateUncategorized}
                >
                  <span className="flex items-center gap-2">
                    <Pencil className="h-4 w-4" />
                    Update {data.uncategorizedCount} transactions
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Summary Card */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  SUMMARY
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {new Date(data.period.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
                  {new Date(data.period.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Income */}
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-3">
                  <PlusCircle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Income</p>
                    <p className="text-xs text-muted-foreground">
                      {data.frequentMerchants.length} income events
                    </p>
                  </div>
                </div>
                <span className="text-green-600 font-semibold">
                  +{formatCurrency(data.summary.income)}
                </span>
              </div>

              {/* Bills */}
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-3">
                  <MinusCircle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Bills</p>
                    <p className="text-xs text-muted-foreground">
                      Recurring bills
                    </p>
                  </div>
                </div>
                <span className="font-semibold">
                  {formatCurrency(data.summary.bills)}
                </span>
              </div>

              {/* Spending */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <MinusCircle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Spending</p>
                    <p className="text-xs text-muted-foreground">
                      {data.summary.spendingChange > 0 ? (
                        <span className="text-red-500">
                          ${Math.abs(data.summary.spendingChange * data.summary.spending / 100).toFixed(0)} more than last month
                        </span>
                      ) : (
                        <span className="text-green-500">
                          ${Math.abs(data.summary.spendingChange * data.summary.spending / 100).toFixed(0)} less than last month
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <span className="font-semibold">
                  {formatCurrency(data.summary.spending)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Frequent Spend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                FREQUENT SPEND
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.frequentMerchants.length > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    You&apos;ve spent at <span className="font-medium text-foreground">{data.frequentMerchants[0]?.name}</span>{' '}
                    {data.frequentMerchants[0]?.count} times this month
                  </p>
                  <div className="space-y-3">
                    {data.frequentMerchants.slice(0, 3).map((merchant, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{merchant.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Average {formatCurrency(merchant.average)}
                          </p>
                        </div>
                        <span className="font-semibold">{formatCurrency(merchant.total)}</span>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="w-full mt-4">
                    See more
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No frequent spending detected</p>
              )}
            </CardContent>
          </Card>

          {/* Largest Purchases */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                LARGEST PURCHASES
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.largestPurchases.length > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your top 3 expenses accounted for{' '}
                    {Math.round(
                      (data.largestPurchases.slice(0, 3).reduce((sum, p) => sum + p.amount, 0) /
                        data.summary.spending) *
                        100
                    )}
                    % of your spend this month.
                  </p>
                  <div className="space-y-3">
                    {data.largestPurchases.slice(0, 3).map((purchase, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{purchase.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(purchase.date).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <span className="font-semibold">{formatCurrency(purchase.amount)}</span>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="w-full mt-4">
                    See more
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No purchases found</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
