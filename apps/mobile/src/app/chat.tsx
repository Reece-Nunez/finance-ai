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
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useMutation } from '@tanstack/react-query'

import { api } from '@/services/api'
import { useSubscription } from '@/hooks/useApi'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export default function ChatScreen() {
  const router = useRouter()
  const flatListRef = useRef<FlatList>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [sessionId, setSessionId] = useState<string | undefined>()

  const { data: subscription } = useSubscription()
  const isPro = subscription?.tier === 'pro'

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

    const text = inputText.trim()
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
          <View className="flex-1 px-5 justify-center">
            <View className="items-center mb-8">
              <View className="w-16 h-16 bg-slate-900 rounded-full items-center justify-center mb-4">
                <Ionicons name="chatbubbles-outline" size={32} color="#64748b" />
              </View>
              <Text className="text-white text-lg font-semibold mb-2">
                Ask me anything
              </Text>
              <Text className="text-slate-400 text-center">
                I can help you understand your spending, track budgets, and provide personalized financial advice.
              </Text>
            </View>

            {/* Suggested Questions */}
            <Text className="text-slate-400 text-sm mb-3">Try asking:</Text>
            {suggestedQuestions.map((question, index) => (
              <TouchableOpacity
                key={index}
                className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 mb-2"
                onPress={() => {
                  setInputText(question)
                }}
              >
                <Text className="text-slate-300">{question}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
