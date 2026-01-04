import { useState, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { useUpdateTransaction } from '@/hooks/useApi'
import { MerchantLogo } from '@/components/MerchantLogo'
import { formatCurrency, formatDate } from '@/utils/format'
import { DEFAULT_CATEGORIES, CATEGORY_COLORS } from '@sterling/shared'
import type { Transaction } from '@sterling/shared'

interface TransactionSheetProps {
  transaction: Transaction | null
  visible: boolean
  onClose: () => void
}

export function TransactionSheet({ transaction, visible, onClose }: TransactionSheetProps) {
  const [displayName, setDisplayName] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [showCategories, setShowCategories] = useState(false)

  const updateTransaction = useUpdateTransaction()

  useEffect(() => {
    if (transaction) {
      setDisplayName(transaction.display_name || transaction.merchant_name || transaction.name)
      setCategory(transaction.category)
      setNotes(transaction.notes || '')
    }
  }, [transaction])

  const handleSave = async () => {
    if (!transaction) return

    const updates: Partial<Transaction> = {}

    if (displayName !== (transaction.display_name || transaction.merchant_name || transaction.name)) {
      updates.display_name = displayName
    }
    if (category !== transaction.category) {
      updates.category = category
    }
    if (notes !== (transaction.notes || '')) {
      updates.notes = notes
    }

    if (Object.keys(updates).length === 0) {
      onClose()
      return
    }

    try {
      await updateTransaction.mutateAsync({ id: transaction.id, updates })
      onClose()
    } catch (error) {
      Alert.alert('Error', 'Failed to update transaction. Please try again.')
    }
  }

  const getCategoryColor = (cat: string) => {
    return (CATEGORY_COLORS as Record<string, string>)[cat] || '#64748b'
  }

  if (!transaction) return null

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-slate-900 rounded-t-3xl max-h-[90%]">
            {/* Header */}
            <View className="flex-row items-center justify-between p-5 border-b border-slate-800">
              <TouchableOpacity onPress={onClose}>
                <Text className="text-slate-400">Cancel</Text>
              </TouchableOpacity>
              <Text className="text-white text-lg font-semibold">Transaction</Text>
              <TouchableOpacity
                onPress={handleSave}
                disabled={updateTransaction.isPending}
              >
                {updateTransaction.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-white font-semibold">Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView className="p-5">
              {/* Transaction Header */}
              <View className="items-center mb-6">
                <MerchantLogo
                  name={transaction.merchant_name || transaction.name}
                  size={64}
                />
                <Text
                  className={`text-3xl font-bold mt-4 ${
                    transaction.is_income ? 'text-emerald-500' : 'text-white'
                  }`}
                >
                  {transaction.is_income ? '+' : '-'}
                  {formatCurrency(Math.abs(transaction.amount))}
                </Text>
                <Text className="text-slate-400 mt-1">
                  {formatDate(transaction.date, 'long')}
                </Text>
                {transaction.pending && (
                  <View className="bg-amber-500/20 rounded-full px-3 py-1 mt-2">
                    <Text className="text-amber-500 text-sm">Pending</Text>
                  </View>
                )}
              </View>

              {/* Display Name */}
              <View className="mb-4">
                <Text className="text-slate-400 text-sm mb-2">Display Name</Text>
                <TextInput
                  className="bg-slate-800 text-white rounded-xl px-4 py-3.5"
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Enter display name"
                  placeholderTextColor="#475569"
                />
                <Text className="text-slate-500 text-xs mt-1">
                  Original: {transaction.name}
                </Text>
              </View>

              {/* Category */}
              <View className="mb-4">
                <Text className="text-slate-400 text-sm mb-2">Category</Text>
                <TouchableOpacity
                  className="bg-slate-800 rounded-xl px-4 py-3.5 flex-row items-center justify-between"
                  onPress={() => setShowCategories(!showCategories)}
                >
                  {category ? (
                    <View className="flex-row items-center">
                      <View
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: getCategoryColor(category) }}
                      />
                      <Text className="text-white">{category}</Text>
                    </View>
                  ) : (
                    <Text className="text-slate-400">Select category</Text>
                  )}
                  <Ionicons
                    name={showCategories ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#64748b"
                  />
                </TouchableOpacity>

                {showCategories && (
                  <View className="mt-2 bg-slate-800 rounded-xl overflow-hidden">
                    {/* Uncategorized option */}
                    <TouchableOpacity
                      className={`flex-row items-center px-4 py-3 border-b border-slate-700 ${
                        category === null ? 'bg-slate-700' : ''
                      }`}
                      onPress={() => {
                        setCategory(null)
                        setShowCategories(false)
                      }}
                    >
                      <View className="w-3 h-3 rounded-full mr-2 bg-slate-500" />
                      <Text className="text-white">Uncategorized</Text>
                      {category === null && (
                        <Ionicons
                          name="checkmark"
                          size={20}
                          color="#22c55e"
                          style={{ marginLeft: 'auto' }}
                        />
                      )}
                    </TouchableOpacity>

                    {DEFAULT_CATEGORIES.map((cat, index) => (
                      <TouchableOpacity
                        key={cat}
                        className={`flex-row items-center px-4 py-3 ${
                          index < DEFAULT_CATEGORIES.length - 1
                            ? 'border-b border-slate-700'
                            : ''
                        } ${category === cat ? 'bg-slate-700' : ''}`}
                        onPress={() => {
                          setCategory(cat)
                          setShowCategories(false)
                        }}
                      >
                        <View
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: getCategoryColor(cat) }}
                        />
                        <Text className="text-white">{cat}</Text>
                        {category === cat && (
                          <Ionicons
                            name="checkmark"
                            size={20}
                            color="#22c55e"
                            style={{ marginLeft: 'auto' }}
                          />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Notes */}
              <View className="mb-4">
                <Text className="text-slate-400 text-sm mb-2">Notes</Text>
                <TextInput
                  className="bg-slate-800 text-white rounded-xl px-4 py-3.5 min-h-[100px]"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add a note..."
                  placeholderTextColor="#475569"
                  multiline
                  textAlignVertical="top"
                />
              </View>

              {/* Transaction Details */}
              <View className="bg-slate-800 rounded-xl p-4 mb-8">
                <Text className="text-slate-400 text-sm mb-3">Details</Text>

                <View className="flex-row justify-between py-2 border-b border-slate-700">
                  <Text className="text-slate-400">Account</Text>
                  <Text className="text-white">{transaction.account_name || 'Unknown'}</Text>
                </View>

                <View className="flex-row justify-between py-2 border-b border-slate-700">
                  <Text className="text-slate-400">Type</Text>
                  <Text className="text-white">
                    {transaction.is_income ? 'Income' : 'Expense'}
                  </Text>
                </View>

                {transaction.merchant_name && (
                  <View className="flex-row justify-between py-2 border-b border-slate-700">
                    <Text className="text-slate-400">Merchant</Text>
                    <Text className="text-white">{transaction.merchant_name}</Text>
                  </View>
                )}

                <View className="flex-row justify-between py-2">
                  <Text className="text-slate-400">Status</Text>
                  <Text className={transaction.pending ? 'text-amber-500' : 'text-emerald-500'}>
                    {transaction.pending ? 'Pending' : 'Completed'}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
