'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface IncomeByTypeData {
  count: number
  actualThisMonth: number
  projectedMonthly: number
}

interface IncomeByTypeProps {
  byType: Record<string, IncomeByTypeData>
  totalActual: number
}

// Income type colors matching the income page
const TYPE_COLORS: Record<string, string> = {
  payroll: '#10b981',      // emerald
  government: '#3b82f6',   // blue
  retirement: '#8b5cf6',   // purple
  self_employment: '#f97316', // orange
  investment: '#06b6d4',   // cyan
  rental: '#f59e0b',       // amber
  other: '#6b7280',        // gray
  refund: '#ec4899',       // pink
  transfer: '#94a3b8',     // slate
}

const TYPE_LABELS: Record<string, string> = {
  payroll: 'Payroll',
  government: 'Government',
  retirement: 'Retirement',
  self_employment: 'Self-Employment',
  investment: 'Investment',
  rental: 'Rental',
  other: 'Other',
  refund: 'Refunds',
  transfer: 'Transfers',
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function IncomeByType({ byType, totalActual }: IncomeByTypeProps) {
  const chartData = useMemo(() => {
    return Object.entries(byType)
      .filter(([, data]) => data.actualThisMonth > 0)
      .map(([type, data]) => ({
        name: TYPE_LABELS[type] || type,
        value: data.actualThisMonth,
        color: TYPE_COLORS[type] || TYPE_COLORS.other,
        percentage: totalActual > 0 ? Math.round((data.actualThisMonth / totalActual) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value)
  }, [byType, totalActual])

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Income by Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground">
            <p>No income recorded this month</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Income by Type</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className="rounded-lg bg-background border p-2 shadow-lg">
                        <p className="font-medium text-sm">{data.name}</p>
                        <p className="text-sm text-green-600">{formatCurrency(data.value)}</p>
                        <p className="text-xs text-muted-foreground">{data.percentage}% of total</p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Type breakdown list */}
        <div className="mt-4 space-y-2">
          {chartData.slice(0, 4).map((item) => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm">{item.name}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-medium">{formatCurrency(item.value)}</span>
                <span className="text-xs text-muted-foreground ml-2">({item.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
