import { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { MerchantLogo } from '@/components/MerchantLogo'
import { formatCurrency } from '@/utils/format'

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
  deviation_percent: number | null
  status: string
  detected_at: string
}

type IconName = keyof typeof Ionicons.glyphMap

function getTypeIcon(type: string): IconName {
  switch (type) {
    case 'unusual_amount':
      return 'trending-up'
    case 'duplicate_charge':
      return 'copy-outline'
    case 'price_increase':
      return 'arrow-up-circle-outline'
    case 'new_merchant_large':
      return 'storefront-outline'
    case 'frequency_spike':
      return 'flash-outline'
    default:
      return 'alert-circle-outline'
  }
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical':
      return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' }
    case 'high':
      return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' }
    case 'medium':
      return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' }
    default:
      return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' }
  }
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
  const [expanded, setExpanded] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['anomalies'],
    queryFn: async () => {
      const response = await api.getAnomalies('pending')
      return response
    },
  })

  const updateAnomaly = useMutation({
    mutationFn: async ({ id, status, feedback }: { id: string; status: string; feedback?: string }) => {
      return api.updateAnomaly(id, status, feedback)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anomalies'] })
    },
  })

  const anomalies = data?.anomalies || []
  const pendingAnomalies = anomalies.filter((a: Anomaly) => a.status === 'pending')
  const hasCritical = pendingAnomalies.some((a: Anomaly) => a.severity === 'critical')
  const hasHigh = pendingAnomalies.some((a: Anomaly) => a.severity === 'high')

  const handleDismiss = (anomaly: Anomaly) => {
    Alert.alert(
      'Dismiss Alert',
      'What would you like to do with this alert?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'This is fine',
          onPress: () => updateAnomaly.mutate({ id: anomaly.id, status: 'resolved', feedback: 'expected' }),
        },
        {
          text: 'Suspicious',
          style: 'destructive',
          onPress: () => updateAnomaly.mutate({ id: anomaly.id, status: 'confirmed', feedback: 'suspicious' }),
        },
      ]
    )
  }

  if (isLoading) {
    return (
      <View className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
        <View className="flex-row items-center justify-center py-4">
          <ActivityIndicator color="#64748b" />
        </View>
      </View>
    )
  }

  if (pendingAnomalies.length === 0) {
    return null // Don't show if no anomalies
  }

  const shieldColor = hasCritical
    ? '#ef4444'
    : hasHigh
    ? '#f97316'
    : pendingAnomalies.length > 0
    ? '#eab308'
    : '#22c55e'

  return (
    <View className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <TouchableOpacity
        className="flex-row items-center justify-between p-4"
        onPress={() => setExpanded(!expanded)}
      >
        <View className="flex-row items-center">
          <View
            className={`w-10 h-10 rounded-xl items-center justify-center ${
              hasCritical ? 'bg-red-500/20' : hasHigh ? 'bg-orange-500/20' : 'bg-amber-500/20'
            }`}
          >
            <Ionicons name="shield-outline" size={20} color={shieldColor} />
          </View>
          <View className="ml-3">
            <View className="flex-row items-center">
              <Text className="text-white font-semibold">Anomaly Detection</Text>
              {pendingAnomalies.length > 0 && (
                <View
                  className={`ml-2 px-2 py-0.5 rounded-full ${
                    hasCritical ? 'bg-red-500/20' : hasHigh ? 'bg-orange-500/20' : 'bg-amber-500/20'
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      hasCritical ? 'text-red-400' : hasHigh ? 'text-orange-400' : 'text-amber-400'
                    }`}
                  >
                    {pendingAnomalies.length}
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-slate-500 text-xs">
              {pendingAnomalies.length} alert{pendingAnomalies.length !== 1 ? 's' : ''} need review
            </Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#64748b"
        />
      </TouchableOpacity>

      {/* Expanded Content */}
      {expanded && (
        <View className="px-4 pb-4">
          {pendingAnomalies.slice(0, 3).map((anomaly: Anomaly, index: number) => {
            const colors = getSeverityColor(anomaly.severity)
            return (
              <View
                key={anomaly.id}
                className={`p-3 rounded-xl border mb-2 ${colors.bg} ${colors.border}`}
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-row items-start flex-1">
                    {anomaly.merchant_name ? (
                      <MerchantLogo name={anomaly.merchant_name} size={36} />
                    ) : (
                      <View className={`w-9 h-9 rounded-full items-center justify-center ${colors.bg}`}>
                        <Ionicons name={getTypeIcon(anomaly.anomaly_type)} size={18} color={anomaly.severity === 'critical' ? '#ef4444' : anomaly.severity === 'high' ? '#f97316' : '#eab308'} />
                      </View>
                    )}
                    <View className="ml-2 flex-1">
                      <Text className="text-white font-medium text-sm">{anomaly.title}</Text>
                      <Text className="text-slate-400 text-xs mt-0.5" numberOfLines={2}>
                        {anomaly.description}
                      </Text>
                      {anomaly.amount && (
                        <View className="flex-row items-center mt-1">
                          <Text className="text-white text-sm font-medium">
                            {formatCurrency(anomaly.amount)}
                          </Text>
                          {anomaly.deviation_percent && (
                            <Text className="text-orange-400 text-xs ml-2">
                              +{anomaly.deviation_percent.toFixed(0)}%
                            </Text>
                          )}
                        </View>
                      )}
                      <Text className="text-slate-500 text-[10px] mt-1">
                        {formatTimeAgo(anomaly.detected_at)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    className="ml-2 p-1"
                    onPress={() => handleDismiss(anomaly)}
                  >
                    <Ionicons name="close" size={18} color="#64748b" />
                  </TouchableOpacity>
                </View>
              </View>
            )
          })}

          {pendingAnomalies.length > 3 && (
            <Text className="text-slate-500 text-xs text-center mt-1">
              +{pendingAnomalies.length - 3} more alerts
            </Text>
          )}
        </View>
      )}
    </View>
  )
}
