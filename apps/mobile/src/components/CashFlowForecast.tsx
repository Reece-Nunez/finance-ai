import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { MerchantLogo } from '@/components/MerchantLogo'
import { formatCurrency, formatDate } from '@/utils/format'

interface DailyForecast {
  date: string
  projectedBalance: number
  isLowBalance: boolean
  isNegative: boolean
}

interface CashFlowAlert {
  type: string
  message: string
  severity: 'warning' | 'critical'
}

interface UpcomingRecurring {
  id: string
  name: string
  amount: number
  nextDate: string
  isIncome: boolean
}

interface ForecastData {
  forecast: {
    currentBalance: number
    projectedEndBalance: number
    lowestBalance: number
    lowestBalanceDate: string
    totalIncome: number
    totalExpenses: number
    netCashFlow: number
    dailyForecasts: DailyForecast[]
    alerts: CashFlowAlert[]
    confidence: 'high' | 'medium' | 'low'
  }
  summary: string
  dailySpendingRate: number
  upcomingRecurring: UpcomingRecurring[]
}

export function CashFlowForecast() {
  const [expanded, setExpanded] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['cashFlowForecast'],
    queryFn: () => api.getCashFlowForecast(),
  })

  if (isLoading) {
    return (
      <View className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
        <View className="flex-row items-center justify-center py-4">
          <ActivityIndicator color="#64748b" />
        </View>
      </View>
    )
  }

  if (error || !data?.forecast) {
    return null // Don't show if error or no data
  }

  const { forecast, summary, dailySpendingRate, upcomingRecurring } = data as ForecastData
  const balanceChange = forecast.projectedEndBalance - forecast.currentBalance
  const isPositiveChange = balanceChange >= 0
  const criticalAlerts = forecast.alerts?.filter((a) => a.severity === 'critical') || []
  const warningAlerts = forecast.alerts?.filter((a) => a.severity === 'warning') || []

  const getConfidenceColor = () => {
    switch (forecast.confidence) {
      case 'high':
        return 'bg-emerald-500/20 text-emerald-400'
      case 'medium':
        return 'bg-amber-500/20 text-amber-400'
      default:
        return 'bg-slate-700 text-slate-400'
    }
  }

  return (
    <View className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      {/* Header */}
      <TouchableOpacity
        className="flex-row items-center justify-between p-4"
        onPress={() => setExpanded(!expanded)}
      >
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-xl items-center justify-center bg-blue-500/20">
            <Ionicons name="trending-up" size={20} color="#3b82f6" />
          </View>
          <View className="ml-3">
            <View className="flex-row items-center">
              <Text className="text-white font-semibold">Cash Flow Forecast</Text>
              <View className={`ml-2 px-2 py-0.5 rounded-full ${getConfidenceColor()}`}>
                <Text className={`text-xs font-medium ${getConfidenceColor().split(' ')[1]}`}>
                  {forecast.confidence}
                </Text>
              </View>
            </View>
            <Text className="text-slate-500 text-xs">30-day projection</Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#64748b"
        />
      </TouchableOpacity>

      {/* Summary Stats */}
      <View className="px-4 pb-4">
        <View className="flex-row">
          <View className="flex-1 bg-slate-800 rounded-xl p-3 mr-2">
            <Text className="text-slate-500 text-xs">Current</Text>
            <Text className="text-white font-semibold">
              {formatCurrency(forecast.currentBalance)}
            </Text>
          </View>
          <View className="flex-1 bg-slate-800 rounded-xl p-3 ml-2">
            <Text className="text-slate-500 text-xs">Projected</Text>
            <Text
              className={`font-semibold ${
                forecast.projectedEndBalance < 0 ? 'text-red-400' : 'text-white'
              }`}
            >
              {formatCurrency(forecast.projectedEndBalance)}
            </Text>
          </View>
        </View>

        {/* Change Indicator */}
        <View className="flex-row items-center justify-center mt-3 py-2 bg-slate-800 rounded-xl">
          <Ionicons
            name={isPositiveChange ? 'arrow-up' : 'arrow-down'}
            size={16}
            color={isPositiveChange ? '#22c55e' : '#ef4444'}
          />
          <Text
            className={`ml-1 font-semibold ${
              isPositiveChange ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {formatCurrency(Math.abs(balanceChange))}
          </Text>
          <Text className="text-slate-500 text-sm ml-2">over 30 days</Text>
        </View>
      </View>

      {/* Expanded Content */}
      {expanded && (
        <View className="px-4 pb-4 border-t border-slate-800 pt-4">
          {/* Alerts */}
          {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
            <View className="mb-4">
              {criticalAlerts.slice(0, 2).map((alert, i) => (
                <View
                  key={i}
                  className="flex-row items-start bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-2"
                >
                  <Ionicons name="alert-circle" size={16} color="#ef4444" />
                  <Text className="text-red-400 text-sm flex-1 ml-2">{alert.message}</Text>
                </View>
              ))}
              {warningAlerts.slice(0, 1).map((alert, i) => (
                <View
                  key={i}
                  className="flex-row items-start bg-amber-500/10 border border-amber-500/30 rounded-xl p-3"
                >
                  <Ionicons name="information-circle" size={16} color="#f59e0b" />
                  <Text className="text-amber-400 text-sm flex-1 ml-2">{alert.message}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Stats Grid */}
          <View className="flex-row flex-wrap gap-2 mb-4">
            <View className="flex-1 min-w-[45%] bg-slate-800 rounded-xl p-3">
              <Text className="text-slate-500 text-xs">Lowest Point</Text>
              <Text
                className={`font-semibold ${
                  forecast.lowestBalance < 100 ? 'text-amber-400' : 'text-white'
                }`}
              >
                {formatCurrency(forecast.lowestBalance)}
              </Text>
            </View>
            <View className="flex-1 min-w-[45%] bg-slate-800 rounded-xl p-3">
              <Text className="text-slate-500 text-xs">Daily Avg</Text>
              <Text className="text-white font-semibold">
                {formatCurrency(dailySpendingRate)}/day
              </Text>
            </View>
          </View>

          {/* Upcoming Transactions */}
          {upcomingRecurring && upcomingRecurring.length > 0 && (
            <View>
              <View className="flex-row items-center mb-2">
                <Ionicons name="calendar-outline" size={14} color="#64748b" />
                <Text className="text-slate-400 text-xs font-semibold ml-1">
                  COMING UP THIS WEEK
                </Text>
              </View>
              {upcomingRecurring.slice(0, 4).map((item) => (
                <View
                  key={item.id}
                  className="flex-row items-center bg-slate-800 rounded-xl p-3 mb-2"
                >
                  <MerchantLogo name={item.name} size={36} />
                  <View className="flex-1 ml-3">
                    <Text className="text-white text-sm" numberOfLines={1}>{item.name}</Text>
                    <Text className="text-slate-500 text-xs">
                      {new Date(item.nextDate).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                  <Text
                    className={`font-medium ${
                      item.isIncome ? 'text-emerald-400' : 'text-white'
                    }`}
                  >
                    {item.isIncome ? '+' : '-'}{formatCurrency(item.amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Summary */}
          {summary && (
            <Text className="text-slate-500 text-xs mt-3 border-t border-slate-800 pt-3">
              {summary}
            </Text>
          )}
        </View>
      )}
    </View>
  )
}
