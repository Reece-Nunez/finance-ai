'use client'

import { ReactNode } from 'react'

interface AccessibleChartProps {
  /** Chart title for screen readers */
  title: string
  /** Detailed description of what the chart shows */
  description: string
  /** Data to render as accessible table */
  data: Record<string, string | number>[]
  /** The visual chart component */
  children: ReactNode
  /** Optional className for the wrapper */
  className?: string
}

/**
 * Wrapper component that makes charts accessible to screen readers.
 * Renders a visually hidden data table alongside the visual chart.
 *
 * @example
 * <AccessibleChart
 *   title="Monthly Spending"
 *   description="Bar chart showing spending by month for the last 6 months"
 *   data={[{ Month: 'Jan', Amount: '$1,200' }, { Month: 'Feb', Amount: '$980' }]}
 * >
 *   <BarChart data={chartData}>...</BarChart>
 * </AccessibleChart>
 */
export function AccessibleChart({
  title,
  description,
  data,
  children,
  className,
}: AccessibleChartProps) {
  if (!data || data.length === 0) {
    return <div className={className}>{children}</div>
  }

  const columns = Object.keys(data[0])

  return (
    <figure role="img" aria-label={title} className={className}>
      <figcaption className="sr-only">{description}</figcaption>

      {/* Hidden data table for screen readers */}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} scope="col">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={col}>{String(row[col])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Visual chart - hidden from screen readers */}
      <div aria-hidden="true">{children}</div>
    </figure>
  )
}
