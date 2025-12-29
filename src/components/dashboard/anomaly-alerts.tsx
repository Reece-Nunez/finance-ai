'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  X,
  TrendingUp,
  Copy,
  Store,
  Zap,
  Eye,
  EyeOff,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react'
import { toast } from 'sonner'

interface Anomaly {
  id: string
  transaction_id: string | null
  anomaly_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  merchant_name: string | null
  amount: number | null
  expected_amount: number | null
  historical_average: number | null
  deviation_percent: number | null
  related_transaction_ids: string[] | null
  status: string
  user_feedback: string | null
  detected_at: string
}

interface AnomalyStats {
  transactionsAnalyzed: number
  baselinesCalculated: number
  newAnomalies: number
  duplicatesSkipped: number
  totalDetected: number
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'unusual_amount':
      return <TrendingUp className="h-5 w-5" />
    case 'duplicate_charge':
      return <Copy className="h-5 w-5" />
    case 'price_increase':
      return <TrendingUp className="h-5 w-5" />
    case 'new_merchant_large':
      return <Store className="h-5 w-5" />
    case 'frequency_spike':
      return <Zap className="h-5 w-5" />
    default:
      return <AlertTriangle className="h-5 w-5" />
  }
}

function getTypeLabel(type: string) {
  switch (type) {
    case 'unusual_amount':
      return 'Unusual Amount'
    case 'duplicate_charge':
      return 'Duplicate Charge'
    case 'price_increase':
      return 'Price Increase'
    case 'new_merchant_large':
      return 'New Merchant'
    case 'frequency_spike':
      return 'Frequency Spike'
    default:
      return type
  }
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical':
      return 'text-red-600 bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800'
    case 'high':
      return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800'
    case 'medium':
      return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800'
    default:
      return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
  }
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case 'critical':
      return 'bg-red-500 text-white'
    case 'high':
      return 'bg-orange-500 text-white'
    case 'medium':
      return 'bg-yellow-500 text-white'
    default:
      return 'bg-blue-500 text-white'
  }
}

function getShieldIcon(hasCritical: boolean, hasHigh: boolean, count: number) {
  if (hasCritical) return <ShieldAlert className="h-5 w-5 text-white" />
  if (hasHigh) return <ShieldX className="h-5 w-5 text-white" />
  if (count > 0) return <Shield className="h-5 w-5 text-white" />
  return <ShieldCheck className="h-5 w-5 text-white" />
}

