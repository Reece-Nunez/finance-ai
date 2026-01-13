'use client'

import dynamic from 'next/dynamic'
import { ComponentType, ReactNode } from 'react'

// Loading placeholder component
function ChartLoadingPlaceholder() {
  return (
    <div className="h-64 w-full animate-pulse rounded-lg bg-muted flex items-center justify-center">
      <span className="text-muted-foreground text-sm">Loading chart...</span>
    </div>
  )
}

function ComponentLoadingPlaceholder() {
  return (
    <div className="h-32 w-full animate-pulse rounded-lg bg-muted" />
  )
}

// ============================================================================
// Lazy-loaded Recharts components
// These are heavy (~200kb) and should only load when needed
// ============================================================================

export const LazyLineChart = dynamic(
  () => import('recharts').then((mod) => mod.LineChart),
  {
    ssr: false,
    loading: () => <ChartLoadingPlaceholder />
  }
)

export const LazyBarChart = dynamic(
  () => import('recharts').then((mod) => mod.BarChart),
  {
    ssr: false,
    loading: () => <ChartLoadingPlaceholder />
  }
)

export const LazyPieChart = dynamic(
  () => import('recharts').then((mod) => mod.PieChart),
  {
    ssr: false,
    loading: () => <ChartLoadingPlaceholder />
  }
)

export const LazyAreaChart = dynamic(
  () => import('recharts').then((mod) => mod.AreaChart),
  {
    ssr: false,
    loading: () => <ChartLoadingPlaceholder />
  }
)

export const LazyComposedChart = dynamic(
  () => import('recharts').then((mod) => mod.ComposedChart),
  {
    ssr: false,
    loading: () => <ChartLoadingPlaceholder />
  }
)

// Re-export other recharts components that are commonly used with charts
// These are loaded synchronously since they're small
export {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  Bar,
  Pie,
  Cell,
  Area,
} from 'recharts'

// ============================================================================
// Utility: Create a lazy-loaded component with loading state
// ============================================================================

interface LazyLoadOptions {
  loading?: ReactNode
  ssr?: boolean
}

/**
 * Create a lazy-loaded version of any component
 *
 * @example
 * const LazyExpensiveComponent = createLazyComponent(
 *   () => import('@/components/expensive'),
 *   { loading: <Skeleton /> }
 * )
 */
export function createLazyComponent<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: LazyLoadOptions = {}
): ComponentType<P> {
  return dynamic(importFn, {
    ssr: options.ssr ?? true,
    loading: () => (options.loading as React.ReactElement) || <ComponentLoadingPlaceholder />,
  })
}
