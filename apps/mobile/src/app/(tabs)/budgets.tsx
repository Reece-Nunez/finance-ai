import { useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

import { useBudgets, useCreateBudget, useDeleteBudget } from '@/hooks/useApi'
import { formatCurrency } from '@/utils/format'
import { CATEGORY_COLORS, DEFAULT_CATEGORIES, formatCategoryName } from '@sterling/shared'

export default function BudgetsScreen() {
  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [budgetAmount, setBudgetAmount] = useState('')

  const { data, isLoading, refetch } = useBudgets()
  const createBudget = useCreateBudget()
  const deleteBudget = useDeleteBudget()

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const getCategoryColor = (category: string) => {
    return (CATEGORY_COLORS as Record<string, string>)[category] || '#64748b'
  }

  const handleCreateBudget = async () => {
    if (!selectedCategory || !budgetAmount) {
      Alert.alert('Error', 'Please select a category and enter an amount')
      return
    }

    const amount = parseFloat(budgetAmount)
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount')
      return
    }

    try {
      await createBudget.mutateAsync({ category: selectedCategory, amount })
      setShowModal(false)
      setSelectedCategory('')
      setBudgetAmount('')
    } catch (error) {
      Alert.alert('Error', 'Failed to create budget')
    }
  }

  const handleDeleteBudget = (id: string, category: string) => {
    Alert.alert(
      'Delete Budget',
      `Are you sure you want to delete the budget for ${formatCategoryName(category)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBudget.mutateAsync(id)
            } catch (error) {
              Alert.alert('Error', 'Failed to delete budget')
            }
          },
        },
      ]
    )
  }

  const budgetedCategories = data?.categories?.map((c) => c.category) || []
  const availableCategories = DEFAULT_CATEGORIES.filter(
    (c) => !budgetedCategories.includes(c)
  )

  if (isLoading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-slate-950 items-center justify-center">
        <ActivityIndicator color="#fff" size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={['top']}>
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
        {/* Header */}
        <View className="px-5 pt-4 pb-4 flex-row items-center justify-between">
          <Text className="text-white text-2xl font-bold">Budgets</Text>
          <TouchableOpacity
            className="bg-white rounded-full w-10 h-10 items-center justify-center"
            onPress={() => setShowModal(true)}
          >
            <Ionicons name="add" size={24} color="#020617" />
          </TouchableOpacity>
        </View>

        {/* Summary */}
        {data?.summary && (
          <View className="mx-5 bg-slate-900 rounded-2xl p-5 border border-slate-800">
            <View className="flex-row justify-between mb-4">
              <View>
                <Text className="text-slate-400 text-sm">Total Budgeted</Text>
                <Text className="text-white text-xl font-bold">
                  {formatCurrency(data.summary.totalBudgeted)}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-slate-400 text-sm">Spent</Text>
                <Text className="text-white text-xl font-bold">
                  {formatCurrency(data.summary.totalSpent)}
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View className="h-3 bg-slate-800 rounded-full overflow-hidden">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(data.summary.percentUsed ?? 0, 100)}%`,
                  backgroundColor:
                    (data.summary.percentUsed ?? 0) > 100
                      ? '#ef4444'
                      : (data.summary.percentUsed ?? 0) > 80
                      ? '#f59e0b'
                      : '#22c55e',
                }}
              />
            </View>

            <View className="flex-row justify-between mt-2">
              <Text className="text-slate-500 text-sm">
                {(data.summary.percentUsed ?? 0).toFixed(0)}% used
              </Text>
              <Text className="text-slate-500 text-sm">
                {formatCurrency(data.summary.remaining ?? 0)} remaining
              </Text>
            </View>
          </View>
        )}

        {/* Budget Categories */}
        <View className="px-5 mt-6 mb-2">
          <Text className="text-white text-lg font-semibold">Categories</Text>
        </View>

        {data?.categories && data.categories.length > 0 ? (
          <View className="mx-5 mb-8">
            {data.categories.map((budget) => {
              const percentUsed =
                budget.budgetAmount > 0
                  ? (budget.spent / budget.budgetAmount) * 100
                  : 0

              return (
                <TouchableOpacity
                  key={budget.budgetId || budget.category}
                  className="bg-slate-900 rounded-xl p-4 border border-slate-800 mb-3"
                  onLongPress={() =>
                    budget.budgetId &&
                    handleDeleteBudget(budget.budgetId, budget.category)
                  }
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center">
                      <View
                        className="w-3 h-3 rounded-full mr-2"
                        style={{
                          backgroundColor: getCategoryColor(budget.category),
                        }}
                      />
                      <Text className="text-white text-base font-medium">
                        {formatCategoryName(budget.category)}
                      </Text>
                    </View>
                    <Text
                      className={`text-sm font-medium ${
                        percentUsed > 100 ? 'text-red-500' : 'text-slate-400'
                      }`}
                    >
                      {formatCurrency(budget.spent)} / {formatCurrency(budget.budgetAmount)}
                    </Text>
                  </View>

                  {/* Progress Bar */}
                  <View className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(percentUsed, 100)}%`,
                        backgroundColor:
                          percentUsed > 100
                            ? '#ef4444'
                            : percentUsed > 80
                            ? '#f59e0b'
                            : getCategoryColor(budget.category),
                      }}
                    />
                  </View>

                  <View className="flex-row justify-between mt-2">
                    <Text className="text-slate-500 text-xs">
                      {budget.transactionCount} transactions
                    </Text>
                    <Text
                      className={`text-xs ${
                        percentUsed > 100 ? 'text-red-400' : 'text-slate-500'
                      }`}
                    >
                      {percentUsed > 100
                        ? `${formatCurrency(budget.spent - budget.budgetAmount)} over`
                        : `${formatCurrency(budget.budgetAmount - budget.spent)} left`}
                    </Text>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        ) : (
          <View className="mx-5 bg-slate-900 rounded-2xl border border-slate-800 p-6 items-center">
            <Ionicons name="wallet-outline" size={48} color="#475569" />
            <Text className="text-slate-400 text-base mt-3">No budgets set</Text>
            <Text className="text-slate-500 text-sm mt-1 text-center">
              Create budgets to track your spending by category
            </Text>
            <TouchableOpacity
              className="mt-4 bg-white rounded-lg px-4 py-2"
              onPress={() => setShowModal(true)}
            >
              <Text className="text-slate-950 font-medium">Create Budget</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Create Budget Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-slate-900 rounded-t-3xl p-5">
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-white text-xl font-bold">New Budget</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Category Selection */}
            <Text className="text-slate-400 text-sm mb-2">Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
            >
              {availableCategories.map((category) => (
                <TouchableOpacity
                  key={category}
                  className={`px-4 py-2 rounded-full mr-2 ${
                    selectedCategory === category
                      ? 'bg-white'
                      : 'bg-slate-800 border border-slate-700'
                  }`}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text
                    className={`text-sm font-medium ${
                      selectedCategory === category
                        ? 'text-slate-950'
                        : 'text-slate-400'
                    }`}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Amount Input */}
            <Text className="text-slate-400 text-sm mb-2">Monthly Budget</Text>
            <View className="flex-row items-center bg-slate-800 rounded-xl px-4 mb-5">
              <Text className="text-slate-400 text-lg">$</Text>
              <TextInput
                className="flex-1 text-white text-lg py-4 px-2"
                placeholder="0.00"
                placeholderTextColor="#475569"
                value={budgetAmount}
                onChangeText={setBudgetAmount}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Create Button */}
            <TouchableOpacity
              className={`py-4 rounded-xl items-center ${
                createBudget.isPending ? 'bg-slate-700' : 'bg-white'
              }`}
              onPress={handleCreateBudget}
              disabled={createBudget.isPending}
            >
              {createBudget.isPending ? (
                <ActivityIndicator color="#020617" />
              ) : (
                <Text className="text-slate-950 font-semibold text-base">
                  Create Budget
                </Text>
              )}
            </TouchableOpacity>

            {/* Bottom padding for safe area */}
            <View className="h-8" />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
