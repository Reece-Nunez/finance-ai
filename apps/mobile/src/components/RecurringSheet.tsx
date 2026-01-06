import { useState, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { useUpdateRecurring, useDeleteRecurring } from '@/hooks/useApi'
import { MerchantLogo } from '@/components/MerchantLogo'
import { formatCurrency, formatDate } from '@/utils/format'
import { formatCategoryName } from '@sterling/shared'

interface RecurringItem {
  id: string
  name: string
  displayName: string
  amount: number
  averageAmount: number
  frequency: string
  isIncome: boolean
  nextDate: string | null
  lastDate: string | null
  category: string | null
  confidence: string
  occurrences: number
}

interface RecurringSheetProps {
  item: RecurringItem | null
  visible: boolean
  onClose: () => void
}

// Normalize merchant name for pattern matching (same as API)
function normalizeMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .slice(0, 3)
    .join(' ')
    .trim()
}

const getFrequencyLabel = (frequency: string) => {
  switch (frequency) {
    case 'weekly':
      return 'Weekly'
    case 'bi-weekly':
      return 'Every 2 weeks'
    case 'monthly':
      return 'Monthly'
    case 'quarterly':
      return 'Quarterly'
    case 'yearly':
      return 'Yearly'
    default:
      return frequency || 'Unknown'
  }
}

const getFrequencyMultiplier = (frequency: string) => {
  switch (frequency) {
    case 'weekly':
      return { perMonth: 4.33, perYear: 52 }
    case 'bi-weekly':
      return { perMonth: 2.17, perYear: 26 }
    case 'monthly':
      return { perMonth: 1, perYear: 12 }
    case 'quarterly':
      return { perMonth: 0.33, perYear: 4 }
    case 'yearly':
      return { perMonth: 0.083, perYear: 1 }
    default:
      return { perMonth: 1, perYear: 12 }
  }
}

const getConfidenceColor = (confidence: string) => {
  switch (confidence) {
    case 'high':
      return '#22c55e'
    case 'medium':
      return '#eab308'
    case 'low':
      return '#f97316'
    default:
      return '#64748b'
  }
}

const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi-weekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

