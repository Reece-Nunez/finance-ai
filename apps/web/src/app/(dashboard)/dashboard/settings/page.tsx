'use client'

import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { formatCategory } from '@/lib/format'
import { SterlingIcon } from '@/components/ui/sterling-icon'
import {
  User,
  Bell,
  // Sparkles removed - using SterlingIcon for AI features
  Download,
  Moon,
  Shield,
  Loader2,
  Check,
  AlertTriangle,
  Phone,
  Mail,
  Globe,
  DollarSign,
  Calendar,
  Trash2,
  LogOut,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  PieChart,
  FileText,
  Brain,
  MessageSquare,
  Zap,
  Target,
  Lightbulb,
  BarChart3,
  ShieldCheck,
  Eye,
  Wallet,
  TrendingUp as Growth,
  CircleDollarSign,
  Receipt,
  CreditCard,
  Crown,
  ExternalLink,
  Smartphone,
  Wand2,
  ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import { MFASettings } from '@/components/settings/mfa-settings'
import { useSubscription } from '@/hooks/useSubscription'
import { Slider } from '@/components/ui/slider'
import { useTheme } from 'next-themes'
import { SESSION_CONFIG } from '@/lib/security/session-config'

interface AlertSettings {
  enabled: boolean
  email: boolean
  push: boolean
  sms: boolean
}

interface NotificationPreferences {
  // Alert types with their delivery methods
  low_balance: AlertSettings
  overdraft: AlertSettings
  large_withdrawal: AlertSettings
  large_deposit: AlertSettings
  suspicious_activity: AlertSettings
  budget_alerts: AlertSettings
  recurring_payments: AlertSettings
  weekly_summary: AlertSettings
  // Thresholds
  large_transaction_threshold: number
  low_balance_threshold: number
}

interface AIPreferences {
  // Auto-categorization
  auto_categorize: boolean
  categorize_confidence_threshold: number // 0-100, only auto-apply if confidence >= this
  review_low_confidence: boolean // Show for review if below threshold

  // Smart Insights
  spending_insights: boolean
  savings_suggestions: boolean
  budget_recommendations: boolean
  investment_tips: boolean
  bill_negotiation_tips: boolean

  // AI Chat
  chat_personality: 'professional' | 'friendly' | 'concise'
  include_spending_context: boolean
  proactive_insights: boolean

  // Analysis Features
  detect_recurring: boolean
  detect_subscriptions: boolean
  detect_unusual_spending: boolean
  merchant_cleanup: boolean // Clean up merchant names
  smart_search: boolean

  // Privacy & Data
  allow_transaction_analysis: boolean
  improve_ai_models: boolean // Allow anonymized data to improve AI
}

interface UserProfile {
  first_name: string
  last_name: string
  phone: string | null
  date_of_birth: string | null
  currency: string
  timezone: string
  notification_preferences: NotificationPreferences
  ai_preferences?: AIPreferences
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
]

const CURRENCIES = [
  { value: 'USD', label: 'US Dollar ($)', symbol: '$' },
  { value: 'EUR', label: 'Euro (€)', symbol: '€' },
  { value: 'GBP', label: 'British Pound (£)', symbol: '£' },
  { value: 'CAD', label: 'Canadian Dollar (C$)', symbol: 'C$' },
  { value: 'AUD', label: 'Australian Dollar (A$)', symbol: 'A$' },
  { value: 'JPY', label: 'Japanese Yen (¥)', symbol: '¥' },
]

export default function SettingsPage() {
  const supabase = createClient()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [openingPortal, setOpeningPortal] = useState(false)
  const { isPro, isTrialing, currentPeriodEnd, refresh: refreshSubscription } = useSubscription()

  const handleManageSubscription = async () => {
    setOpeningPortal(true)
    try {
      const response = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Failed to open billing portal:', error)
    }
    setOpeningPortal(false)
  }

  const DEFAULT_ALERT: AlertSettings = { enabled: true, email: true, push: true, sms: false }
  const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
    low_balance: { ...DEFAULT_ALERT },
    overdraft: { ...DEFAULT_ALERT },
    large_withdrawal: { ...DEFAULT_ALERT },
    large_deposit: { ...DEFAULT_ALERT },
    suspicious_activity: { ...DEFAULT_ALERT },
    budget_alerts: { ...DEFAULT_ALERT },
    recurring_payments: { ...DEFAULT_ALERT },
    weekly_summary: { enabled: false, email: true, push: false, sms: false },
    // Thresholds
    large_transaction_threshold: 500,
    low_balance_threshold: 100,
  }

  // Profile state
  const [profile, setProfile] = useState<UserProfile>({
    first_name: '',
    last_name: '',
    phone: '',
    date_of_birth: null,
    currency: 'USD',
    timezone: 'America/New_York',
    notification_preferences: DEFAULT_NOTIFICATION_PREFS,
  })

  // Default AI preferences
  const DEFAULT_AI_PREFS: AIPreferences = {
    auto_categorize: true,
    categorize_confidence_threshold: 80,
    review_low_confidence: true,
    spending_insights: true,
    savings_suggestions: true,
    budget_recommendations: true,
    investment_tips: false,
    bill_negotiation_tips: true,
    chat_personality: 'friendly',
    include_spending_context: true,
    proactive_insights: true,
    detect_recurring: true,
    detect_subscriptions: true,
    detect_unusual_spending: true,
    merchant_cleanup: true,
    smart_search: true,
    allow_transaction_analysis: true,
    improve_ai_models: false,
  }

  const [aiPreferences, setAiPreferences] = useState<AIPreferences>(DEFAULT_AI_PREFS)
  const [savingAI, setSavingAI] = useState(false)
  const [runningCategorization, setRunningCategorization] = useState(false)
  const [categorizationStatus, setCategorizationStatus] = useState('')
  const [applyingChange, setApplyingChange] = useState<string | null>(null)

  // Batch categorization modal state
  const [batchModalOpen, setBatchModalOpen] = useState(false)
  const [batchTotal, setBatchTotal] = useState(0)
  const [batchProcessed, setBatchProcessed] = useState(0)
  const [batchStarted, setBatchStarted] = useState(false)

  // Delete account state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [loadingBatchCount, setLoadingBatchCount] = useState(false)
  const [categorizationResult, setCategorizationResult] = useState<{
    categorized: number
    needs_review: number
    found: number
    message?: string
    skipped_items?: Array<{
      transaction_id: string
      original_name: string
      current_category?: string
      amount: number
      date: string
      suggested_category: string
      suggested_name?: string
      confidence: number
      reason: string
    }>
  } | null>(null)

  // AI Usage tracking state
  const [aiUsage, setAiUsage] = useState<{
    isPro: boolean
    date: string
    stats: Array<{
      feature: string
      used: number
      limit: number
      remaining: number
      percentage: number
    }>
    tokens: {
      input: number
      output: number
      total: number
    }
  } | null>(null)
  const [loadingUsage, setLoadingUsage] = useState(false)

  // Track if notification prefs are being saved
  const [savingNotifications, setSavingNotifications] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        // Fetch user profile
        try {
          const response = await fetch('/api/user/profile')
          if (response.ok) {
            const data = await response.json()
            if (data.profile) {
              // Merge saved preferences with defaults to handle new fields
              const savedPrefs = data.profile.notification_preferences || {}
              const mergedPrefs = { ...DEFAULT_NOTIFICATION_PREFS, ...savedPrefs }

              // Merge AI preferences
              const savedAIPrefs = data.profile.ai_preferences || {}
              const mergedAIPrefs = { ...DEFAULT_AI_PREFS, ...savedAIPrefs }
              setAiPreferences(mergedAIPrefs)

              setProfile({
                first_name: data.profile.first_name || '',
                last_name: data.profile.last_name || '',
                phone: data.profile.phone || '',
                date_of_birth: data.profile.date_of_birth || null,
                currency: data.profile.currency || 'USD',
                timezone: data.profile.timezone || 'America/New_York',
                notification_preferences: mergedPrefs,
                ai_preferences: mergedAIPrefs,
              })
            } else {
              // No profile exists, try to populate from auth metadata
              const authFirstName = user.user_metadata?.first_name
              const authLastName = user.user_metadata?.last_name
              if (authFirstName || authLastName) {
                setProfile(prev => ({
                  ...prev,
                  first_name: authFirstName || '',
                  last_name: authLastName || '',
                }))
              }
            }
          }
        } catch (error) {
          console.error('Error loading profile:', error)
        }
      }
      setLoading(false)
    }
    loadData()
  }, [supabase])

  // Fetch AI usage stats
  useEffect(() => {
    async function fetchUsage() {
      setLoadingUsage(true)
      try {
        const response = await fetch('/api/ai/usage')
        if (response.ok) {
          const data = await response.json()
          setAiUsage(data)
        }
      } catch (error) {
        console.error('Failed to fetch AI usage:', error)
      } finally {
        setLoadingUsage(false)
      }
    }
    fetchUsage()
  }, [])

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
  }

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value)
    setProfile(prev => ({ ...prev, phone: formatted }))
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone || null,
          date_of_birth: profile.date_of_birth || null,
          currency: profile.currency,
          timezone: profile.timezone,
          notification_preferences: profile.notification_preferences,
        }),
      })

      if (response.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (error) {
      console.error('Failed to save profile:', error)
    }
    setSaving(false)
  }

  // Auto-save notification preferences when toggled
  const handleAlertToggle = async (
    alertType: keyof Omit<NotificationPreferences, 'large_transaction_threshold' | 'low_balance_threshold'>,
    field: keyof AlertSettings,
    value: boolean
  ) => {
    const currentAlert = profile.notification_preferences[alertType] as AlertSettings
    const newAlert = { ...currentAlert, [field]: value }
    const newPrefs = { ...profile.notification_preferences, [alertType]: newAlert }

    setProfile(prev => ({
      ...prev,
      notification_preferences: newPrefs
    }))

    setSavingNotifications(true)
    try {
      await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notification_preferences: newPrefs,
        }),
      })
    } catch (error) {
      console.error('Failed to save notification preferences:', error)
      // Revert on error
      setProfile(prev => ({
        ...prev,
        notification_preferences: { ...prev.notification_preferences, [alertType]: currentAlert }
      }))
    }
    setSavingNotifications(false)
  }

  // Handle threshold changes
  const handleThresholdChange = async (key: 'large_transaction_threshold' | 'low_balance_threshold', value: number) => {
    const oldValue = profile.notification_preferences[key]
    const newPrefs = { ...profile.notification_preferences, [key]: value }

    setProfile(prev => ({
      ...prev,
      notification_preferences: newPrefs
    }))

    setSavingNotifications(true)
    try {
      await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notification_preferences: newPrefs,
        }),
      })
    } catch (error) {
      console.error('Failed to save threshold:', error)
      setProfile(prev => ({
        ...prev,
        notification_preferences: { ...prev.notification_preferences, [key]: oldValue }
      }))
    }
    setSavingNotifications(false)
  }

  // Manually run AI categorization
  const runAICategorization = async (force = false, processAll = false) => {
    setRunningCategorization(true)
    setCategorizationResult(null)
    setCategorizationStatus(processAll ? 'Starting batch categorization of all transactions...' : 'Finding transactions to categorize...')

    // Simulate progress updates with timeouts
    const statusUpdates = processAll
      ? [
          { delay: 3000, message: 'Processing transactions in batches...' },
          { delay: 10000, message: 'Still working through batches...' },
          { delay: 30000, message: 'Processing more batches...' },
          { delay: 60000, message: 'Almost there, finishing up...' },
        ]
      : [
          { delay: 2000, message: 'Analyzing transactions with AI...' },
          { delay: 8000, message: 'Processing AI suggestions...' },
          { delay: 15000, message: 'Updating transaction records...' },
          { delay: 25000, message: 'Almost done, finalizing...' },
        ]

    const timeouts: NodeJS.Timeout[] = []
    statusUpdates.forEach(({ delay, message }) => {
      timeouts.push(setTimeout(() => setCategorizationStatus(message), delay))
    })

    try {
      const response = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force, process_all: processAll }),
      })
      const data = await response.json()

      // Clear pending status updates
      timeouts.forEach(t => clearTimeout(t))

      setCategorizationResult({
        categorized: data.categorized || 0,
        needs_review: data.needs_review || 0,
        found: data.found || 0,
        message: data.message,
        skipped_items: data.skipped_items,
      })
    } catch (error) {
      console.error('Failed to run AI categorization:', error)
      timeouts.forEach(t => clearTimeout(t))
      setCategorizationResult({
        categorized: 0,
        needs_review: 0,
        found: 0,
        message: 'Failed to run AI categorization',
      })
    }
    setCategorizationStatus('')
    setRunningCategorization(false)
  }

  // Accept a skipped categorization suggestion
  const acceptSkippedItem = async (item: {
    transaction_id: string
    suggested_category: string
    suggested_name?: string
  }) => {
    setApplyingChange(item.transaction_id)
    try {
      const updateData: Record<string, unknown> = {
        ai_category: item.suggested_category,
      }
      if (item.suggested_name) {
        updateData.display_name = item.suggested_name
      }

      const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', item.transaction_id)

      if (!error) {
        // Remove from skipped items list
        setCategorizationResult(prev => {
          if (!prev) return prev
          return {
            ...prev,
            categorized: prev.categorized + 1,
            skipped_items: prev.skipped_items?.filter(
              s => s.transaction_id !== item.transaction_id
            ),
          }
        })
      }
    } catch (error) {
      console.error('Failed to accept suggestion:', error)
    }
    setApplyingChange(null)
  }

  // Reject/dismiss a skipped categorization suggestion
  const rejectSkippedItem = (transactionId: string) => {
    setCategorizationResult(prev => {
      if (!prev) return prev
      return {
        ...prev,
        skipped_items: prev.skipped_items?.filter(
          s => s.transaction_id !== transactionId
        ),
      }
    })
  }

  // Open batch categorization modal with count
  const openBatchModal = async () => {
    setLoadingBatchCount(true)
    setBatchModalOpen(true)
    setBatchStarted(false)
    setBatchProcessed(0)

    try {
      const response = await fetch('/api/ai/categorize')
      const data = await response.json()
      setBatchTotal(data.uncategorized_count || 0)
    } catch (error) {
      console.error('Failed to get uncategorized count:', error)
      setBatchTotal(0)
    }
    setLoadingBatchCount(false)
  }

  // Run batch categorization with progress simulation
  const runBatchCategorization = async () => {
    setBatchStarted(true)
    setBatchProcessed(0)
    setCategorizationResult(null)

    // Simulate progress based on realistic batch processing time
    // Each batch of 25 transactions takes ~3-5 seconds for AI processing
    const batchSize = 25
    const estimatedBatches = Math.ceil(batchTotal / batchSize)
    const secondsPerBatch = 4 // Conservative estimate
    let currentBatch = 0

    // Update progress once per estimated batch completion
    const progressInterval = setInterval(() => {
      currentBatch++
      if (currentBatch < estimatedBatches) {
        // Show progress based on batches, cap at 90% until done
        const progress = Math.min(currentBatch * batchSize, Math.floor(batchTotal * 0.9))
        setBatchProcessed(progress)
      }
    }, secondsPerBatch * 1000)

    try {
      const response = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ process_all: true }),
      })
      const data = await response.json()

      clearInterval(progressInterval)
      setBatchProcessed(batchTotal)

      setCategorizationResult({
        categorized: data.categorized || 0,
        needs_review: data.needs_review || 0,
        found: data.found || 0,
        message: data.message,
        skipped_items: data.skipped_items,
      })

      // Close modal after a short delay to show completion
      setTimeout(() => {
        setBatchModalOpen(false)
        setBatchStarted(false)
      }, 2000)
    } catch (error) {
      console.error('Failed to run batch categorization:', error)
      clearInterval(progressInterval)
      setCategorizationResult({
        categorized: 0,
        needs_review: 0,
        found: 0,
        message: 'Failed to run batch categorization',
      })
    }
  }

  // Handle AI preference changes with auto-save
  const handleAIPreferenceChange = async <K extends keyof AIPreferences>(
    key: K,
    value: AIPreferences[K]
  ) => {
    const oldValue = aiPreferences[key]
    const newPrefs = { ...aiPreferences, [key]: value }

    setAiPreferences(newPrefs)

    setSavingAI(true)
    try {
      await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ai_preferences: newPrefs,
        }),
      })
    } catch (error) {
      console.error('Failed to save AI preferences:', error)
      setAiPreferences(prev => ({ ...prev, [key]: oldValue }))
    }
    setSavingAI(false)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const [transactionsRes, accountsRes, budgetsRes] = await Promise.all([
        supabase.from('transactions').select('*'),
        supabase.from('accounts').select('*'),
        supabase.from('budgets').select('*'),
      ])

      const exportData = {
        exportedAt: new Date().toISOString(),
        transactions: transactionsRes.data || [],
        accounts: accountsRes.data || [],
        budgets: budgetsRes.data || [],
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `financeai-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export data:', error)
    }
    setExporting(false)
  }

  const handleSignOut = async () => {
    // Clear session tracking data
    try {
      Object.values(SESSION_CONFIG.STORAGE_KEYS).forEach((key) => {
        localStorage.removeItem(key)
      })
      // Broadcast logout to other tabs
      localStorage.setItem(
        SESSION_CONFIG.STORAGE_KEYS.LOGOUT_EVENT,
        JSON.stringify({ timestamp: Date.now(), reason: 'manual' })
      )
    } catch {
      // Ignore localStorage errors
    }
    await supabase.auth.signOut()
    window.location.href = '/login?message=logged_out'
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch('/api/user/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirmation: 'DELETE' }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete account')
      }

      // Clear local storage
      try {
        localStorage.clear()
      } catch {
        // Ignore errors
      }

      // Redirect to home with message
      window.location.href = '/?message=account_deleted'
    } catch (error) {
      console.error('Error deleting account:', error)
      setIsDeleting(false)
      // Show error in the dialog
      alert(error instanceof Error ? error.message : 'Failed to delete account. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5">
            <User className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your profile details</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {profile.first_name ? 'Complete' : 'Incomplete'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={profile.first_name}
                onChange={(e) => setProfile(prev => ({ ...prev, first_name: e.target.value }))}
                placeholder="John"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={profile.last_name}
                onChange={(e) => setProfile(prev => ({ ...prev, last_name: e.target.value }))}
                placeholder="Doe"
              />
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                value={user?.email || ''}
                disabled
                className="bg-muted pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Email cannot be changed. Contact support if you need to update it.
            </p>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                value={profile.phone || ''}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="(555) 123-4567"
                className="pl-10"
                maxLength={14}
              />
            </div>
          </div>

          {/* Date of Birth */}
          <div className="space-y-2">
            <Label htmlFor="dob">Date of Birth</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="dob"
                type="date"
                value={profile.date_of_birth || ''}
                onChange={(e) => setProfile(prev => ({ ...prev, date_of_birth: e.target.value }))}
                className="pl-10"
              />
            </div>
          </div>

          <Separator />

          {/* Preferences Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Currency */}
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  id="currency"
                  value={profile.currency}
                  onChange={(e) => setProfile(prev => ({ ...prev, currency: e.target.value }))}
                  className="w-full h-10 pl-10 pr-4 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {CURRENCIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Timezone */}
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  id="timezone"
                  value={profile.timezone}
                  onChange={(e) => setProfile(prev => ({ ...prev, timezone: e.target.value }))}
                  className="w-full h-10 pl-10 pr-4 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSaveProfile}
            disabled={saving}
            className="w-full bg-gradient-to-r from-slate-500 to-slate-700 hover:from-slate-600 hover:to-slate-800"
          >
            {saving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
            ) : saved ? (
              <><Check className="mr-2 h-4 w-4" /> Saved!</>
            ) : (
              'Save Profile'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-slate-500 to-slate-700 p-2.5">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <CardTitle>Subscription</CardTitle>
            <CardDescription>Manage your Sterling subscription</CardDescription>
          </div>
          {isPro && (
            <Badge className="bg-gradient-to-r from-slate-500 to-slate-700 text-white border-0 gap-1">
              <Crown className="h-3 w-3" />
              {isTrialing ? 'Trial' : 'Pro'}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isPro ? (
            <>
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Sterling Pro</span>
                  <span className="text-sm text-muted-foreground">
                    {isTrialing ? 'Trial Period' : 'Active'}
                  </span>
                </div>
                {currentPeriodEnd && (
                  <p className="text-sm text-muted-foreground">
                    {isTrialing ? 'Trial ends' : 'Next billing date'}:{' '}
                    {new Date(currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={handleManageSubscription}
                  disabled={openingPortal}
                  className="w-full"
                >
                  {openingPortal ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening...</>
                  ) : (
                    <><ExternalLink className="mr-2 h-4 w-4" /> Manage Subscription</>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Update payment method, view invoices, or cancel your subscription
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Free Plan</span>
                  <Badge variant="outline">Current</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Limited features. Upgrade to Pro to unlock AI insights, anomaly detection, and more.
                </p>
              </div>
              <Button
                asChild
                className="w-full bg-gradient-to-r from-slate-500 to-slate-700 hover:from-slate-600 hover:to-slate-800"
              >
                <a href="/dashboard/settings/billing">
                  <SterlingIcon size="md" className="mr-2" />
                  Upgrade to Pro
                </a>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 p-2.5">
            <Moon className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Customize how the app looks</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Dark Mode</Label>
              <p className="text-sm text-muted-foreground">
                Switch between light and dark theme
              </p>
            </div>
            <Switch
              checked={mounted && resolvedTheme === 'dark'}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              disabled={!mounted}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 p-2.5">
            <Bell className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Configure alerts and how you receive them</CardDescription>
          </div>
          {savingNotifications && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!profile.phone && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm">
              <Phone className="h-4 w-4 text-amber-600" />
              <span className="text-amber-800 dark:text-amber-200">Add a phone number above to enable SMS notifications</span>
            </div>
          )}

          {/* Alert Type Cards */}
          <div className="space-y-3">
            {/* Low Balance */}
            <div className={`rounded-lg border ${profile.notification_preferences.low_balance.enabled ? 'border-amber-200 dark:border-amber-800' : 'opacity-60'}`}>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-2">
                    <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <Label className="text-base font-medium">Low Balance</Label>
                    <p className="text-sm text-muted-foreground">When account balance drops below threshold</p>
                  </div>
                </div>
                <Switch
                  checked={profile.notification_preferences.low_balance.enabled}
                  onCheckedChange={(checked) => handleAlertToggle('low_balance', 'enabled', checked)}
                  disabled={savingNotifications}
                />
              </div>
              {profile.notification_preferences.low_balance.enabled && (
                <div className="px-4 pb-4 pt-0 space-y-2">
                  <span className="text-xs text-muted-foreground">Notify via:</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profile.notification_preferences.low_balance.email}
                        onChange={(e) => handleAlertToggle('low_balance', 'email', e.target.checked)}
                        disabled={savingNotifications}
                        className="rounded border-gray-300"
                      />
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs">Email</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profile.notification_preferences.low_balance.push}
                        onChange={(e) => handleAlertToggle('low_balance', 'push', e.target.checked)}
                        disabled={savingNotifications}
                        className="rounded border-gray-300"
                      />
                      <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs">Push</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profile.notification_preferences.low_balance.sms}
                        onChange={(e) => handleAlertToggle('low_balance', 'sms', e.target.checked)}
                        disabled={savingNotifications || !profile.phone}
                        className="rounded border-gray-300"
                      />
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs">SMS</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Overdraft */}
            <div className={`rounded-lg border ${profile.notification_preferences.overdraft.enabled ? 'border-red-200 dark:border-red-800' : 'opacity-60'}`}>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-2">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <Label className="text-base font-medium">Overdraft</Label>
                    <p className="text-sm text-muted-foreground">When account balance goes negative</p>
                  </div>
                </div>
                <Switch
                  checked={profile.notification_preferences.overdraft.enabled}
                  onCheckedChange={(checked) => handleAlertToggle('overdraft', 'enabled', checked)}
                  disabled={savingNotifications}
                />
              </div>
              {profile.notification_preferences.overdraft.enabled && (
                <div className="px-4 pb-4 pt-0 space-y-2">
                  <span className="text-xs text-muted-foreground">Notify via:</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={profile.notification_preferences.overdraft.email} onChange={(e) => handleAlertToggle('overdraft', 'email', e.target.checked)} disabled={savingNotifications} className="rounded border-gray-300" />
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">Email</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={profile.notification_preferences.overdraft.push} onChange={(e) => handleAlertToggle('overdraft', 'push', e.target.checked)} disabled={savingNotifications} className="rounded border-gray-300" />
                      <Bell className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">Push</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={profile.notification_preferences.overdraft.sms} onChange={(e) => handleAlertToggle('overdraft', 'sms', e.target.checked)} disabled={savingNotifications || !profile.phone} className="rounded border-gray-300" />
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">SMS</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Large Withdrawals */}
            <div className={`rounded-lg border ${profile.notification_preferences.large_withdrawal.enabled ? 'border-orange-200 dark:border-orange-800' : 'opacity-60'}`}>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-orange-100 dark:bg-orange-900/30 p-2">
                    <TrendingDown className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <Label className="text-base font-medium">Large Withdrawals</Label>
                    <p className="text-sm text-muted-foreground">Spending over your set threshold</p>
                  </div>
                </div>
                <Switch
                  checked={profile.notification_preferences.large_withdrawal.enabled}
                  onCheckedChange={(checked) => handleAlertToggle('large_withdrawal', 'enabled', checked)}
                  disabled={savingNotifications}
                />
              </div>
              {profile.notification_preferences.large_withdrawal.enabled && (
                <div className="px-4 pb-4 pt-0 space-y-2">
                  <span className="text-xs text-muted-foreground">Notify via:</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={profile.notification_preferences.large_withdrawal.email} onChange={(e) => handleAlertToggle('large_withdrawal', 'email', e.target.checked)} disabled={savingNotifications} className="rounded border-gray-300" />
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">Email</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={profile.notification_preferences.large_withdrawal.push} onChange={(e) => handleAlertToggle('large_withdrawal', 'push', e.target.checked)} disabled={savingNotifications} className="rounded border-gray-300" />
                      <Bell className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">Push</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={profile.notification_preferences.large_withdrawal.sms} onChange={(e) => handleAlertToggle('large_withdrawal', 'sms', e.target.checked)} disabled={savingNotifications || !profile.phone} className="rounded border-gray-300" />
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">SMS</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Large Deposits */}
            <div className={`rounded-lg border ${profile.notification_preferences.large_deposit.enabled ? 'border-emerald-200 dark:border-emerald-800' : 'opacity-60'}`}>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 p-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <Label className="text-base font-medium">Large Deposits</Label>
                    <p className="text-sm text-muted-foreground">Income over your set threshold</p>
                  </div>
                </div>
                <Switch
                  checked={profile.notification_preferences.large_deposit.enabled}
                  onCheckedChange={(checked) => handleAlertToggle('large_deposit', 'enabled', checked)}
                  disabled={savingNotifications}
                />
              </div>
              {profile.notification_preferences.large_deposit.enabled && (
                <div className="px-4 pb-4 pt-0 space-y-2">
                  <span className="text-xs text-muted-foreground">Notify via:</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={profile.notification_preferences.large_deposit.email} onChange={(e) => handleAlertToggle('large_deposit', 'email', e.target.checked)} disabled={savingNotifications} className="rounded border-gray-300" />
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">Email</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={profile.notification_preferences.large_deposit.push} onChange={(e) => handleAlertToggle('large_deposit', 'push', e.target.checked)} disabled={savingNotifications} className="rounded border-gray-300" />
                      <Bell className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">Push</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={profile.notification_preferences.large_deposit.sms} onChange={(e) => handleAlertToggle('large_deposit', 'sms', e.target.checked)} disabled={savingNotifications || !profile.phone} className="rounded border-gray-300" />
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">SMS</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Suspicious Activity */}
            <div className={`rounded-lg border ${profile.notification_preferences.suspicious_activity.enabled ? 'border-purple-200 dark:border-purple-800' : 'opacity-60'}`}>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-purple-100 dark:bg-purple-900/30 p-2">
                    <AlertTriangle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <Label className="text-base font-medium">Suspicious Activity</Label>
                    <p className="text-sm text-muted-foreground">Unusual spending patterns detected</p>
                  </div>
                </div>
                <Switch
                  checked={profile.notification_preferences.suspicious_activity.enabled}
                  onCheckedChange={(checked) => handleAlertToggle('suspicious_activity', 'enabled', checked)}
                  disabled={savingNotifications}
                />
              </div>
              {profile.notification_preferences.suspicious_activity.enabled && (
                <div className="px-4 pb-4 pt-0 space-y-2">
                  <span className="text-xs text-muted-foreground">Notify via:</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={profile.notification_preferences.suspicious_activity.email} onChange={(e) => handleAlertToggle('suspicious_activity', 'email', e.target.checked)} disabled={savingNotifications} className="rounded border-gray-300" />
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">Email</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={profile.notification_preferences.suspicious_activity.push} onChange={(e) => handleAlertToggle('suspicious_activity', 'push', e.target.checked)} disabled={savingNotifications} className="rounded border-gray-300" />
                      <Bell className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">Push</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={profile.notification_preferences.suspicious_activity.sms} onChange={(e) => handleAlertToggle('suspicious_activity', 'sms', e.target.checked)} disabled={savingNotifications || !profile.phone} className="rounded border-gray-300" />
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">SMS</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Budget Alerts */}
            <div className={`rounded-lg border ${profile.notification_preferences.budget_alerts.enabled ? 'border-blue-200 dark:border-blue-800' : 'opacity-60'}`}>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-2">
                    <PieChart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <Label className="text-base font-medium">Budget Alerts</Label>
                    <p className="text-sm text-muted-foreground">When approaching or exceeding budget limits</p>
                  </div>
                </div>
                <Switch
                  checked={profile.notification_preferences.budget_alerts.enabled}
                  onCheckedChange={(checked) => handleAlertToggle('budget_alerts', 'enabled', checked)}
                  disabled={savingNotifications}
                />
              </div>
              {profile.notification_preferences.budget_alerts.enabled && (
                <div className="px-4 pb-4 pt-0 space-y-2">
                  <span className="text-xs text-muted-foreground">Notify via:</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={profile.notification_preferences.budget_alerts.email} onChange={(e) => handleAlertToggle('budget_alerts', 'email', e.target.checked)} disabled={savingNotifications} className="rounded border-gray-300" />
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">Email</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={profile.notification_preferences.budget_alerts.push} onChange={(e) => handleAlertToggle('budget_alerts', 'push', e.target.checked)} disabled={savingNotifications} className="rounded border-gray-300" />
                      <Bell className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">Push</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={profile.notification_preferences.budget_alerts.sms} onChange={(e) => handleAlertToggle('budget_alerts', 'sms', e.target.checked)} disabled={savingNotifications || !profile.phone} className="rounded border-gray-300" />
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">SMS</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Recurring Payments */}
            <div className={`rounded-lg border ${profile.notification_preferences.recurring_payments.enabled ? 'border-indigo-200 dark:border-indigo-800' : 'opacity-60'}`}>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 p-2">
                    <RefreshCw className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <Label className="text-base font-medium">Recurring Payments</Label>
                    <p className="text-sm text-muted-foreground">Reminders for upcoming bills and subscriptions</p>
                  </div>
                </div>
                <Switch
                  checked={profile.notification_preferences.recurring_payments.enabled}
                  onCheckedChange={(checked) => handleAlertToggle('recurring_payments', 'enabled', checked)}
                  disabled={savingNotifications}
                />
              </div>
              {profile.notification_preferences.recurring_payments.enabled && (
                <div className="px-4 pb-4 pt-0 space-y-2">
                  <span className="text-xs text-muted-foreground">Notify via:</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={profile.notification_preferences.recurring_payments.email} onChange={(e) => handleAlertToggle('recurring_payments', 'email', e.target.checked)} disabled={savingNotifications} className="rounded border-gray-300" />
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">Email</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={profile.notification_preferences.recurring_payments.push} onChange={(e) => handleAlertToggle('recurring_payments', 'push', e.target.checked)} disabled={savingNotifications} className="rounded border-gray-300" />
                      <Bell className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">Push</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={profile.notification_preferences.recurring_payments.sms} onChange={(e) => handleAlertToggle('recurring_payments', 'sms', e.target.checked)} disabled={savingNotifications || !profile.phone} className="rounded border-gray-300" />
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">SMS</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Weekly Summary */}
            <div className={`rounded-lg border ${profile.notification_preferences.weekly_summary.enabled ? 'border-slate-200 dark:border-slate-700' : 'opacity-60'}`}>
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-2">
                    <FileText className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div>
                    <Label className="text-base font-medium">Weekly Summary</Label>
                    <p className="text-sm text-muted-foreground">Weekly digest of your spending and finances</p>
                  </div>
                </div>
                <Switch
                  checked={profile.notification_preferences.weekly_summary.enabled}
                  onCheckedChange={(checked) => handleAlertToggle('weekly_summary', 'enabled', checked)}
                  disabled={savingNotifications}
                />
              </div>
              {profile.notification_preferences.weekly_summary.enabled && (
                <div className="px-4 pb-4 pt-0 space-y-2">
                  <span className="text-xs text-muted-foreground">Notify via:</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={profile.notification_preferences.weekly_summary.email} onChange={(e) => handleAlertToggle('weekly_summary', 'email', e.target.checked)} disabled={savingNotifications} className="rounded border-gray-300" />
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">Email</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={profile.notification_preferences.weekly_summary.push} onChange={(e) => handleAlertToggle('weekly_summary', 'push', e.target.checked)} disabled={savingNotifications} className="rounded border-gray-300" />
                      <Bell className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">Push</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={profile.notification_preferences.weekly_summary.sms} onChange={(e) => handleAlertToggle('weekly_summary', 'sms', e.target.checked)} disabled={savingNotifications || !profile.phone} className="rounded border-gray-300" />
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">SMS</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Thresholds */}
          <div>
            <h4 className="text-sm font-medium mb-3">Alert Thresholds</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="largeTransaction">Large Transaction Amount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="largeTransaction"
                    type="number"
                    min={50}
                    step={50}
                    value={profile.notification_preferences.large_transaction_threshold}
                    onChange={(e) => handleThresholdChange('large_transaction_threshold', parseInt(e.target.value) || 500)}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Alert for transactions over this amount
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lowBalance">Low Balance Threshold</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="lowBalance"
                    type="number"
                    min={0}
                    step={25}
                    value={profile.notification_preferences.low_balance_threshold}
                    onChange={(e) => handleThresholdChange('low_balance_threshold', parseInt(e.target.value) || 100)}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Alert when balance drops below this
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Settings */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 p-2.5">
            <SterlingIcon size="lg" />
          </div>
          <div className="flex-1">
            <CardTitle>AI Preferences</CardTitle>
            <CardDescription>Control AI-powered features and personalization</CardDescription>
          </div>
          {savingAI && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto-Categorization */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-4 w-4 text-emerald-600" />
              <h4 className="text-sm font-medium">Auto-Categorization</h4>
            </div>
            <div className="space-y-4 pl-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Automatically Categorize Transactions</Label>
                  <p className="text-xs text-muted-foreground">
                    AI assigns categories to new transactions
                  </p>
                </div>
                <Switch
                  checked={aiPreferences.auto_categorize}
                  onCheckedChange={(checked) => handleAIPreferenceChange('auto_categorize', checked)}
                  disabled={savingAI}
                />
              </div>

              {aiPreferences.auto_categorize && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Confidence Threshold</Label>
                      <span className="text-sm font-medium text-emerald-600">
                        {aiPreferences.categorize_confidence_threshold}%
                      </span>
                    </div>
                    <Slider
                      value={[aiPreferences.categorize_confidence_threshold]}
                      onValueChange={([value]) => handleAIPreferenceChange('categorize_confidence_threshold', value)}
                      min={50}
                      max={100}
                      step={5}
                      disabled={savingAI}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Only auto-apply categories when AI confidence is at least this high
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Review Low Confidence</Label>
                      <p className="text-xs text-muted-foreground">
                        Queue uncertain categorizations for your review
                      </p>
                    </div>
                    <Switch
                      checked={aiPreferences.review_low_confidence}
                      onCheckedChange={(checked) => handleAIPreferenceChange('review_low_confidence', checked)}
                      disabled={savingAI}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Clean Up Merchant Names</Label>
                      <p className="text-xs text-muted-foreground">
                        AI normalizes messy merchant names (e.g., &quot;AMZN*123XY&quot; → &quot;Amazon&quot;)
                      </p>
                    </div>
                    <Switch
                      checked={aiPreferences.merchant_cleanup}
                      onCheckedChange={(checked) => handleAIPreferenceChange('merchant_cleanup', checked)}
                      disabled={savingAI}
                    />
                  </div>
                </>
              )}

              {/* Manual trigger button */}
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Run AI Now</Label>
                    <p className="text-xs text-muted-foreground">
                      Manually categorize and clean up uncategorized transactions
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runAICategorization(false)}
                    disabled={runningCategorization || !aiPreferences.auto_categorize}
                    className="gap-2"
                  >
                    {runningCategorization ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Run AI
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        Run AI
                      </>
                    )}
                  </Button>
                </div>

                {/* Show status while running */}
                {runningCategorization && categorizationStatus && (
                  <div className="mt-2 p-3 rounded-md bg-blue-50 dark:bg-blue-950/30 text-sm">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{categorizationStatus}</span>
                    </div>
                  </div>
                )}
                {categorizationResult && (
                  <div className={`mt-2 p-3 rounded-md text-sm ${
                    categorizationResult.categorized > 0
                      ? 'bg-emerald-50 dark:bg-emerald-950/30'
                      : categorizationResult.found === 0
                        ? 'bg-gray-50 dark:bg-gray-900/30'
                        : 'bg-amber-50 dark:bg-amber-950/30'
                  }`}>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {categorizationResult.categorized > 0 ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                        )}
                        <span className={categorizationResult.categorized > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
                          {categorizationResult.categorized > 0
                            ? `Categorized ${categorizationResult.categorized} transaction${categorizationResult.categorized !== 1 ? 's' : ''}`
                            : categorizationResult.message || 'No transactions were categorized'
                          }
                        </span>
                      </div>
                      {categorizationResult.found > 0 && (
                        <p className="text-xs text-muted-foreground pl-6">
                          Found {categorizationResult.found} transaction{categorizationResult.found !== 1 ? 's' : ''} to process
                        </p>
                      )}
                      {categorizationResult.needs_review > 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 pl-6">
                          {categorizationResult.needs_review} marked for review (low confidence)
                        </p>
                      )}

                      {/* Show skipped items */}
                      {categorizationResult.skipped_items && categorizationResult.skipped_items.length > 0 && (
                        <div className="mt-3 border-t pt-2">
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Skipped due to low confidence ({categorizationResult.skipped_items.length}):
                          </p>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {categorizationResult.skipped_items.map((item, idx) => (
                              <div key={idx} className="text-xs p-2 bg-white dark:bg-gray-800 rounded border">
                                <div className="flex justify-between items-start gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="font-medium truncate">{item.original_name}</p>
                                      <span className="text-muted-foreground shrink-0">
                                        ${Math.abs(item.amount).toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                      <span>{new Date(item.date).toLocaleDateString()}</span>
                                      {item.current_category && (
                                        <>
                                          <span>•</span>
                                          <span>{formatCategory(item.current_category)}</span>
                                        </>
                                      )}
                                    </div>
                                    <p className="text-muted-foreground">
                                      Suggested: <span className="text-foreground font-medium">{formatCategory(item.suggested_category)}</span>
                                      {item.suggested_name && (
                                        <span> → <span className="text-emerald-600 dark:text-emerald-400">{item.suggested_name}</span></span>
                                      )}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-amber-600 dark:text-amber-400 font-medium mr-2">
                                      {item.confidence}%
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                      onClick={() => acceptSkippedItem(item)}
                                      disabled={applyingChange === item.transaction_id}
                                      title="Accept suggestion"
                                    >
                                      {applyingChange === item.transaction_id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Check className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                      onClick={() => rejectSkippedItem(item.transaction_id)}
                                      disabled={applyingChange === item.transaction_id}
                                      title="Reject suggestion"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Re-run all button */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => runAICategorization(true, false)}
                    disabled={runningCategorization || !aiPreferences.auto_categorize}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Re-run recent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openBatchModal}
                    disabled={runningCategorization || !aiPreferences.auto_categorize}
                    className="text-xs"
                  >
                    <SterlingIcon size="sm" className="mr-1" />
                    Categorize ALL transactions
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <a href="/dashboard/ai-reports">
                      <FileText className="h-3 w-3 mr-1" />
                      View all reports
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Smart Insights */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <h4 className="text-sm font-medium">Smart Insights</h4>
            </div>
            <div className="grid gap-3 pl-6 sm:grid-cols-2">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                  <Label className="text-sm">Spending Insights</Label>
                </div>
                <Switch
                  checked={aiPreferences.spending_insights}
                  onCheckedChange={(checked) => handleAIPreferenceChange('spending_insights', checked)}
                  disabled={savingAI}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-500" />
                  <Label className="text-sm">Savings Suggestions</Label>
                </div>
                <Switch
                  checked={aiPreferences.savings_suggestions}
                  onCheckedChange={(checked) => handleAIPreferenceChange('savings_suggestions', checked)}
                  disabled={savingAI}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-purple-500" />
                  <Label className="text-sm">Budget Recommendations</Label>
                </div>
                <Switch
                  checked={aiPreferences.budget_recommendations}
                  onCheckedChange={(checked) => handleAIPreferenceChange('budget_recommendations', checked)}
                  disabled={savingAI}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-orange-500" />
                  <Label className="text-sm">Bill Negotiation Tips</Label>
                </div>
                <Switch
                  checked={aiPreferences.bill_negotiation_tips}
                  onCheckedChange={(checked) => handleAIPreferenceChange('bill_negotiation_tips', checked)}
                  disabled={savingAI}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border sm:col-span-2">
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="h-4 w-4 text-indigo-500" />
                  <div>
                    <Label className="text-sm">Investment Tips</Label>
                    <p className="text-xs text-muted-foreground">General investment education</p>
                  </div>
                </div>
                <Switch
                  checked={aiPreferences.investment_tips}
                  onCheckedChange={(checked) => handleAIPreferenceChange('investment_tips', checked)}
                  disabled={savingAI}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* AI Chat Personality */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              <h4 className="text-sm font-medium">AI Chat</h4>
            </div>
            <div className="space-y-4 pl-6">
              <div className="space-y-2">
                <Label>Chat Personality</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['professional', 'friendly', 'concise'] as const).map((personality) => (
                    <button
                      key={personality}
                      onClick={() => handleAIPreferenceChange('chat_personality', personality)}
                      disabled={savingAI}
                      className={`p-3 rounded-lg border text-center transition-colors ${
                        aiPreferences.chat_personality === personality
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <span className="text-lg mb-1 block">
                        {personality === 'professional' ? '👔' : personality === 'friendly' ? '😊' : '⚡'}
                      </span>
                      <span className="text-sm font-medium capitalize">{personality}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {aiPreferences.chat_personality === 'professional' && 'Formal, detailed responses with financial terminology'}
                  {aiPreferences.chat_personality === 'friendly' && 'Conversational, encouraging tone with simple explanations'}
                  {aiPreferences.chat_personality === 'concise' && 'Brief, to-the-point answers focused on key information'}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Include Spending Context</Label>
                  <p className="text-xs text-muted-foreground">
                    AI references your actual spending in conversations
                  </p>
                </div>
                <Switch
                  checked={aiPreferences.include_spending_context}
                  onCheckedChange={(checked) => handleAIPreferenceChange('include_spending_context', checked)}
                  disabled={savingAI}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Proactive Insights</Label>
                  <p className="text-xs text-muted-foreground">
                    AI suggests topics and insights based on your data
                  </p>
                </div>
                <Switch
                  checked={aiPreferences.proactive_insights}
                  onCheckedChange={(checked) => handleAIPreferenceChange('proactive_insights', checked)}
                  disabled={savingAI}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Analysis Features */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-yellow-500" />
              <h4 className="text-sm font-medium">Smart Analysis</h4>
            </div>
            <div className="space-y-3 pl-6">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-0.5">
                  <Label>Detect Recurring Transactions</Label>
                  <p className="text-xs text-muted-foreground">
                    Identify regular bills and income patterns
                  </p>
                </div>
                <Switch
                  checked={aiPreferences.detect_recurring}
                  onCheckedChange={(checked) => handleAIPreferenceChange('detect_recurring', checked)}
                  disabled={savingAI}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-0.5">
                  <Label>Detect Subscriptions</Label>
                  <p className="text-xs text-muted-foreground">
                    Track streaming, software, and other subscriptions
                  </p>
                </div>
                <Switch
                  checked={aiPreferences.detect_subscriptions}
                  onCheckedChange={(checked) => handleAIPreferenceChange('detect_subscriptions', checked)}
                  disabled={savingAI}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-0.5">
                  <Label>Unusual Spending Detection</Label>
                  <p className="text-xs text-muted-foreground">
                    Alert when spending deviates from your patterns
                  </p>
                </div>
                <Switch
                  checked={aiPreferences.detect_unusual_spending}
                  onCheckedChange={(checked) => handleAIPreferenceChange('detect_unusual_spending', checked)}
                  disabled={savingAI}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-0.5">
                  <Label>Smart Search</Label>
                  <p className="text-xs text-muted-foreground">
                    Natural language search for transactions
                  </p>
                </div>
                <Switch
                  checked={aiPreferences.smart_search}
                  onCheckedChange={(checked) => handleAIPreferenceChange('smart_search', checked)}
                  disabled={savingAI}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* AI Usage Tracking */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              <h4 className="text-sm font-medium">Daily Usage</h4>
              {aiUsage && (
                <Badge variant={aiUsage.isPro ? 'default' : 'secondary'} className="ml-auto text-xs">
                  {aiUsage.isPro ? 'Pro' : 'Free'}
                </Badge>
              )}
            </div>
            <div className="space-y-3 pl-6">
              {loadingUsage ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading usage...</span>
                </div>
              ) : aiUsage ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {aiUsage.stats.map((stat) => {
                      const featureLabels: Record<string, string> = {
                        categorization: 'Categorization',
                        chat: 'AI Chat',
                        recurring_detection: 'Recurring Detection',
                        insights: 'Insights',
                        search: 'Smart Search',
                      }
                      const isNearLimit = stat.percentage >= 80
                      const isAtLimit = stat.percentage >= 100

                      return (
                        <div key={stat.feature} className="p-3 rounded-lg border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">
                              {featureLabels[stat.feature] || stat.feature}
                            </span>
                            <span className={`text-xs ${isAtLimit ? 'text-red-500' : isNearLimit ? 'text-amber-500' : 'text-muted-foreground'}`}>
                              {stat.used}/{stat.limit}
                            </span>
                          </div>
                          <Progress
                            value={Math.min(stat.percentage, 100)}
                            className={`h-2 ${isAtLimit ? '[&>div]:bg-red-500' : isNearLimit ? '[&>div]:bg-amber-500' : ''}`}
                          />
                          {stat.remaining > 0 ? (
                            <p className="text-xs text-muted-foreground mt-1">
                              {stat.remaining} remaining today
                            </p>
                          ) : (
                            <p className="text-xs text-red-500 mt-1">
                              Limit reached - resets at midnight
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-sm">
                    <span className="text-muted-foreground">Tokens Used Today</span>
                    <span className="font-medium tabular-nums">
                      {aiUsage.tokens.total.toLocaleString()}
                    </span>
                  </div>
                  {!aiUsage.isPro && (
                    <div className="p-3 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                          Upgrade to Pro for higher limits
                        </span>
                      </div>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 ml-6">
                        Get up to 10x more AI requests per day
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Unable to load usage data</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Privacy & Data */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              <h4 className="text-sm font-medium">Privacy & Data</h4>
            </div>
            <div className="space-y-3 pl-6">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="space-y-0.5">
                  <Label>Allow Transaction Analysis</Label>
                  <p className="text-xs text-muted-foreground">
                    AI can analyze your transactions for insights
                  </p>
                </div>
                <Switch
                  checked={aiPreferences.allow_transaction_analysis}
                  onCheckedChange={(checked) => handleAIPreferenceChange('allow_transaction_analysis', checked)}
                  disabled={savingAI}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="space-y-0.5">
                  <Label>Help Improve AI Models</Label>
                  <p className="text-xs text-muted-foreground">
                    Share anonymized data to improve categorization accuracy
                  </p>
                </div>
                <Switch
                  checked={aiPreferences.improve_ai_models}
                  onCheckedChange={(checked) => handleAIPreferenceChange('improve_ai_models', checked)}
                  disabled={savingAI}
                />
              </div>

              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-start gap-2">
                  <Eye className="h-4 w-4 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                      Your data is secure
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                      All AI processing is done securely. Your financial data is never sold or shared with third parties for advertising.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Rules */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 p-2.5">
            <Wand2 className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <CardTitle>Transaction Rules</CardTitle>
            <CardDescription>Auto-rename, categorize, or ignore transactions</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Create rules to automatically rename, categorize, mark as income, or ignore transactions that match specific patterns.
          </p>
          <Link href="/dashboard/settings/rules">
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Wand2 className="h-4 w-4" />
                Manage Transaction Rules
              </span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Data Export */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 p-2.5">
            <Download className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle>Data Export</CardTitle>
            <CardDescription>Download your financial data</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Export all your transactions, accounts, and budgets as a JSON file.
          </p>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...</>
            ) : (
              <><Download className="mr-2 h-4 w-4" /> Export Data</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-red-500 to-rose-600 p-2.5">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle>Security</CardTitle>
            <CardDescription>Manage your account security</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Two-Factor Authentication */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Smartphone className="h-4 w-4 text-emerald-600" />
              <h4 className="text-sm font-medium">Two-Factor Authentication (2FA)</h4>
            </div>
            <MFASettings />
          </div>

          <Separator />

          {/* Session Security Info */}
          <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                  Session Security Enabled
                </p>
                <ul className="text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
                  <li>• Auto-logout after 5 minutes of inactivity</li>
                  <li>• Maximum session duration of 4 hours</li>
                  <li>• Session expires when browser/tab is closed</li>
                  <li>• Warning displayed 1 minute before timeout</li>
                </ul>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Password changes are managed through email verification.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild className="flex-1">
              <a href="/auth/reset-password">Change Password</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Actions */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-slate-500 to-slate-700 p-2.5">
            <LogOut className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle>Account</CardTitle>
            <CardDescription>Sign out or manage your account</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="w-full"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
          <Separator />
          <div className="pt-2">
            <p className="text-sm text-muted-foreground mb-3">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => !isDeleting && setDeleteDialogOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This action is <strong>permanent and irreversible</strong>. All your data will be deleted including:
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Your profile and personal information</li>
              <li>All linked bank accounts and transactions</li>
              <li>Budgets, spending patterns, and insights</li>
              <li>AI chat history and reports</li>
              <li>Any active subscriptions will be cancelled</li>
            </ul>

            <div className="space-y-2">
              <Label htmlFor="delete-confirmation" className="text-sm font-medium">
                Type <span className="font-mono bg-muted px-1 rounded">DELETE</span> to confirm
              </Label>
              <Input
                id="delete-confirmation"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
                disabled={isDeleting}
                className="font-mono"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setDeleteConfirmation('')
              }}
              disabled={isDeleting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmation !== 'DELETE' || isDeleting}
              className="w-full sm:w-auto"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete My Account
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Categorization Modal */}
      <Dialog open={batchModalOpen} onOpenChange={(open) => !batchStarted && setBatchModalOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SterlingIcon size="md" />
              Categorize All Transactions
            </DialogTitle>
            <DialogDescription>
              {!batchStarted ? (
                <>
                  This will analyze and categorize all uncategorized transactions using AI.
                  This process may take <strong>1-5 minutes</strong> depending on the number of transactions.
                </>
              ) : (
                'Processing your transactions...'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {loadingBatchCount ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !batchStarted ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        {batchTotal > 0 ? (
                          <>Found <strong>{batchTotal.toLocaleString()}</strong> transaction{batchTotal !== 1 ? 's' : ''} to categorize</>
                        ) : (
                          'No uncategorized transactions found'
                        )}
                      </p>
                      {batchTotal > 0 && (
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          This may take a while. Please don&apos;t close this window until complete.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">
                      {batchProcessed === batchTotal && categorizationResult
                        ? `${batchTotal.toLocaleString()} / ${batchTotal.toLocaleString()}`
                        : `~${batchProcessed.toLocaleString()} / ${batchTotal.toLocaleString()}`
                      }
                    </span>
                  </div>
                  <Progress
                    value={batchTotal > 0 ? (batchProcessed / batchTotal) * 100 : 0}
                    className="h-3"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    {batchProcessed === batchTotal && categorizationResult ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        Complete! Categorized {categorizationResult.categorized} transactions.
                      </span>
                    ) : (
                      <>
                        Processing batch ~{Math.ceil(batchProcessed / 25) + 1} of ~{Math.ceil(batchTotal / 25)}
                        <span className="text-muted-foreground/60"> (estimated)</span>
                      </>
                    )}
                  </p>
                </div>

                {batchProcessed < batchTotal && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Please wait, this may take a few minutes...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            {!batchStarted ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setBatchModalOpen(false)}
                  disabled={loadingBatchCount}
                >
                  Cancel
                </Button>
                <Button
                  onClick={runBatchCategorization}
                  disabled={loadingBatchCount || batchTotal === 0}
                  className="bg-gradient-to-r from-slate-500 to-slate-700 hover:from-slate-600 hover:to-slate-800"
                >
                  <SterlingIcon size="sm" className="mr-2" />
                  Start Categorization
                </Button>
              </>
            ) : batchProcessed === batchTotal && categorizationResult ? (
              <Button onClick={() => setBatchModalOpen(false)}>
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
