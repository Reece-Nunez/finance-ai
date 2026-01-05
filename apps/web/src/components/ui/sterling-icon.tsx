'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

interface SterlingIconProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeMap = {
  sm: { width: 12, height: 12 },
  md: { width: 16, height: 16 },
  lg: { width: 20, height: 20 },
  xl: { width: 24, height: 24 },
}

export function SterlingIcon({ className, size = 'md' }: SterlingIconProps) {
  const { width, height } = sizeMap[size]

  return (
    <Image
      src="/logo.png"
      alt="Sterling AI"
      width={width}
      height={height}
      className={cn('inline-block', className)}
    />
  )
}
