import { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import Svg, { Circle } from 'react-native-svg'

import { api } from '@/services/api'
import { useSubscription, useInsights } from '@/hooks/useApi'
import { formatCurrency } from '@/utils/format'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type IconName = keyof typeof Ionicons.glyphMap

// Health Score Ring Component
function HealthScoreRing({ score, status }: { score: number; status: string }) {
  const radius = 35
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

  return (
    <View className="relative items-center justify-center">
      <Svg width={80} height={80}>
        <Circle
          cx={40}
          cy={40}
          r={radius}
          stroke="#1e293b"
          strokeWidth={6}
          fill="transparent"
        />
        <Circle
          cx={40}
          cy={40}
          r={radius}
          stroke={getColor()}
          strokeWidth={6}
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 40 40)"
        />
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Text className="text-white text-xl font-bold">{score}</Text>
        <Text className="text-slate-400 text-[10px]">{getStatusText()}</Text>
      </View>
    </View>
  )
}

// Quick Action Card Component
function QuickActionCard({
  icon,
  title,
  subtitle,
  onPress,
  variant = 'default',
}: {
  icon: IconName
  title: string
  subtitle: string
  onPress: () => void
  variant?: 'default' | 'warning' | 'success'
}) {
  const bgClass = variant === 'warning'
    ? 'bg-amber-500/10 border-amber-500/30'
    : variant === 'success'
    ? 'bg-emerald-500/10 border-emerald-500/30'
    : 'bg-slate-900 border-slate-800'

  const iconColor = variant === 'warning'
    ? '#f59e0b'
    : variant === 'success'
    ? '#10b981'
    : '#94a3b8'

  return (
    <TouchableOpacity
      className={`flex-row items-center rounded-xl border p-3 ${bgClass}`}
      onPress={onPress}
    >
      <View className={`w-10 h-10 rounded-full items-center justify-center ${
        variant === 'warning' ? 'bg-amber-500/20' : variant === 'success' ? 'bg-emerald-500/20' : 'bg-slate-800'
      }`}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-white font-medium text-sm">{title}</Text>
        <Text className="text-slate-500 text-xs">{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#475569" />
    </TouchableOpacity>
  )
}

// Insight Stat Card
function InsightCard({ label, value, trend, subtitle }: {
  label: string
  value: string
  trend?: 'up' | 'down' | 'neutral'
  subtitle?: string
}) {
  return (
    <View className="bg-slate-900 rounded-xl p-3 border border-slate-800 flex-1 min-w-[45%]">
      <Text className="text-slate-500 text-xs">{label}</Text>
      <View className="flex-row items-center mt-1">
        <Text className="text-white text-lg font-bold">{value}</Text>
        {trend && trend !== 'neutral' && (
          <Ionicons
            name={trend === 'up' ? 'arrow-up' : 'arrow-down'}
            size={14}
            color={trend === 'up' ? '#ef4444' : '#22c55e'}
            style={{ marginLeft: 4 }}
          />
        )}
      </View>
      {subtitle && <Text className="text-slate-500 text-xs mt-0.5">{subtitle}</Text>}
    </View>
  )
}

export default function ChatScreen() {
  const router = useRouter()
  const flatListRef = useRef<FlatList>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [sessionId, setSessionId] = useState<string | undefined>()

  const { data: subscription } = useSubscription()
  const { data: insightsData } = useInsights()
  const isPro = subscription?.tier === 'pro'
  const insights = insightsData

  const sendMessage = useMutation({
    mutationFn: async (text: string) => {
      const newMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: text },
      ]
      return api.sendChatMessage(newMessages, sessionId)
    },
    onSuccess: (data, text) => {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: text,
      }
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
      }
      setMessages((prev) => [...prev, userMessage, assistantMessage])
      setSessionId(data.session_id)
    },
    onError: (error) => {
      Alert.alert('Error', 'Failed to send message. Please try again.')
    },
  })

  const handleSend = () => {
    if (!inputText.trim() || sendMessage.isPending) return
    sendQuestion(inputText.trim())
  }

  const sendQuestion = (text: string) => {
    if (!text.trim() || sendMessage.isPending) return

    if (!isPro) {
      Alert.alert(
        'Pro Feature',
        'AI Chat is a Pro feature. Upgrade to access personalized financial insights.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/billing') },
        ]
      )
      return
    }

    setInputText('')
    sendMessage.mutate(text)
  }

  const handleNewChat = () => {
    setMessages([])
    setSessionId(undefined)
  }

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    }
  }, [messages])

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user'
    return (
      <View
        className={`mb-3 max-w-[85%] ${isUser ? 'self-end' : 'self-start'}`}
      >
        <View
          className={`px-4 py-3 rounded-2xl ${
            isUser ? 'bg-white' : 'bg-slate-800'
          }`}
        >
          <Text className={isUser ? 'text-slate-950' : 'text-white'}>
            {item.content}
          </Text>
        </View>
      </View>
    )
  }

  const suggestedQuestions = [
    "How much did I spend on food this month?",
    "What's my biggest expense category?",
    "Am I on track with my budget?",
    "How can I save more money?",
  ]

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View className="px-5 pt-4 pb-4 flex-row items-center justify-between border-b border-slate-800">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-3 w-10 h-10 bg-slate-900 rounded-full items-center justify-center"
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
            <View>
              <Text className="text-white text-xl font-bold">AI Assistant</Text>
              <Text className="text-slate-400 text-xs">
                {isPro ? 'Ask anything about your finances' : 'Pro feature'}
              </Text>
            </View>
          </View>
          {messages.length > 0 && (
            <TouchableOpacity
              onPress={handleNewChat}
              className="bg-slate-900 rounded-full px-3 py-2"
            >
              <Text className="text-slate-400 text-sm">New Chat</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Messages */}
        {messages.length === 0 ? (
          <ScrollView className="flex-1 px-5">
            {/* Header with Health Score */}
            <View className="flex-row items-center justify-between py-4">
              <View>
                <Text className="text-white text-2xl font-bold">Sterling</Text>
                <Text className="text-slate-400 text-sm">
                  {insights?.period?.month} • {insights?.period?.daysLeft} days left
                </Text>
              </View>
              {insights?.healthScore !== undefined && (
                <HealthScoreRing
                  score={insights.healthScore}
                  status={insights.healthStatus || 'fair'}
                />
              )}
            </View>

            {/* Personalized Greeting */}
            <View className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-4">
              <Text className="text-emerald-400 text-lg font-medium">
                Hello! 👋
              </Text>
              <Text className="text-emerald-400/70 text-sm mt-1">
                How can I help you with your finances today?
              </Text>
            </View>

            {/* Quick Insights */}
            {insights?.stats && (
              <>
                <Text className="text-slate-500 text-xs font-semibold uppercase mb-2">
                  Your Snapshot
                </Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  <InsightCard
                    label="Spending"
                    value={formatCurrency(insights.stats.currentSpending || 0)}
                    trend={insights.stats.spendingChange > 0 ? 'up' : insights.stats.spendingChange < 0 ? 'down' : 'neutral'}
                    subtitle={insights.stats.spendingChange !== 0 ? `${Math.abs(Math.round(insights.stats.spendingChange))}% vs last month` : undefined}
                  />
                  <InsightCard
                    label="Income"
                    value={formatCurrency(insights.stats.currentIncome || 0)}
                  />
                  <InsightCard
                    label="Budget Left"
                    value={formatCurrency(insights.stats.budgetRemaining || 0)}
                    subtitle={`${Math.round(insights.stats.budgetPercentUsed || 0)}% used`}
                  />
                  <InsightCard
                    label="Cash Flow"
                    value={formatCurrency(insights.stats.netCashFlow || 0)}
                    trend={(insights.stats.netCashFlow || 0) < 0 ? 'down' : 'neutral'}
                  />
                </View>
              </>
            )}

            {/* Quick Actions */}
            <Text className="text-slate-500 text-xs font-semibold uppercase mb-2">
              Quick Actions
            </Text>
            <View className="gap-2 mb-4">
              <QuickActionCard
                icon="heart-outline"
                title="Financial Health Check"
                subtitle="Get a complete analysis"
                variant="success"
                onPress={() => sendQuestion('Give me a complete financial health check')}
              />
              <QuickActionCard
                icon="bar-chart-outline"
                title="Spending Analysis"
                subtitle="See where your money is going"
                onPress={() => sendQuestion('Analyze my spending patterns this month')}
              />
              <QuickActionCard
                icon="wallet-outline"
                title="Savings Opportunities"
                subtitle="Find ways to save more"
                onPress={() => sendQuestion('What are some ways I can save money based on my spending?')}
              />
              <QuickActionCard
                icon="flag-outline"
                title="Budget Review"
                subtitle="Check budget progress"
                onPress={() => sendQuestion('How am I doing with my budgets this month?')}
              />
            </View>

            {/* Smart Suggestions */}
            {insights?.suggestions && insights.suggestions.length > 0 && (
              <>
                <View className="flex-row items-center mb-2">
                  <Ionicons name="flash" size={14} color="#f59e0b" />
                  <Text className="text-slate-500 text-xs font-semibold uppercase ml-1">
                    Personalized For You
                  </Text>
                </View>
                <View className="gap-2 mb-4">
                  {insights.suggestions.slice(0, 4).map((suggestion: { text: string; priority: string }, index: number) => (
                    <TouchableOpacity
                      key={index}
                      className={`flex-row items-center rounded-xl border p-3 ${
                        suggestion.priority === 'high'
                          ? 'bg-amber-500/10 border-amber-500/30'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                      onPress={() => sendQuestion(suggestion.text)}
                    >
                      {suggestion.priority === 'high' ? (
                        <Ionicons name="warning" size={16} color="#f59e0b" />
                      ) : (
                        <View className="w-4 h-4 bg-slate-800 rounded-full" />
                      )}
                      <Text className="text-slate-300 text-sm flex-1 ml-2">
                        {suggestion.text}
                      </Text>
                      <Ionicons name="arrow-forward" size={14} color="#64748b" />
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Budget Alert */}
            {insights?.stats?.categoriesOverBudget && insights.stats.categoriesOverBudget > 0 && (
              <View className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
                <View className="flex-row items-start">
                  <Ionicons name="alert-circle" size={20} color="#ef4444" />
                  <View className="flex-1 ml-2">
                    <Text className="text-red-400 font-medium">Budget Alert</Text>
                    <Text className="text-red-400/70 text-sm mt-1">
                      You're over budget in {insights.stats.categoriesOverBudget} {insights.stats.categoriesOverBudget === 1 ? 'category' : 'categories'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Suggested Questions */}
            <Text className="text-slate-500 text-xs font-semibold uppercase mb-2">
              Try Asking
            </Text>
            {suggestedQuestions.map((question, index) => (
              <TouchableOpacity
                key={index}
                className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 mb-2"
                onPress={() => setInputText(question)}
              >
                <Text className="text-slate-300">{question}</Text>
              </TouchableOpacity>
            ))}

            <View className="h-4" />
          </ScrollView>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 20 }}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
              sendMessage.isPending ? (
                <View className="self-start mb-3">
                  <View className="bg-slate-800 px-4 py-3 rounded-2xl">
                    <ActivityIndicator color="#64748b" size="small" />
                  </View>
                </View>
              ) : null
            }
          />
        )}

        {/* Input Area */}
        <View className="px-5 py-3 border-t border-slate-800">
          <View className="flex-row items-end">
            <View className="flex-1 bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 mr-3">
              <TextInput
                className="text-white max-h-24"
                placeholder="Type a message..."
                placeholderTextColor="#64748b"
                value={inputText}
                onChangeText={setInputText}
                multiline
                returnKeyType="default"
                blurOnSubmit={false}
              />
            </View>
            <TouchableOpacity
              className={`w-12 h-12 rounded-full items-center justify-center ${
                inputText.trim() && !sendMessage.isPending
                  ? 'bg-white'
                  : 'bg-slate-800'
              }`}
              onPress={handleSend}
              disabled={!inputText.trim() || sendMessage.isPending}
            >
              <Ionicons
                name="send"
                size={20}
                color={
                  inputText.trim() && !sendMessage.isPending
                    ? '#020617'
                    : '#64748b'
                }
              />
            </TouchableOpacity>
          </View>

          {!isPro && (
            <TouchableOpacity
              className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex-row items-center justify-center"
              onPress={() => router.push('/billing')}
            >
              <Ionicons name="star" size={16} color="#f59e0b" />
              <Text className="text-amber-500 font-medium ml-2">
                Upgrade to Pro for AI Chat
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
