import { useState, useCallback, useMemo } from 'react'
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
import Svg, { Circle } from 'react-native-svg'

import { useBudgets, useCreateBudget, useDeleteBudget } from '@/hooks/useApi'
import { formatCurrency } from '@/utils/format'
import { MerchantLogo } from '@/components/MerchantLogo'
import { CATEGORY_COLORS, DEFAULT_CATEGORIES, formatCategoryName } from '@sterling/shared'

// Fallback color palette for categories without defined colors
const FALLBACK_COLORS = [
  '#f97316', // orange
  '#3b82f6', // blue
  '#22c55e', // green
  '#a855f7', // purple
  '#ec4899', // pink
  '#eab308', // yellow
  '#14b8a6', // teal
  '#ef4444', // red
]

interface BudgetCategory {
  category: string
  budgetId: string | null
  budgeted: number
  spent: number
  remaining: number
  percentUsed: number
  transactions: Array<{ id: string; name: string; amount: number; date: string }>
}

export default function BudgetsScreen() {
  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [selectedBudget, setSelectedBudget] = useState<BudgetCategory | null>(null)
  const [editingBudget, setEditingBudget] = useState(false)
  const [editBudgetAmount, setEditBudgetAmount] = useState('')

  const { data, isLoading, refetch } = useBudgets()
  const createBudget = useCreateBudget()
  const deleteBudget = useDeleteBudget()

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const getCategoryColor = (category: string, index?: number) => {
    const defined = (CATEGORY_COLORS as Record<string, string>)[category]
    if (defined) return defined
    // Use fallback color based on index or category hash
    const fallbackIndex = index ?? Math.abs(category.split('').reduce((a, b) => a + b.charCodeAt(0), 0))
    return FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length]
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

  const handleSaveBudget = async () => {
    if (!selectedBudget || !editBudgetAmount) {
      Alert.alert('Error', 'Please enter a budget amount')
      return
    }

    const amount = parseFloat(editBudgetAmount)
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount')
      return
    }

    try {
      await createBudget.mutateAsync({ category: selectedBudget.category, amount })
      setEditingBudget(false)
      setEditBudgetAmount('')
      setSelectedBudget(null)
    } catch (error) {
      Alert.alert('Error', 'Failed to save budget')
    }
  }

  const openBudgetDetail = (budget: BudgetCategory) => {
    setSelectedBudget(budget)
    setEditBudgetAmount(budget.budgeted > 0 ? budget.budgeted.toString() : '')
    setEditingBudget(false)
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

        {/* Ring Chart Overview */}
        {data?.summary && (
          <View className="mx-5 bg-slate-900 rounded-2xl p-5 border border-slate-800 items-center">
            <View style={{ width: 220, height: 220, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={220} height={220} style={{ position: 'absolute' }}>
                {/* Background circle */}
                <Circle
                  cx={110}
                  cy={110}
                  r={85}
                  stroke="#1e293b"
                  strokeWidth={18}
                  fill="transparent"
                />
                {/* Progress circle */}
                <Circle
                  cx={110}
                  cy={110}
                  r={85}
                  stroke={
                    (data.summary.totalPercentUsed ?? 0) > 100
                      ? '#ef4444'
                      : (data.summary.totalPercentUsed ?? 0) > 80
                      ? '#f59e0b'
                      : '#22c55e'
                  }
                  strokeWidth={18}
                  strokeLinecap="round"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 85}
                  strokeDashoffset={2 * Math.PI * 85 * (1 - Math.min((data.summary.totalPercentUsed ?? 0) / 100, 1))}
                  rotation={-90}
                  origin="110, 110"
                />
              </Svg>
              <View style={{ alignItems: 'center' }}>
                <Text className="text-slate-400 text-xs uppercase">
                  {(data.summary.totalRemaining ?? 0) >= 0 ? 'Left to Spend' : 'Over Budget'}
                </Text>
                <Text
                  className={`text-2xl font-bold ${
                    (data.summary.totalRemaining ?? 0) >= 0 ? 'text-white' : 'text-red-500'
                  }`}
                >
                  {formatCurrency(Math.abs(data.summary.totalRemaining ?? 0))}
                </Text>
                <View
                  className={`flex-row items-center mt-1 px-2 py-0.5 rounded-full ${
                    data.summary.isOnTrack ? 'bg-emerald-500/20' : 'bg-amber-500/20'
                  }`}
                >
                  <Ionicons
                    name={data.summary.isOnTrack ? 'checkmark-circle' : 'warning'}
                    size={12}
                    color={data.summary.isOnTrack ? '#22c55e' : '#f59e0b'}
                  />
                  <Text
                    className={`text-xs ml-1 ${
                      data.summary.isOnTrack ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {data.summary.isOnTrack ? 'On Track' : 'Ahead of Pace'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Days Remaining */}
            {data.period?.daysLeft !== undefined && (
              <Text className="text-slate-500 text-xs mt-2">
                {data.period.daysLeft} days left in {data.period.month}
              </Text>
            )}

            {/* Stats Row */}
            <View className="flex-row justify-between w-full mt-4 pt-4 border-t border-slate-800">
              <View className="items-center flex-1">
                <Text className="text-slate-500 text-xs">Budgeted</Text>
                <Text className="text-white font-semibold">
                  {formatCurrency(data.summary.totalBudgeted)}
                </Text>
              </View>
              <View className="items-center flex-1">
                <Text className="text-slate-500 text-xs">Spent</Text>
                <Text className="text-white font-semibold">
                  {formatCurrency(data.summary.totalSpent)}
                </Text>
              </View>
              <View className="items-center flex-1">
                <Text className="text-slate-500 text-xs">Daily Avg</Text>
                <Text className="text-white font-semibold">
                  {formatCurrency(data.summary.dailyAverage ?? 0)}
                </Text>
              </View>
            </View>

            {/* Projected Spending */}
            {data.summary.projectedTotal !== undefined && data.summary.totalBudgeted > 0 && (
              <View className="w-full mt-3 pt-3 border-t border-slate-800">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <Ionicons name="trending-up-outline" size={14} color="#64748b" />
                    <Text className="text-slate-400 text-sm ml-1.5">Projected Total</Text>
                  </View>
                  <Text
                    className={`font-semibold ${
                      data.summary.projectedTotal > data.summary.totalBudgeted
                        ? 'text-red-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {formatCurrency(data.summary.projectedTotal)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Alerts */}
        {data?.alerts && data.alerts.length > 0 && (
          <View className="mx-5 mt-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <View className="flex-row items-center mb-2">
              <Ionicons name="warning" size={18} color="#f59e0b" />
              <Text className="text-amber-500 font-semibold ml-2">Budget Alerts</Text>
            </View>
            {data.alerts.slice(0, 3).map((alert, index) => (
              <View
                key={index}
                className={`flex-row items-center py-2 ${
                  index > 0 ? 'border-t border-amber-500/20' : ''
                }`}
              >
                <View
                  className={`w-2 h-2 rounded-full mr-2 ${
                    alert.type === 'over' ? 'bg-red-500' : 'bg-amber-500'
                  }`}
                />
                <Text className="text-amber-100/80 flex-1 text-sm">
                  <Text className="font-medium text-amber-100">
                    {formatCategoryName(alert.category)}
                  </Text>
                  {' '}{alert.message}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Budget Categories */}
        <View className="px-5 mt-6 mb-2">
          <Text className="text-white text-lg font-semibold">Categories</Text>
        </View>

        {data?.categories && data.categories.length > 0 ? (
          <View className="mx-5 mb-8">
            {data.categories.map((budget, index) => {
              const budgeted = budget.budgeted ?? 0
              const spent = budget.spent ?? 0
              const percentUsed = budget.percentUsed ?? (budgeted > 0 ? (spent / budgeted) * 100 : 0)
              const categoryColor = getCategoryColor(budget.category, index)
              const txCount = budget.transactions?.length ?? 0

              return (
                <TouchableOpacity
                  key={budget.budgetId || budget.category}
                  className="bg-slate-900 rounded-xl p-4 border border-slate-800 mb-3"
                  onPress={() => openBudgetDetail(budget as BudgetCategory)}
                  onLongPress={() =>
                    budget.budgetId &&
                    handleDeleteBudget(budget.budgetId, budget.category)
                  }
                >
                  <View className="flex-row items-center mb-3">
                    <View
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: categoryColor }}
                    />
                    <Text
                      className="text-white text-base font-medium flex-1 mr-3"
                      numberOfLines={1}
                    >
                      {formatCategoryName(budget.category)}
                    </Text>
                    <Text
                      className={`text-sm font-medium ${
                        percentUsed > 100 ? 'text-red-500' : 'text-slate-400'
                      }`}
                    >
                      {formatCurrency(spent)} / {budgeted > 0 ? formatCurrency(budgeted) : 'No limit'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#475569" style={{ marginLeft: 4 }} />
                  </View>

                  {/* Progress Bar */}
                  {budgeted > 0 && (
                    <View className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <View
                        style={{
                          height: '100%',
                          width: `${Math.min(percentUsed, 100)}%`,
                          backgroundColor:
                            percentUsed > 100
                              ? '#ef4444'
                              : percentUsed > 80
                              ? '#f59e0b'
                              : categoryColor,
                          borderRadius: 9999,
                        }}
                      />
                    </View>
                  )}

                  <View className="flex-row justify-between mt-2">
                    <Text className="text-slate-500 text-xs">
                      {txCount} transaction{txCount !== 1 ? 's' : ''}
                    </Text>
                    {budgeted > 0 && (
                      <Text
                        className={`text-xs ${
                          percentUsed > 100 ? 'text-red-400' : 'text-slate-500'
                        }`}
                      >
                        {percentUsed > 100
                          ? `${formatCurrency(spent - budgeted)} over`
                          : `${formatCurrency(budgeted - spent)} left`}
                      </Text>
                    )}
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

      {/* Budget Detail Modal */}
      <Modal
        visible={selectedBudget !== null}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setSelectedBudget(null)
          setEditingBudget(false)
        }}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-slate-900 rounded-t-3xl max-h-[85%]">
            {selectedBudget && (
              <>
                {/* Header */}
                <View className="flex-row items-center justify-between p-5 border-b border-slate-800">
                  <TouchableOpacity onPress={() => {
                    setSelectedBudget(null)
                    setEditingBudget(false)
                  }}>
                    <Ionicons name="close" size={24} color="#64748b" />
                  </TouchableOpacity>
                  <Text className="text-white text-lg font-semibold">
                    {formatCategoryName(selectedBudget.category)}
                  </Text>
                  <View className="flex-row items-center">
                    {!editingBudget && (
                      <TouchableOpacity
                        onPress={() => setEditingBudget(true)}
                        className="mr-3"
                      >
                        <Ionicons name="pencil" size={20} color="#3b82f6" />
                      </TouchableOpacity>
                    )}
                    {selectedBudget.budgetId && (
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedBudget(null)
                          setEditingBudget(false)
                          handleDeleteBudget(selectedBudget.budgetId!, selectedBudget.category)
                        }}
                      >
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <ScrollView className="p-5">
                  {/* Edit Budget Section */}
                  {editingBudget ? (
                    <View className="bg-slate-800 rounded-xl p-4 mb-4">
                      <Text className="text-white font-semibold mb-3">
                        {selectedBudget.budgeted > 0 ? 'Edit Budget' : 'Set Budget Limit'}
                      </Text>
                      <Text className="text-slate-400 text-sm mb-2">Monthly Budget</Text>
                      <View className="flex-row items-center bg-slate-700 rounded-xl px-4 mb-4">
                        <Text className="text-slate-400 text-lg">$</Text>
                        <TextInput
                          className="flex-1 text-white text-lg py-3 px-2"
                          placeholder="0.00"
                          placeholderTextColor="#475569"
                          value={editBudgetAmount}
                          onChangeText={setEditBudgetAmount}
                          keyboardType="decimal-pad"
                          autoFocus
                        />
                      </View>
                      <View className="flex-row">
                        <TouchableOpacity
                          className="flex-1 py-3 rounded-xl items-center bg-slate-700 mr-2"
                          onPress={() => {
                            setEditingBudget(false)
                            setEditBudgetAmount(selectedBudget.budgeted > 0 ? selectedBudget.budgeted.toString() : '')
                          }}
                        >
                          <Text className="text-slate-300 font-medium">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className={`flex-1 py-3 rounded-xl items-center ml-2 ${
                            createBudget.isPending ? 'bg-slate-600' : 'bg-white'
                          }`}
                          onPress={handleSaveBudget}
                          disabled={createBudget.isPending}
                        >
                          {createBudget.isPending ? (
                            <ActivityIndicator color="#020617" size="small" />
                          ) : (
                            <Text className="text-slate-950 font-semibold">Save</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    /* Budget Summary */
                    <View className="bg-slate-800 rounded-xl p-4 mb-4">
                      <TouchableOpacity
                        className="flex-row justify-between mb-3"
                        onPress={() => setEditingBudget(true)}
                      >
                        <Text className="text-slate-400">Budget</Text>
                        <View className="flex-row items-center">
                          <Text className="text-white font-semibold">
                            {selectedBudget.budgeted > 0 ? formatCurrency(selectedBudget.budgeted) : 'Tap to set limit'}
                          </Text>
                          <Ionicons name="pencil" size={14} color="#64748b" style={{ marginLeft: 6 }} />
                        </View>
                      </TouchableOpacity>
                      <View className="flex-row justify-between mb-3">
                        <Text className="text-slate-400">Spent</Text>
                        <Text className="text-white font-semibold">
                          {formatCurrency(selectedBudget.spent)}
                        </Text>
                      </View>
                      {selectedBudget.budgeted > 0 && (
                        <>
                          <View className="flex-row justify-between mb-3">
                            <Text className="text-slate-400">Remaining</Text>
                            <Text
                              className={`font-semibold ${
                                selectedBudget.remaining >= 0 ? 'text-emerald-400' : 'text-red-400'
                              }`}
                            >
                              {formatCurrency(selectedBudget.remaining)}
                            </Text>
                          </View>
                          {/* Progress Bar */}
                          <View className="h-3 bg-slate-700 rounded-full overflow-hidden">
                            <View
                              style={{
                                height: '100%',
                                width: `${Math.min(selectedBudget.percentUsed, 100)}%`,
                                backgroundColor:
                                  selectedBudget.percentUsed > 100
                                    ? '#ef4444'
                                    : selectedBudget.percentUsed > 80
                                    ? '#f59e0b'
                                    : '#22c55e',
                                borderRadius: 9999,
                              }}
                            />
                          </View>
                          <Text className="text-slate-500 text-xs text-center mt-2">
                            {Math.round(selectedBudget.percentUsed)}% used
                          </Text>
                        </>
                      )}
                    </View>
                  )}

                  {/* Transactions */}
                  <Text className="text-white font-semibold mb-3">
                    Transactions ({selectedBudget.transactions?.length ?? 0})
                  </Text>
                  {selectedBudget.transactions && selectedBudget.transactions.length > 0 ? (
                    <View className="bg-slate-800 rounded-xl overflow-hidden">
                      {selectedBudget.transactions.map((tx, index) => (
                        <View
                          key={tx.id}
                          className={`flex-row items-center p-4 ${
                            index > 0 ? 'border-t border-slate-700' : ''
                          }`}
                        >
                          <MerchantLogo name={tx.name} size={40} />
                          <View className="flex-1 mx-3">
                            <Text className="text-white" numberOfLines={1}>
                              {tx.name}
                            </Text>
                            <Text className="text-slate-500 text-xs">
                              {new Date(tx.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </Text>
                          </View>
                          <Text className="text-white font-medium">
                            {formatCurrency(Math.abs(tx.amount))}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View className="bg-slate-800 rounded-xl p-6 items-center">
                      <Ionicons name="receipt-outline" size={32} color="#475569" />
                      <Text className="text-slate-500 text-sm mt-2">No transactions this month</Text>
                    </View>
                  )}

                  {/* Bottom padding */}
                  <View className="h-8" />
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
