'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          error: 'group-[.toaster]:bg-red-50 group-[.toaster]:border-red-200 group-[.toaster]:text-red-800 dark:group-[.toaster]:bg-red-950/50 dark:group-[.toaster]:border-red-900 dark:group-[.toaster]:text-red-200',
          warning: 'group-[.toaster]:bg-amber-50 group-[.toaster]:border-amber-200 group-[.toaster]:text-amber-800 dark:group-[.toaster]:bg-amber-950/50 dark:group-[.toaster]:border-amber-900 dark:group-[.toaster]:text-amber-200',
          success: 'group-[.toaster]:bg-emerald-50 group-[.toaster]:border-emerald-200 group-[.toaster]:text-emerald-800 dark:group-[.toaster]:bg-emerald-950/50 dark:group-[.toaster]:border-emerald-900 dark:group-[.toaster]:text-emerald-200',
          info: 'group-[.toaster]:bg-blue-50 group-[.toaster]:border-blue-200 group-[.toaster]:text-blue-800 dark:group-[.toaster]:bg-blue-950/50 dark:group-[.toaster]:border-blue-900 dark:group-[.toaster]:text-blue-200',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
