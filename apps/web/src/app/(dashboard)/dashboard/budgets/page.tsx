'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  PiggyBank,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Calendar,
  Target,
  Zap,
  ArrowUp,
  ArrowDown,
  Clock,
  DollarSign,
  X,
  Check,
  Sparkles,
  ShoppingCart,
  Utensils,
  Car,
  Home,
  Heart,
  Plane,
  Gamepad2,
  GraduationCap,
  Gift,
  MoreHorizontal,
} from 'lucide-react'

interface Transaction {
  id: string
  name: string
  merchant_name: string | null
  amount: number
  date: string
  category: string | null
  display_name: string | null
}

interface BudgetCategory {
  category: string
  budgetId: string | null
  budgeted: number
  spent: number
  remaining: number
  percentUsed: number
  lastMonthSpent: number
  changeFromLastMonth: number
  dailyAverage: number
  projectedSpend: number
  status: 'under' | 'warning' | 'over'
  transactions: Transaction[]
}

interface Alert {
  category: string
  type: 'over' | 'warning' | 'projected_over'
  message: string
  amount: number
}

interface SuggestedCategory {
  category: string
  averageSpend: number
  suggestedBudget: number
}

interface BudgetData {
  period: {
    month: string
    year: number
    daysLeft: number
    daysPassed: number
    daysInMonth: number
    startDate: string
    endDate: string
  }
  summary: {
    totalBudgeted: number
    totalSpent: number
    totalRemaining: number
    totalPercentUsed: number
    lastMonthTotal: number
    monthOverMonthChange: number
    dailyAverage: number
    projectedTotal: number
    projectedRemaining: number
    isOnTrack: boolean
    trackingDifference: number
    budgetedCategoriesCount: number
    totalCategoriesCount: number
  }
  categories: BudgetCategory[]
  alerts: Alert[]
  suggestedCategories: SuggestedCategory[]
}

