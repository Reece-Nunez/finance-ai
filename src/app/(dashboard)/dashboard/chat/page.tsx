'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Send,
  Sparkles,
  User,
  Loader2,
  Plus,
  MessageSquare,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  PiggyBank,
  Target,
  AlertTriangle,
  CheckCircle,
  Heart,
  Zap,
  ArrowRight,
  RefreshCw,
  ChevronRight,
  Wallet,
  BarChart3,
  HelpCircle,
  X,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { formatCategory } from '@/lib/format'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatSession {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface Insight {
  title: string
  value: string
  trend?: 'up' | 'down' | 'neutral'
  subtitle?: string
}

interface Suggestion {
  text: string
  priority: 'high' | 'medium' | 'low'
  type: string
}

interface InsightsData {
  period: {
    month: string
    year: number
    daysLeft: number
    daysPassed: number
    daysInMonth: number
  }
  stats: {
    currentSpending: number
    currentIncome: number
    netCashFlow: number
    totalBalance: number
    budgetRemaining: number
    budgetPercentUsed: number
    spendingChange: number
    topCategory: { name: string; amount: number }
    categoriesOverBudget: string[]
  }
  healthScore: number
  healthStatus: 'excellent' | 'good' | 'fair' | 'needs_attention'
  insights: Insight[]
  suggestions: Suggestion[]
}

// Quick Action Card Component
function QuickActionCard({
  icon: Icon,
  title,
  subtitle,
  onClick,
  variant = 'default',
}: {
  icon: typeof DollarSign
  title: string
  subtitle: string
  onClick: () => void
  variant?: 'default' | 'warning' | 'success'
}) {
  const bgClass = variant === 'warning'
    ? 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200'
    : variant === 'success'
      ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200'
      : 'hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30'

  const iconClass = variant === 'warning'
    ? 'text-amber-600'
    : variant === 'success'
      ? 'text-green-600'
      : 'text-emerald-600'

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${bgClass}`}
    >
      <div className={`rounded-full bg-white p-2 shadow-sm ${iconClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  )
}

// Health Score Ring with explanation
function HealthScoreRing({ score, status, stats }: {
  score: number
  status: string
  stats?: {
    budgetPercentUsed: number
    netCashFlow: number
    spendingChange: number
    categoriesOverBudget: string[]
  }
}) {
  const [showInfo, setShowInfo] = useState(false)
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference

  const getColor = () => {
    if (score >= 85) return '#10b981' // green
    if (score >= 70) return '#3b82f6' // blue
    if (score >= 50) return '#f59e0b' // amber
    return '#ef4444' // red
  }

  const getStatusText = () => {
    switch (status) {
      case 'excellent': return 'Excellent'
      case 'good': return 'Good'
      case 'fair': return 'Fair'
      case 'needs_attention': return 'Needs Work'
      default: return 'Unknown'
    }
  }

  // Calculate improvement tips based on what's hurting the score
  const getImprovementTips = () => {
    const tips: { issue: string; impact: string; tip: string }[] = []
    if (!stats) return tips

    if (stats.budgetPercentUsed > 100) {
      tips.push({
        issue: 'Over budget',
        impact: '-30 points',
        tip: 'Try to reduce spending to stay within your budgets'
      })
    } else if (stats.budgetPercentUsed > 80) {
      tips.push({
        issue: 'Near budget limit',
        impact: '-15 points',
        tip: 'You\'re approaching your budget limits'
      })
    }

    if (stats.netCashFlow < 0) {
      tips.push({
        issue: 'Negative cash flow',
        impact: '-25 points',
        tip: 'Your spending exceeds income this month'
      })
    }

    if (stats.spendingChange > 30) {
      tips.push({
        issue: 'Spending spike',
        impact: '-15 points',
        tip: 'Spending is 30%+ higher than last month'
      })
    }

    if (stats.categoriesOverBudget.length > 0) {
      tips.push({
        issue: `${stats.categoriesOverBudget.length} over-budget ${stats.categoriesOverBudget.length === 1 ? 'category' : 'categories'}`,
        impact: `-${10 * Math.min(stats.categoriesOverBudget.length, 3)} points`,
        tip: `Review: ${stats.categoriesOverBudget.slice(0, 3).map(c => formatCategory(c)).join(', ')}`
      })
    }

    return tips
  }

  const tips = getImprovementTips()

  return (
    <div className="relative">
      <button
        onClick={() => setShowInfo(!showInfo)}
        className="relative flex items-center justify-center group"
      >
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/20"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={getColor()}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 50 50)"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{score}</span>
          <span className="text-xs text-muted-foreground">{getStatusText()}</span>
        </div>
        <HelpCircle className="absolute -top-1 -right-1 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>

      {/* Info Panel */}
      {showInfo && (
        <div className="absolute top-full right-0 mt-2 z-50 w-80 bg-card border rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">Financial Health Score</h4>
            <button onClick={() => setShowInfo(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-sm text-muted-foreground mb-3">
            Your score reflects your current financial habits. It starts at 100 and adjusts based on:
          </p>

          <div className="space-y-2 text-sm mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>85-100: Excellent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>70-84: Good</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span>50-69: Fair</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span>0-49: Needs Attention</span>
            </div>
          </div>

          {tips.length > 0 ? (
            <>
              <h5 className="font-medium text-sm mb-2">How to improve:</h5>
              <div className="space-y-2">
                {tips.map((tip, idx) => (
                  <div key={idx} className="text-sm bg-muted/50 rounded p-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium">{tip.issue}</span>
                      <Badge variant="outline" className="text-xs">{tip.impact}</Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">{tip.tip}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/30 rounded p-2">
              <CheckCircle className="h-4 w-4" />
              <span>Great job! Keep up the good financial habits.</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Insight Card
function InsightCard({ insight }: { insight: Insight }) {
  const TrendIcon = insight.trend === 'up' ? TrendingUp : insight.trend === 'down' ? TrendingDown : Minus

  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground mb-1">{insight.title}</p>
      <div className="flex items-center gap-2">
        <p className="text-lg font-bold">{insight.value}</p>
        {insight.trend && insight.trend !== 'neutral' && (
          <TrendIcon className={`h-4 w-4 ${insight.trend === 'up' ? 'text-red-500' : 'text-green-500'}`} />
        )}
      </div>
      {insight.subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{insight.subtitle}</p>
      )}
    </div>
  )
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [insights, setInsights] = useState<InsightsData | null>(null)
  const [loadingInsights, setLoadingInsights] = useState(true)
  const [showSidebar, setShowSidebar] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Fetch insights
  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const response = await fetch('/api/ai/insights')
        if (response.ok) {
          const data = await response.json()
          setInsights(data)
        }
      } catch (error) {
        console.error('Error fetching insights:', error)
      } finally {
        setLoadingInsights(false)
      }
    }
    fetchInsights()
  }, [])

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/ai/chat')
      const data = await response.json()
      setSessions(data.sessions || [])
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoadingSessions(false)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const loadSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/ai/chat?session_id=${sessionId}`)
      const data = await response.json()
      setMessages(data.messages || [])
      setCurrentSessionId(sessionId)
    } catch (error) {
      console.error('Error loading session:', error)
    }
  }

  const startNewChat = () => {
    setCurrentSessionId(null)
    setMessages([])
  }

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch(`/api/ai/chat?session_id=${sessionId}`, { method: 'DELETE' })
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null)
        setMessages([])
      }
      fetchSessions()
    } catch (error) {
      console.error('Error deleting session:', error)
    }
  }

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return

    const userMessage: Message = { role: 'user', content }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          session_id: currentSessionId
        }),
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setMessages([...newMessages, { role: 'assistant', content: data.message }])

      if (data.session_id && !currentSessionId) {
        setCurrentSessionId(data.session_id)
        fetchSessions()
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  // Empty state / Welcome screen
  const WelcomeScreen = () => (
    <div className="flex flex-col h-full">
      {/* Header with Health Score */}
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-500" />
            AI Financial Advisor
          </h2>
          <p className="text-sm text-muted-foreground">
            {insights ? `${insights.period.month} ${insights.period.year} • ${insights.period.daysLeft} days left` : 'Loading...'}
          </p>
        </div>
        {insights && (
          <HealthScoreRing
            score={insights.healthScore}
            status={insights.healthStatus}
            stats={insights.stats}
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Quick Insights */}
        {insights && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">YOUR SNAPSHOT</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {insights.insights.map((insight, idx) => (
                <InsightCard key={idx} insight={insight} />
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">QUICK ACTIONS</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <QuickActionCard
              icon={Heart}
              title="Financial Health Check"
              subtitle="Get a complete analysis of your finances"
              onClick={() => sendMessage('Give me a complete financial health check')}
              variant="success"
            />
            <QuickActionCard
              icon={BarChart3}
              title="Spending Analysis"
              subtitle="See where your money is going"
              onClick={() => sendMessage('Analyze my spending patterns this month')}
            />
            <QuickActionCard
              icon={PiggyBank}
              title="Savings Opportunities"
              subtitle="Find ways to save more money"
              onClick={() => sendMessage('What are some ways I can save money based on my spending?')}
            />
            <QuickActionCard
              icon={Target}
              title="Budget Review"
              subtitle="Check how you're tracking against budgets"
              onClick={() => sendMessage('How am I doing with my budgets this month?')}
            />
          </div>
        </div>

        {/* Smart Suggestions */}
        {insights && insights.suggestions.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              <Zap className="h-4 w-4 inline mr-1 text-amber-500" />
              PERSONALIZED FOR YOU
            </h3>
            <div className="space-y-2">
              {insights.suggestions.slice(0, 4).map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(suggestion.text)}
                  className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:bg-muted/50 ${
                    suggestion.priority === 'high'
                      ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/20'
                      : ''
                  }`}
                >
                  {suggestion.priority === 'high' ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-emerald-500 shrink-0" />
                  )}
                  <span className="text-sm">{suggestion.text}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Alerts */}
        {insights && insights.stats.categoriesOverBudget.length > 0 && (
          <Card className="border-red-200 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <p className="font-medium">Budget Alert</p>
                  <p className="text-sm text-muted-foreground">
                    You're over budget in {insights.stats.categoriesOverBudget.length} {insights.stats.categoriesOverBudget.length === 1 ? 'category' : 'categories'}:{' '}
                    {insights.stats.categoriesOverBudget.slice(0, 3).map(c => formatCategory(c)).join(', ')}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => sendMessage(`Help me understand why I'm over budget on ${formatCategory(insights.stats.categoriesOverBudget[0])} and how to get back on track`)}
                  >
                    Get Help
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about your finances..."
            disabled={loading}
            className="h-12"
          />
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 px-6"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )

  // Chat conversation view
  const ChatView = () => (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 p-2">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-medium">AI Financial Advisor</p>
            <p className="text-xs text-muted-foreground">
              {insights ? `${insights.period.month} • Health Score: ${insights.healthScore}` : 'Ready to help'}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={startNewChat}>
          <Plus className="h-4 w-4 mr-1" />
          New Chat
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white'
                  : 'bg-muted'
              }`}
            >
              {message.role === 'user' ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content}
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 [&_ul]:list-disc [&_ol]:list-decimal [&_li]:marker:text-current">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              )}
            </div>
            {message.role === 'user' && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Analyzing your finances...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestions */}
      {messages.length > 0 && messages.length < 4 && insights && (
        <div className="px-6 pb-2">
          <div className="flex flex-wrap gap-2">
            {insights.suggestions.slice(0, 3).map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => sendMessage(suggestion.text)}
                className="rounded-full border bg-card px-3 py-1.5 text-xs transition-colors hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
              >
                {suggestion.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a follow-up question..."
            disabled={loading}
            className="h-12"
          />
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 px-6"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 p-4">
      {/* Sidebar - Chat History */}
      <div className="w-64 shrink-0 hidden lg:block">
        <Card className="flex h-full flex-col">
          <div className="border-b p-3">
            <Button
              onClick={startNewChat}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
              size="sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Chat
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loadingSessions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No chat history yet
              </div>
            ) : (
              <div className="space-y-1">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => loadSession(session.id)}
                    className={`group flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      currentSessionId === session.id
                        ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate text-xs">{session.title}</span>
                    <button
                      onClick={(e) => deleteSession(session.id, e)}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        {messages.length === 0 ? <WelcomeScreen /> : <ChatView />}
      </Card>
    </div>
  )
}