export function RecurringSheet({ item, visible, onClose }: RecurringSheetProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editAmount, setEditAmount] = useState('')
  const [editFrequency, setEditFrequency] = useState('')
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false)

  const updateRecurring = useUpdateRecurring()
  const deleteRecurring = useDeleteRecurring()

  useEffect(() => {
    if (item) {
      setEditAmount(String(item.averageAmount ?? 0))
      setEditFrequency(item.frequency)
      setIsEditing(false)
      setShowFrequencyPicker(false)
    }
  }, [item])

  if (!item) return null

  const multiplier = getFrequencyMultiplier(editFrequency || item.frequency)
  const currentAmount = isEditing ? parseFloat(editAmount) || 0 : (item.averageAmount ?? 0)
  const monthlyAmount = currentAmount * multiplier.perMonth
  const yearlyAmount = currentAmount * multiplier.perYear

  const handleSave = async () => {
    const updates: { frequency?: string; amount?: number } = {}

    if (editFrequency !== item.frequency) {
      updates.frequency = editFrequency
    }

    const newAmount = parseFloat(editAmount)
    if (!isNaN(newAmount) && newAmount !== item.averageAmount) {
      updates.amount = newAmount
    }

    if (Object.keys(updates).length === 0) {
      setIsEditing(false)
      return
    }

    try {
      await updateRecurring.mutateAsync({ id: item.id, updates })
      setIsEditing(false)
      onClose()
    } catch (error) {
      Alert.alert('Error', 'Failed to update. Please try again.')
    }
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete Recurring',
      `Are you sure you want to remove "${item.displayName}" from your recurring ${item.isIncome ? 'income' : 'bills'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const merchantPattern = normalizeMerchant(item.displayName || item.name)
              await deleteRecurring.mutateAsync({
                merchantPattern,
                originalName: item.name,
              })
              onClose()
            } catch (error) {
              Alert.alert('Error', 'Failed to delete. Please try again.')
            }
          },
        },
      ]
    )
  }

  const isLoading = updateRecurring.isPending || deleteRecurring.isPending

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-slate-900 rounded-t-3xl max-h-[85%]">
          {/* Header */}
          <View className="flex-row items-center justify-between p-5 border-b border-slate-800">
            {isEditing ? (
              <TouchableOpacity onPress={() => setIsEditing(false)}>
                <Text className="text-slate-400">Cancel</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setIsEditing(true)}>
                <Text className="text-blue-400">Edit</Text>
              </TouchableOpacity>
            )}
            <Text className="text-white text-lg font-semibold">
              {item.isIncome ? 'Income' : 'Recurring Bill'}
            </Text>
            {isEditing ? (
              <TouchableOpacity onPress={handleSave} disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-white font-semibold">Save</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={onClose}>
                <View className="w-8 h-8 bg-slate-800 rounded-full items-center justify-center">
                  <Ionicons name="close" size={20} color="#fff" />
                </View>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView className="p-5">
            {/* Header with Logo */}
            <View className="items-center mb-6">
              <MerchantLogo name={item.displayName} size={72} />
              <Text className="text-white text-xl font-bold mt-4 text-center">
                {item.displayName}
              </Text>

              {isEditing ? (
                <>
                  {/* Editable Amount */}
                  <View className="flex-row items-center mt-4">
                    <Text className="text-slate-400 text-2xl mr-1">$</Text>
                    <TextInput
                      className="text-white text-3xl font-bold bg-slate-800 rounded-lg px-3 py-2 min-w-[120px] text-center"
                      value={editAmount}
                      onChangeText={setEditAmount}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor="#64748b"
                    />
                  </View>

                  {/* Frequency Picker */}
                  <TouchableOpacity
                    className="mt-4 bg-slate-800 rounded-xl px-4 py-3 flex-row items-center"
                    onPress={() => setShowFrequencyPicker(!showFrequencyPicker)}
                  >
                    <Text className="text-slate-300 mr-2">
                      {getFrequencyLabel(editFrequency)}
                    </Text>
                    <Ionicons
                      name={showFrequencyPicker ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color="#94a3b8"
                    />
                  </TouchableOpacity>

                  {showFrequencyPicker && (
                    <View className="mt-2 bg-slate-800 rounded-xl overflow-hidden w-full">
                      {FREQUENCIES.map((freq, index) => (
                        <TouchableOpacity
                          key={freq.value}
                          className={`flex-row items-center justify-between px-4 py-3 ${
                            index < FREQUENCIES.length - 1 ? 'border-b border-slate-700' : ''
                          } ${editFrequency === freq.value ? 'bg-slate-700' : ''}`}
                          onPress={() => {
                            setEditFrequency(freq.value)
                            setShowFrequencyPicker(false)
                          }}
                        >
                          <Text className="text-white">{freq.label}</Text>
                          {editFrequency === freq.value && (
                            <Ionicons name="checkmark" size={20} color="#22c55e" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <>
                  <Text
                    className={`text-3xl font-bold mt-2 ${
                      item.isIncome ? 'text-emerald-500' : 'text-white'
                    }`}
                  >
                    {item.isIncome ? '+' : ''}
                    {formatCurrency(Math.abs(item.averageAmount ?? 0))}
                  </Text>
                  <View className="flex-row items-center mt-2">
                    <View className="bg-slate-800 rounded-full px-3 py-1">
                      <Text className="text-slate-300 text-sm">
                        {getFrequencyLabel(item.frequency)}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Next Payment */}
            {item.nextDate && !item.isIncome && (
              <View className="bg-slate-800 rounded-2xl p-4 mb-4">
                <View className="flex-row items-center">
                  <View className="w-12 h-12 bg-slate-700 rounded-full items-center justify-center">
                    <Ionicons name="calendar-outline" size={24} color="#fff" />
                  </View>
                  <View className="ml-4 flex-1">
                    <Text className="text-slate-400 text-sm">Next Payment</Text>
                    <Text className="text-white text-lg font-semibold">
                      {formatDate(item.nextDate, 'long')}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Cost Breakdown */}
            {!item.isIncome && (
              <View className="bg-slate-800 rounded-2xl p-4 mb-4">
                <Text className="text-slate-400 text-sm mb-3">Cost Breakdown</Text>
                <View className="flex-row justify-between py-2 border-b border-slate-700">
                  <Text className="text-slate-300">Per Payment</Text>
                  <Text className="text-white font-semibold">
                    {formatCurrency(Math.abs(item.averageAmount ?? 0))}
                  </Text>
                </View>
                <View className="flex-row justify-between py-2 border-b border-slate-700">
                  <Text className="text-slate-300">Monthly</Text>
                  <Text className="text-white font-semibold">
                    {formatCurrency(monthlyAmount)}
                  </Text>
                </View>
                <View className="flex-row justify-between py-2">
                  <Text className="text-slate-300">Yearly</Text>
                  <Text className="text-white font-semibold">
                    {formatCurrency(yearlyAmount)}
                  </Text>
                </View>
              </View>
            )}

            {/* Details */}
            <View className="bg-slate-800 rounded-2xl p-4 mb-8">
              <Text className="text-slate-400 text-sm mb-3">Details</Text>

              {item.category && (
                <View className="flex-row justify-between py-2 border-b border-slate-700">
                  <Text className="text-slate-300">Category</Text>
                  <Text className="text-white">{formatCategoryName(item.category)}</Text>
                </View>
              )}

              <View className="flex-row justify-between py-2 border-b border-slate-700">
                <Text className="text-slate-300">Frequency</Text>
                <Text className="text-white">{getFrequencyLabel(item.frequency)}</Text>
              </View>

              {item.lastDate && (
                <View className="flex-row justify-between py-2 border-b border-slate-700">
                  <Text className="text-slate-300">Last Seen</Text>
                  <Text className="text-white">{formatDate(item.lastDate)}</Text>
                </View>
              )}

              <View className="flex-row justify-between py-2 border-b border-slate-700">
                <Text className="text-slate-300">Occurrences</Text>
                <Text className="text-white">{item.occurrences} times</Text>
              </View>

              <View className="flex-row justify-between py-2">
                <Text className="text-slate-300">Confidence</Text>
                <View className="flex-row items-center">
                  <View
                    className="w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: getConfidenceColor(item.confidence) }}
                  />
                  <Text
                    className="capitalize"
                    style={{ color: getConfidenceColor(item.confidence) }}
                  >
                    {item.confidence || 'Unknown'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Delete Button */}
            <TouchableOpacity
              className="bg-red-500/10 border border-red-500/30 rounded-xl py-4 items-center mb-8"
              onPress={handleDelete}
              disabled={isLoading}
            >
              {deleteRecurring.isPending ? (
                <ActivityIndicator color="#ef4444" size="small" />
              ) : (
                <View className="flex-row items-center">
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  <Text className="text-red-500 font-semibold ml-2">
                    Remove from Recurring
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
