import { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

import {
  useTransactionRules,
  useCreateTransactionRule,
  useDeleteTransactionRule,
} from '@/hooks/useApi'
import { DEFAULT_CATEGORIES, formatCategoryName } from '@sterling/shared'

interface TransactionRule {
  id: string
  match_field: string
  match_pattern: string
  display_name: string | null
  set_category: string | null
  set_as_income: boolean
  is_active: boolean
  priority: number
}

export default function RulesScreen() {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newPattern, setNewPattern] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [newCategory, setNewCategory] = useState<string | null>(null)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)

  const { data, isLoading, refetch } = useTransactionRules()
  const createRule = useCreateTransactionRule()
  const deleteRule = useDeleteTransactionRule()

  const rules = data?.rules || []

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleAddRule = async () => {
    if (!newPattern.trim()) {
      Alert.alert('Error', 'Please enter a pattern to match')
      return
    }

    if (!newDisplayName.trim() && !newCategory) {
      Alert.alert('Error', 'Please set a display name or category')
      return
    }

    try {
      await createRule.mutateAsync({
        match_pattern: newPattern.trim(),
        match_field: 'any',
        display_name: newDisplayName.trim() || undefined,
        set_category: newCategory || undefined,
        apply_to_existing: true,
      })
      setShowAddModal(false)
      setNewPattern('')
      setNewDisplayName('')
      setNewCategory(null)
    } catch (error) {
      Alert.alert('Error', 'Failed to create rule')
    }
  }

  const handleDeleteRule = (rule: TransactionRule) => {
    Alert.alert(
      'Delete Rule',
      `Are you sure you want to delete the rule for "${rule.match_pattern}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRule.mutateAsync(rule.id)
            } catch (error) {
              Alert.alert('Error', 'Failed to delete rule')
            }
          },
        },
      ]
    )
  }

  if (isLoading && !data) {
    return (
      <SafeAreaView className="flex-1 bg-slate-950 items-center justify-center">
        <ActivityIndicator color="#fff" size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={['top']}>
      {/* Header */}
      <View className="px-5 pt-4 pb-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-3 w-10 h-10 bg-slate-900 rounded-full items-center justify-center"
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text className="text-white text-2xl font-bold">Transaction Rules</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowAddModal(true)}
          className="w-10 h-10 bg-white rounded-full items-center justify-center"
        >
          <Ionicons name="add" size={24} color="#020617" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
          />
        }
      >
        {/* Info Card */}
        <View className="mx-5 mb-4 bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <View className="flex-row items-center mb-2">
            <Ionicons name="information-circle-outline" size={20} color="#3b82f6" />
            <Text className="text-white font-semibold ml-2">How Rules Work</Text>
          </View>
          <Text className="text-slate-400 text-sm">
            Rules automatically rename and categorize transactions that match your patterns.
            They apply to new transactions and can be applied to existing ones.
          </Text>
        </View>

        {/* Rules List */}
        {rules.length === 0 ? (
          <View className="mx-5 py-12 items-center">
            <Ionicons name="git-branch-outline" size={48} color="#475569" />
            <Text className="text-slate-400 text-base mt-3">No rules yet</Text>
            <Text className="text-slate-500 text-sm mt-1 text-center">
              Create a rule to automatically categorize{'\n'}and rename matching transactions
            </Text>
            <TouchableOpacity
              className="mt-4 bg-white rounded-xl px-6 py-3"
              onPress={() => setShowAddModal(true)}
            >
              <Text className="text-slate-950 font-semibold">Create Rule</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="mx-5 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden mb-8">
            {rules.map((rule, index) => (
              <View
                key={rule.id}
                className={`p-4 ${index > 0 ? 'border-t border-slate-800' : ''}`}
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="text-white font-medium">
                      Match: "{rule.match_pattern}"
                    </Text>
                    <View className="flex-row flex-wrap mt-2 gap-2">
                      {rule.display_name && (
                        <View className="bg-slate-800 rounded-full px-3 py-1">
                          <Text className="text-slate-300 text-xs">
                            Rename to: {rule.display_name}
                          </Text>
                        </View>
                      )}
                      {rule.set_category && (
                        <View className="bg-blue-500/20 rounded-full px-3 py-1">
                          <Text className="text-blue-400 text-xs">
                            {formatCategoryName(rule.set_category)}
                          </Text>
                        </View>
                      )}
                      {rule.set_as_income && (
                        <View className="bg-emerald-500/20 rounded-full px-3 py-1">
                          <Text className="text-emerald-400 text-xs">Income</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteRule(rule)}
                    className="ml-3 p-2"
                  >
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Rule Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-slate-900 rounded-t-3xl max-h-[85%]">
            {/* Header */}
            <View className="flex-row items-center justify-between p-5 border-b border-slate-800">
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text className="text-slate-400">Cancel</Text>
              </TouchableOpacity>
              <Text className="text-white text-lg font-semibold">New Rule</Text>
              <TouchableOpacity
                onPress={handleAddRule}
                disabled={createRule.isPending}
              >
                {createRule.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-white font-semibold">Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView className="p-5">
              {/* Pattern Input */}
              <View className="mb-4">
                <Text className="text-slate-400 text-sm mb-2">Match Pattern</Text>
                <TextInput
                  className="bg-slate-800 text-white rounded-xl px-4 py-3.5"
                  value={newPattern}
                  onChangeText={setNewPattern}
                  placeholder="e.g., Amazon, Netflix, Uber"
                  placeholderTextColor="#475569"
                  autoCapitalize="none"
                />
                <Text className="text-slate-500 text-xs mt-1">
                  Transactions containing this text will be matched
                </Text>
              </View>

              {/* Display Name Input */}
              <View className="mb-4">
                <Text className="text-slate-400 text-sm mb-2">Rename To (optional)</Text>
                <TextInput
                  className="bg-slate-800 text-white rounded-xl px-4 py-3.5"
                  value={newDisplayName}
                  onChangeText={setNewDisplayName}
                  placeholder="e.g., Amazon Prime, Netflix Subscription"
                  placeholderTextColor="#475569"
                />
              </View>

              {/* Category Picker */}
              <View className="mb-8">
                <Text className="text-slate-400 text-sm mb-2">Set Category (optional)</Text>
                <TouchableOpacity
                  className="bg-slate-800 rounded-xl px-4 py-3.5 flex-row items-center justify-between"
                  onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                >
                  {newCategory ? (
                    <Text className="text-white">{formatCategoryName(newCategory)}</Text>
                  ) : (
                    <Text className="text-slate-400">Select category</Text>
                  )}
                  <Ionicons
                    name={showCategoryPicker ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#64748b"
                  />
                </TouchableOpacity>

                {showCategoryPicker && (
                  <View className="mt-2 bg-slate-800 rounded-xl overflow-hidden">
                    <TouchableOpacity
                      className={`flex-row items-center px-4 py-3 border-b border-slate-700 ${
                        newCategory === null ? 'bg-slate-700' : ''
                      }`}
                      onPress={() => {
                        setNewCategory(null)
                        setShowCategoryPicker(false)
                      }}
                    >
                      <Text className="text-white">None</Text>
                      {newCategory === null && (
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
                        } ${newCategory === cat ? 'bg-slate-700' : ''}`}
                        onPress={() => {
                          setNewCategory(cat)
                          setShowCategoryPicker(false)
                        }}
                      >
                        <Text className="text-white">{formatCategoryName(cat)}</Text>
                        {newCategory === cat && (
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
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
