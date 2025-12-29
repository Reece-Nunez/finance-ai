'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Lightbulb,
  RefreshCw,
  Sparkles,
  X,
  ArrowRightLeft,
  PiggyBank,
  Receipt,
  Wallet,
  Brain,
  Calendar,
} from 'lucide-react'

interface Suggestion {
  id: string
  action_type: string
  status: string
  details: {
    priority: string
    title: string
    description: string
    action?: {
      from_account: string
      to_account: string
      amount: number
    }
  }
  created_at: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'urgent':
      return 'text-red-600 bg-red-100 dark:bg-red-900/30'
    case 'high':
      return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30'
    case 'medium':
      return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30'
    default:
      return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30'
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'transfer':
      return <ArrowRightLeft className="h-5 w-5" />
    case 'alert':
      return <AlertTriangle className="h-5 w-5" />
    case 'budget_warning':
      return <Wallet className="h-5 w-5" />
    case 'bill_reminder':
      return <Calendar className="h-5 w-5" />
    case 'savings_opportunity':
      return <PiggyBank className="h-5 w-5" />
    case 'tip':
      return <Lightbulb className="h-5 w-5" />
    default:
      return <Brain className="h-5 w-5" />
  }
}

interface SuggestionContext {
  avgDailySpending?: number
  lowBalanceThreshold?: number
  upcomingBillsCount?: number
  budgetsTracked?: number
  patternsLearned?: number
}

export function AISuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [context, setContext] = useState<SuggestionContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchSuggestions = useCallback(async () => {
    try {
      const response = await fetch('/api/ai/suggestions')
      const data = await response.json()
      setSuggestions(data.suggestions || [])
    } catch (error) {
      console.error('Error fetching suggestions:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const generateSuggestions = async () => {
    setRefreshing(true)
    try {
      const response = await fetch('/api/ai/suggestions', { method: 'POST' })
      const data = await response.json()
      setSuggestions(data.suggestions || [])
      if (data.context) {
        setContext(data.context)
      }
    } catch (error) {
      console.error('Error generating suggestions:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const updateSuggestion = async (id: string, status: string) => {
    try {
      await fetch('/api/ai/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      // Remove from list or update status
      if (status === 'dismissed') {
        setSuggestions(suggestions.filter((s) => s.id !== id))
      } else {
        setSuggestions(
          suggestions.map((s) => (s.id === id ? { ...s, status } : s))
        )
      }
    } catch (error) {
      console.error('Error updating suggestion:', error)
    }
  }

  useEffect(() => {
    fetchSuggestions()
  }, [fetchSuggestions])

  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending')

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 p-2">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2">
              AI Suggestions
              {context && context.patternsLearned && context.patternsLearned > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                  <Brain className="h-3 w-3" />
                  Personalized
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {context && context.patternsLearned && context.patternsLearned > 0
                ? `Using ${context.patternsLearned} learned patterns, ${context.upcomingBillsCount || 0} upcoming bills`
                : 'Smart recommendations based on your spending'}
            </CardDescription>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={generateSuggestions}
          disabled={refreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Analyze
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : pendingSuggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="mb-4 h-12 w-12 text-emerald-500" />
            <h3 className="font-medium">All good!</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              No issues detected. Click &quot;Analyze&quot; to check again.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pending Suggestions */}
            {pendingSuggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="rounded-lg border p-4 transition-all hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`rounded-full p-2 ${getPriorityColor(
                        suggestion.details.priority
                      )}`}
                    >
                      {getTypeIcon(suggestion.action_type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{suggestion.details.title}</h4>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityColor(
                            suggestion.details.priority
                          )}`}
                        >
                          {suggestion.details.priority}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {suggestion.details.description}
                      </p>

                      {/* Transfer Details */}
                      {suggestion.action_type === 'transfer' &&
                        suggestion.details.action && (
                          <div className="mt-3 rounded-lg bg-muted p-3">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium">
                                {suggestion.details.action.from_account}
                              </span>
                              <ArrowRight className="h-4 w-4" />
                              <span className="font-medium">
                                {suggestion.details.action.to_account}
                              </span>
                            </div>
                            <div className="mt-1 text-lg font-bold text-emerald-600">
                              {formatCurrency(suggestion.details.action.amount)}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => updateSuggestion(suggestion.id, 'dismissed')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Action Buttons */}
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                    onClick={() => updateSuggestion(suggestion.id, 'approved')}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Got it
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateSuggestion(suggestion.id, 'dismissed')}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