// Category icon mapping
const CATEGORY_ICONS: Record<string, typeof Utensils> = {
  food: Utensils,
  groceries: ShoppingCart,
  shopping: ShoppingCart,
  transportation: Car,
  auto: Car,
  home: Home,
  bills: Zap,
  utilities: Zap,
  health: Heart,
  travel: Plane,
  entertainment: Gamepad2,
  education: GraduationCap,
  gifts: Gift,
  dining: Utensils,
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatCurrencyFull(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function formatCategory(category: string): string {
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

// Budget Overview Ring Chart
function BudgetRingChart({
  spent,
  budgeted,
  daysLeft,
  isOnTrack,
}: {
  spent: number
  budgeted: number
  daysLeft: number
  isOnTrack: boolean
}) {
  const percentUsed = budgeted > 0 ? Math.min((spent / budgeted) * 100, 100) : 0
  const remaining = budgeted - spent

  // Calculate the arc
  const radius = 90
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentUsed / 100) * circumference

  // Determine color based on status
  const getColor = () => {
    if (spent > budgeted) return '#ef4444' // red
    if (percentUsed > 80) return '#f59e0b' // amber
    return '#10b981' // green
  }

  return (
    <div className="relative flex items-center justify-center">
      <svg width="220" height="220" viewBox="0 0 220 220">
        {/* Background circle */}
        <circle
          cx="110"
          cy="110"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="16"
          className="text-muted/30"
        />
        {/* Progress arc */}
        <circle
          cx="110"
          cy="110"
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 110 110)"
          className="transition-all duration-500"
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-sm text-muted-foreground font-medium">
          {remaining >= 0 ? 'LEFT TO SPEND' : 'OVER BUDGET'}
        </p>
        <p className={`text-3xl font-bold mt-1 ${remaining >= 0 ? '' : 'text-red-500'}`}>
          {formatCurrency(Math.abs(remaining))}
        </p>
        <div className="flex items-center gap-1 mt-2">
          {isOnTrack ? (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              On Track
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Ahead of Pace
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {daysLeft} days left
        </p>
      </div>
    </div>
  )
}

// Budget Category Card
function BudgetCategoryCard({
  category,
  onUpdateBudget,
  onDeleteBudget,
}: {
  category: BudgetCategory
  onUpdateBudget: (category: string, amount: number) => void
  onDeleteBudget: (budgetId: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editAmount, setEditAmount] = useState(category.budgeted.toString())
  const Icon = getCategoryIcon(category.category)

  const handleSave = () => {
    const amount = parseFloat(editAmount)
    if (!isNaN(amount) && amount > 0) {
      onUpdateBudget(category.category, amount)
    }
    setIsEditing(false)
  }

  const getStatusColor = () => {
    if (category.status === 'over') return 'bg-red-500'
    if (category.status === 'warning') return 'bg-amber-500'
    return 'bg-emerald-500'
  }

  const getStatusBg = () => {
    if (category.status === 'over') return 'bg-red-50 dark:bg-red-950/30'
    if (category.status === 'warning') return 'bg-amber-50 dark:bg-amber-950/30'
    return ''
  }

  return (
    <div className={`rounded-xl border transition-all ${getStatusBg()}`}>
      {/* Main Row */}
      <div className="p-4">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
            category.status === 'over'
              ? 'bg-red-100 dark:bg-red-900/30'
              : category.status === 'warning'
                ? 'bg-amber-100 dark:bg-amber-900/30'
                : 'bg-emerald-100 dark:bg-emerald-900/30'
          }`}>
            <Icon className={`h-6 w-6 ${
              category.status === 'over'
                ? 'text-red-600'
                : category.status === 'warning'
                  ? 'text-amber-600'
                  : 'text-emerald-600'
            }`} />
          </div>

          {/* Category Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{formatCategory(category.category)}</h3>
              {category.status === 'over' && (
                <Badge variant="destructive" className="text-xs">
                  Over
                </Badge>
              )}
            </div>

            {/* Progress Bar */}
            {category.budgeted > 0 && (
              <div className="mt-2">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${getStatusColor()}`}
                    style={{ width: `${Math.min(category.percentUsed, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Stats Row */}
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">{formatCurrency(category.spent)}</span>
                {category.budgeted > 0 && (
                  <span> of {formatCurrency(category.budgeted)}</span>
                )}
              </span>
              {category.budgeted > 0 && (
                <span className={`font-medium ${category.remaining >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {category.remaining >= 0 ? `${formatCurrency(category.remaining)} left` : `${formatCurrency(Math.abs(category.remaining))} over`}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {category.budgeted > 0 ? (
              <>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-24 h-8"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSave}>
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditing(false)}>
                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditAmount(category.budgeted.toString())
                        setIsEditing(true)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => category.budgetId && onDeleteBudget(category.budgetId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditAmount(Math.ceil(category.spent / 10) * 10 + 50 + '')
                  setIsEditing(true)
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Set Budget
              </Button>
            )}
            {category.transactions.length > 0 && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Insights Row */}
        {category.budgeted > 0 && (
          <div className="flex items-center gap-6 mt-3 pt-3 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              <span>Daily avg: {formatCurrency(category.dailyAverage)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              <span>Projected: {formatCurrency(category.projectedSpend)}</span>
            </div>
            <div className={`flex items-center gap-1 ${category.changeFromLastMonth > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {category.changeFromLastMonth > 0 ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )}
              <span>{Math.abs(Math.round(category.changeFromLastMonth))}% vs last month</span>
            </div>
          </div>
        )}
      </div>

      {/* Expanded Transactions */}
      {isExpanded && category.transactions.length > 0 && (
        <div className="border-t bg-muted/30 p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">RECENT TRANSACTIONS</p>
          <div className="space-y-2">
            {category.transactions.slice(0, 5).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{tx.display_name || tx.merchant_name || tx.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <span className="font-medium">{formatCurrencyFull(tx.amount)}</span>
              </div>
            ))}
            {category.transactions.length > 5 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                +{category.transactions.length - 5} more transactions
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Alerts Section
function AlertsSection({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null

  return (
    <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Budget Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {alerts.slice(0, 3).map((alert, idx) => (
            <div key={idx} className="flex items-center justify-between py-2 border-b border-amber-200/50 last:border-0">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  alert.type === 'over' ? 'bg-red-500' : 'bg-amber-500'
                }`} />
                <span className="font-medium">{formatCategory(alert.category)}</span>
              </div>
              <span className="text-sm text-muted-foreground">{alert.message}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Add Budget Modal
function AddBudgetSection({
  suggestedCategories,
  existingCategories,
  onAddBudget,
  onClose,
}: {
  suggestedCategories: SuggestedCategory[]
  existingCategories: string[]
  onAddBudget: (category: string, amount: number) => void
  onClose: () => void
}) {
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')

  const handleAdd = () => {
    if (category && amount) {
      onAddBudget(category, parseFloat(amount))
      setCategory('')
      setAmount('')
      onClose()
    }
  }

  return (
    <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-5 w-5 text-emerald-600" />
            Add New Budget
          </CardTitle>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Suggested Categories */}
        {suggestedCategories.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              <Sparkles className="h-3 w-3 inline mr-1" />
              SUGGESTED BASED ON SPENDING
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedCategories
                .filter((s) => !existingCategories.includes(s.category))
                .map((suggestion) => (
                  <Button
                    key={suggestion.category}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setCategory(suggestion.category)
                      setAmount(suggestion.suggestedBudget.toString())
                    }}
                  >
                    {formatCategory(suggestion.category)} · {formatCurrency(suggestion.suggestedBudget)}
                  </Button>
                ))}
            </div>
          </div>
        )}

        {/* Manual Input */}
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              placeholder="Category name"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="w-32">
            <Input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <Button
            onClick={handleAdd}
            disabled={!category || !amount}
            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
          >
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Main Page
export default function BudgetsPage() {
  const [data, setData] = useState<BudgetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddBudget, setShowAddBudget] = useState(false)
  const [showUnbudgeted, setShowUnbudgeted] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/budgets/analytics')
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Error fetching budget data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleUpdateBudget = async (category: string, amount: number) => {
    await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, amount }),
    })
    fetchData()
  }

  const handleDeleteBudget = async (budgetId: string) => {
    await fetch(`/api/budgets?id=${budgetId}`, { method: 'DELETE' })
    fetchData()
  }

  const budgetedCategories = data?.categories.filter((c) => c.budgeted > 0) || []
  const unbudgetedCategories = data?.categories.filter((c) => !c.budgeted && c.spent > 0) || []

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="text-muted-foreground">Loading budgets...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Failed to load budget data</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budgets</h1>
          <p className="text-muted-foreground">
            {data.period.month} {data.period.year} · {data.period.daysLeft} days remaining
          </p>
        </div>
        <Button
          onClick={() => setShowAddBudget(!showAddBudget)}
          className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Budget
        </Button>
      </div>

      {/* Add Budget Section */}
      {showAddBudget && (
        <AddBudgetSection
          suggestedCategories={data.suggestedCategories}
          existingCategories={budgetedCategories.map((c) => c.category)}
          onAddBudget={handleUpdateBudget}
          onClose={() => setShowAddBudget(false)}
        />
      )}

      {/* Alerts */}
      <AlertsSection alerts={data.alerts} />

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Overview */}
        <div className="space-y-6">
          {/* Ring Chart Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-center">
                <BudgetRingChart
                  spent={data.summary.totalSpent}
                  budgeted={data.summary.totalBudgeted}
                  daysLeft={data.period.daysLeft}
                  isOnTrack={data.summary.isOnTrack}
                />
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                MONTHLY SUMMARY
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span>Total Budgeted</span>
                </div>
                <span className="font-semibold">{formatCurrency(data.summary.totalBudgeted)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>Spent So Far</span>
                </div>
                <span className="font-semibold">{formatCurrency(data.summary.totalSpent)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Daily Average</span>
                </div>
                <span className="font-semibold">{formatCurrency(data.summary.dailyAverage)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span>Projected Total</span>
                </div>
                <span className={`font-semibold ${
                  data.summary.projectedTotal > data.summary.totalBudgeted ? 'text-red-500' : 'text-green-500'
                }`}>
                  {formatCurrency(data.summary.projectedTotal)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Month Comparison */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                VS LAST MONTH
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    {data.summary.monthOverMonthChange > 0 ? '+' : ''}
                    {Math.round(data.summary.monthOverMonthChange)}%
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {data.summary.monthOverMonthChange > 0 ? 'More' : 'Less'} than last month
                  </p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                  data.summary.monthOverMonthChange > 0
                    ? 'bg-red-100 dark:bg-red-900/30'
                    : 'bg-green-100 dark:bg-green-900/30'
                }`}>
                  {data.summary.monthOverMonthChange > 0 ? (
                    <TrendingUp className="h-6 w-6 text-red-600" />
                  ) : (
                    <TrendingDown className="h-6 w-6 text-green-600" />
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Last month total: {formatCurrency(data.summary.lastMonthTotal)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Categories */}
        <div className="lg:col-span-2 space-y-6">
          {/* Budgeted Categories */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                Budget Categories ({budgetedCategories.length})
              </h2>
            </div>

            {budgetedCategories.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <PiggyBank className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <h3 className="font-medium">No budgets set yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add a budget to start tracking your spending
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => setShowAddBudget(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Budget
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {budgetedCategories.map((category) => (
                  <BudgetCategoryCard
                    key={category.category}
                    category={category}
                    onUpdateBudget={handleUpdateBudget}
                    onDeleteBudget={handleDeleteBudget}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Unbudgeted Spending */}
          {unbudgetedCategories.length > 0 && (
            <div>
              <button
                className="flex items-center justify-between w-full mb-4"
                onClick={() => setShowUnbudgeted(!showUnbudgeted)}
              >
                <h2 className="text-lg font-semibold">
                  Spending Without Budget ({unbudgetedCategories.length})
                </h2>
                <ChevronRight className={`h-5 w-5 transition-transform ${showUnbudgeted ? 'rotate-90' : ''}`} />
              </button>

              {showUnbudgeted && (
                <div className="space-y-3">
                  {unbudgetedCategories.map((category) => (
                    <BudgetCategoryCard
                      key={category.category}
                      category={category}
                      onUpdateBudget={handleUpdateBudget}
                      onDeleteBudget={handleDeleteBudget}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
