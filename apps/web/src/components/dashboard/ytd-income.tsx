'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'

interface MonthData {
  month: string
  year: number
  amount: number
}

interface YtdIncomeProps {
  data: MonthData[]
  avgMonthly: number
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function YtdIncome({ data, avgMonthly }: YtdIncomeProps) {
  const currentMonth = new Date().getMonth()

  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      isCurrent: index === currentMonth,
    }))
  }, [data, currentMonth])

  const total = data.reduce((sum, m) => sum + m.amount, 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Year-to-Date Income</CardTitle>
          <div className="text-right">
            <p className="text-2xl font-bold text-green-600">{formatCurrency(total)}</p>
            <p className="text-xs text-muted-foreground">
              Avg: {formatCurrency(avgMonthly)}/month
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                width={45}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg bg-background border p-2 shadow-lg">
                        <p className="font-medium text-sm">{label}</p>
                        <p className="text-sm text-green-600">
                          {formatCurrency(payload[0].value as number)}
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              {/* Average line */}
              <ReferenceLine
                y={avgMonthly}
                stroke="#94a3b8"
                strokeDasharray="5 5"
                label={{
                  value: 'Avg',
                  position: 'right',
                  fill: '#94a3b8',
                  fontSize: 10,
                }}
              />
              <Bar
                dataKey="amount"
                radius={[4, 4, 0, 0]}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isCurrent ? '#10b981' : '#6ee7b7'}
                    opacity={entry.isCurrent ? 1 : 0.7}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