function getShieldGradient(hasCritical: boolean, hasHigh: boolean, count: number) {
  if (hasCritical) return 'from-red-500 to-red-600'
  if (hasHigh) return 'from-orange-500 to-orange-600'
  if (count > 0) return 'from-yellow-500 to-yellow-600'
  return 'from-emerald-500 to-teal-600'
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function AnomalyAlerts() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState('')
  const [stats, setStats] = useState<AnomalyStats | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showDismissed, setShowDismissed] = useState(false)

  const fetchAnomalies = useCallback(async () => {
    try {
      const status = showDismissed ? 'all' : 'pending'
      const response = await fetch(`/api/anomalies?status=${status}`)
      const data = await response.json()
      setAnomalies(data.anomalies || [])
    } catch (error) {
      console.error('Error fetching anomalies:', error)
    } finally {
      setLoading(false)
    }
  }, [showDismissed])

  const runScan = async () => {
    setScanning(true)
    setScanStatus('Analyzing transaction history...')

    const statusUpdates = [
      { delay: 500, status: 'Building merchant profiles...' },
      { delay: 1500, status: 'Checking for unusual amounts...' },
      { delay: 2500, status: 'Detecting duplicate charges...' },
      { delay: 3500, status: 'Identifying subscription changes...' },
      { delay: 4500, status: 'Analyzing spending patterns...' },
    ]

    const timeouts: NodeJS.Timeout[] = []
    for (const update of statusUpdates) {
      const timeout = setTimeout(() => {
        setScanStatus(update.status)
      }, update.delay)
      timeouts.push(timeout)
    }

    try {
      toast.info('Scanning transactions...', { id: 'anomaly-scan' })
      const response = await fetch('/api/anomalies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 14, recalculateBaselines: true }),
      })
      const data = await response.json()

      timeouts.forEach(t => clearTimeout(t))

      setAnomalies(data.anomalies || [])
      setStats(data.stats)

      if (data.stats?.newAnomalies > 0) {
        toast.warning(`Found ${data.stats.newAnomalies} new issue${data.stats.newAnomalies > 1 ? 's' : ''}`, {
          id: 'anomaly-scan',
          description: 'Review them below',
        })
      } else if (data.anomalies?.length > 0) {
        toast.info(`${data.anomalies.length} pending alert${data.anomalies.length > 1 ? 's' : ''} to review`, {
          id: 'anomaly-scan',
        })
      } else {
        toast.success('No issues detected', {
          id: 'anomaly-scan',
          description: `Analyzed ${data.stats?.transactionsAnalyzed || 0} transactions`,
        })
      }
    } catch (error) {
      console.error('Error running scan:', error)
      toast.error('Scan failed', { id: 'anomaly-scan' })
    } finally {
      timeouts.forEach(t => clearTimeout(t))
      setScanning(false)
      setScanStatus('')
    }
  }

  const updateAnomaly = async (id: string, status: string, feedback?: string) => {
    try {
      await fetch('/api/anomalies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, user_feedback: feedback }),
      })

      if (status === 'dismissed' || status === 'resolved') {
        setAnomalies(anomalies.filter(a => a.id !== id))
        toast.success(status === 'dismissed' ? 'Alert dismissed' : 'Marked as resolved')
      } else {
        setAnomalies(anomalies.map(a =>
          a.id === id ? { ...a, status, user_feedback: feedback || a.user_feedback } : a
        ))
      }
    } catch (error) {
      console.error('Error updating anomaly:', error)
      toast.error('Failed to update')
    }
  }

  useEffect(() => {
    fetchAnomalies()
  }, [fetchAnomalies])

  const pendingAnomalies = anomalies.filter(a => a.status === 'pending')
  const hasCritical = pendingAnomalies.some(a => a.severity === 'critical')
  const hasHigh = pendingAnomalies.some(a => a.severity === 'high')

  return (
    <Card>
      <CardHeader
        className="flex flex-row items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className={`rounded-lg bg-gradient-to-br ${getShieldGradient(hasCritical, hasHigh, pendingAnomalies.length)} p-2`}>
            {getShieldIcon(hasCritical, hasHigh, pendingAnomalies.length)}
          </div>
          <div>
            <CardTitle className="flex items-center gap-2">
              Anomaly Detection
              {pendingAnomalies.length > 0 && (
                <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  hasCritical
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : hasHigh
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                }`}>
                  {pendingAnomalies.length}
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {!isExpanded && pendingAnomalies.length > 0
                ? `${pendingAnomalies.length} alert${pendingAnomalies.length > 1 ? 's' : ''} need${pendingAnomalies.length === 1 ? 's' : ''} review`
                : stats
                ? `${stats.baselinesCalculated} merchant profiles tracked`
                : 'Monitors for unusual transactions'}
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                runScan()
              }}
              disabled={scanning}
              className="min-w-[100px]"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Scanning...' : 'Scan Now'}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded) }}>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          {/* Scan Progress */}
          {scanning && scanStatus && (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <div className="relative">
                <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  {scanStatus}
                </p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-amber-200 dark:bg-amber-800">
                  <div className="h-full animate-pulse rounded-full bg-amber-500" style={{ width: '60%' }} />
                </div>
              </div>
            </div>
          )}

          {/* Toggle for showing dismissed */}
          {!loading && anomalies.length > 0 && (
            <div className="mb-4 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDismissed(!showDismissed)}
                className="text-xs text-muted-foreground"
              >
                {showDismissed ? (
                  <>
                    <EyeOff className="mr-1 h-3 w-3" />
                    Hide Resolved
                  </>
                ) : (
                  <>
                    <Eye className="mr-1 h-3 w-3" />
                    Show All
                  </>
                )}
              </Button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : pendingAnomalies.length === 0 && !showDismissed ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ShieldCheck className="mb-4 h-12 w-12 text-emerald-500" />
              <h3 className="font-medium">All Clear</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                No suspicious activity detected. Click &quot;Scan Now&quot; to check again.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {(showDismissed ? anomalies : pendingAnomalies).map((anomaly) => (
                <div
                  key={anomaly.id}
                  className={`rounded-lg border p-4 transition-all ${
                    anomaly.status !== 'pending'
                      ? 'opacity-60 bg-muted/30'
                      : 'hover:shadow-md'
                  } ${getSeverityColor(anomaly.severity)}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-full p-2 ${getSeverityBadge(anomaly.severity)}`}>
                        {getTypeIcon(anomaly.anomaly_type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium">{anomaly.title}</h4>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getSeverityBadge(anomaly.severity)}`}>
                            {anomaly.severity}
                          </span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {getTypeLabel(anomaly.anomaly_type)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {anomaly.description}
                        </p>

                        {/* Amount Details */}
                        {anomaly.amount && (
                          <div className="mt-3 flex items-center gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Charged: </span>
                              <span className="font-semibold">{formatCurrency(anomaly.amount)}</span>
                            </div>
                            {anomaly.expected_amount && (
                              <div>
                                <span className="text-muted-foreground">Expected: </span>
                                <span className="font-medium">{formatCurrency(anomaly.expected_amount)}</span>
                              </div>
                            )}
                            {anomaly.deviation_percent && (
                              <div className="text-orange-600 dark:text-orange-400 font-medium">
                                +{anomaly.deviation_percent.toFixed(0)}%
                              </div>
                            )}
                          </div>
                        )}

                        <p className="mt-2 text-xs text-muted-foreground">
                          Detected {formatTimeAgo(anomaly.detected_at)}
                        </p>
                      </div>
                    </div>
                    {anomaly.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateAnomaly(anomaly.id, 'dismissed', 'expected')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {anomaly.status === 'pending' && (
                    <div className="mt-4 flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
                        onClick={() => updateAnomaly(anomaly.id, 'resolved', 'expected')}
                      >
                        <ThumbsUp className="mr-2 h-4 w-4" />
                        This is fine
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
                        onClick={() => updateAnomaly(anomaly.id, 'confirmed', 'suspicious')}
                      >
                        <ThumbsDown className="mr-2 h-4 w-4" />
                        Suspicious
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateAnomaly(anomaly.id, 'dismissed')}
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}

                  {/* Status indicator for resolved */}
                  {anomaly.status !== 'pending' && (
                    <div className="mt-3 flex items-center gap-2 text-xs">
                      <CheckCircle className="h-3 w-3" />
                      <span className="capitalize">{anomaly.status}</span>
                      {anomaly.user_feedback && (
                        <span className="text-muted-foreground">
                          - marked as {anomaly.user_feedback}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
