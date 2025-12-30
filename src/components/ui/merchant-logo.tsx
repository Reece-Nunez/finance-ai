'use client'

import { useState, useEffect } from 'react'
import {
  ShoppingBag,
  Coffee,
  Utensils,
  Car,
  Fuel,
  Home,
  Zap,
  Plane,
  Heart,
  Gamepad2,
  Music,
  Film,
  Smartphone,
  CreditCard,
  Building2,
  GraduationCap,
  Dumbbell,
  Shirt,
  Gift,
  HelpCircle,
  DollarSign,
  Briefcase,
  Pill,
  Dog,
  Baby,
  Sparkles,
} from 'lucide-react'
import { getMerchantDomain } from '@/lib/merchant-logos'
import { cn } from '@/lib/utils'

interface MerchantLogoProps {
  merchantName: string | null
  category?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

// Map categories to icons
function getCategoryIcon(category: string | null) {
  if (!category) return ShoppingBag

  const lower = category.toLowerCase()

  // Food & Drink
  if (lower.includes('restaurant') || lower.includes('food') || lower.includes('dining')) return Utensils
  if (lower.includes('coffee') || lower.includes('cafe')) return Coffee
  if (lower.includes('fast food')) return Utensils
  if (lower.includes('bar') || lower.includes('alcohol')) return Utensils

  // Shopping
  if (lower.includes('groceries') || lower.includes('supermarket')) return ShoppingBag
  if (lower.includes('clothing') || lower.includes('apparel')) return Shirt
  if (lower.includes('electronics')) return Smartphone
  if (lower.includes('department store')) return ShoppingBag
  if (lower.includes('shopping')) return ShoppingBag

  // Transportation
  if (lower.includes('gas') || lower.includes('fuel') || lower.includes('petroleum')) return Fuel
  if (lower.includes('auto') || lower.includes('car') || lower.includes('vehicle') || lower.includes('parking')) return Car
  if (lower.includes('taxi') || lower.includes('rideshare') || lower.includes('uber') || lower.includes('lyft')) return Car
  if (lower.includes('airline') || lower.includes('travel') || lower.includes('hotel') || lower.includes('lodging')) return Plane

  // Bills & Utilities
  if (lower.includes('utility') || lower.includes('electric') || lower.includes('water') || lower.includes('gas bill')) return Zap
  if (lower.includes('phone') || lower.includes('telecom') || lower.includes('internet') || lower.includes('cable')) return Smartphone
  if (lower.includes('rent') || lower.includes('mortgage') || lower.includes('housing')) return Home
  if (lower.includes('insurance')) return Building2

  // Entertainment
  if (lower.includes('entertainment')) return Film
  if (lower.includes('streaming') || lower.includes('subscription')) return Film
  if (lower.includes('music')) return Music
  if (lower.includes('game') || lower.includes('gaming')) return Gamepad2
  if (lower.includes('movie') || lower.includes('theater') || lower.includes('cinema')) return Film

  // Health & Wellness
  if (lower.includes('health') || lower.includes('medical') || lower.includes('doctor') || lower.includes('hospital')) return Heart
  if (lower.includes('pharmacy') || lower.includes('drug')) return Pill
  if (lower.includes('gym') || lower.includes('fitness') || lower.includes('sport')) return Dumbbell
  if (lower.includes('beauty') || lower.includes('spa') || lower.includes('salon') || lower.includes('personal care')) return Sparkles

  // Finance
  if (lower.includes('bank') || lower.includes('financial') || lower.includes('atm')) return Building2
  if (lower.includes('payment') || lower.includes('transfer')) return CreditCard
  if (lower.includes('investment')) return DollarSign

  // Other
  if (lower.includes('education') || lower.includes('school') || lower.includes('university')) return GraduationCap
  if (lower.includes('pet')) return Dog
  if (lower.includes('baby') || lower.includes('child') || lower.includes('kid')) return Baby
  if (lower.includes('gift')) return Gift
  if (lower.includes('office') || lower.includes('business')) return Briefcase
  if (lower.includes('income') || lower.includes('payroll') || lower.includes('deposit')) return DollarSign

  return ShoppingBag
}

// Get category background color
function getCategoryColor(category: string | null): string {
  if (!category) return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'

  const lower = category.toLowerCase()

  // Food & Drink - Orange/Amber
  if (lower.includes('restaurant') || lower.includes('food') || lower.includes('dining') ||
      lower.includes('coffee') || lower.includes('fast food') || lower.includes('groceries')) {
    return 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
  }

  // Shopping - Purple
  if (lower.includes('shopping') || lower.includes('clothing') || lower.includes('department') ||
      lower.includes('electronics')) {
    return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
  }

  // Transportation - Blue
  if (lower.includes('gas') || lower.includes('auto') || lower.includes('car') ||
      lower.includes('taxi') || lower.includes('travel') || lower.includes('airline')) {
    return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
  }

  // Bills & Utilities - Yellow
  if (lower.includes('utility') || lower.includes('phone') || lower.includes('rent') ||
      lower.includes('insurance') || lower.includes('bill')) {
    return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
  }

  // Entertainment - Pink
  if (lower.includes('entertainment') || lower.includes('streaming') || lower.includes('music') ||
      lower.includes('game') || lower.includes('movie')) {
    return 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400'
  }

  // Health - Red
  if (lower.includes('health') || lower.includes('medical') || lower.includes('pharmacy') ||
      lower.includes('gym') || lower.includes('fitness')) {
    return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
  }

  // Finance - Green
  if (lower.includes('bank') || lower.includes('financial') || lower.includes('payment') ||
      lower.includes('income') || lower.includes('investment')) {
    return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
  }

  // Education - Indigo
  if (lower.includes('education') || lower.includes('school')) {
    return 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
  }

  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
}

const iconSizes = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
}

const imageSizes = {
  sm: 32,
  md: 40,
  lg: 48,
}

export function MerchantLogo({
  merchantName,
  category,
  size = 'md',
  className,
}: MerchantLogoProps) {
  const [currentSource, setCurrentSource] = useState<'clearbit' | 'google' | 'none'>('clearbit')
  const [imageLoaded, setImageLoaded] = useState(false)

  const domain = getMerchantDomain(merchantName)
  const CategoryIcon = getCategoryIcon(category || null)
  const categoryColor = getCategoryColor(category || null)

  // Get logo URL based on current source
  const logoUrl = domain ? (
    currentSource === 'clearbit'
      ? `https://logo.clearbit.com/${domain}?size=${imageSizes[size] * 2}`
      : currentSource === 'google'
        ? `https://www.google.com/s2/favicons?domain=${domain}&sz=${Math.min(imageSizes[size] * 2, 256)}`
        : null
  ) : null

  // Reset state when merchantName changes
  useEffect(() => {
    setCurrentSource('clearbit')
    setImageLoaded(false)
  }, [merchantName])

  const handleImageError = () => {
    if (currentSource === 'clearbit') {
      // Try Google as fallback
      setCurrentSource('google')
      setImageLoaded(false)
    } else {
      // Both failed, show category icon
      setCurrentSource('none')
    }
  }

  // If no domain or all sources failed, show category icon
  if (!domain || currentSource === 'none') {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full shrink-0',
          sizeClasses[size],
          categoryColor,
          className
        )}
      >
        <CategoryIcon className={iconSizes[size]} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-full overflow-hidden bg-white dark:bg-gray-800 shrink-0',
        sizeClasses[size],
        className
      )}
    >
      {/* Show category icon while loading */}
      {!imageLoaded && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center rounded-full',
            categoryColor
          )}
        >
          <CategoryIcon className={iconSizes[size]} />
        </div>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl!}
        alt={merchantName || 'Merchant'}
        width={imageSizes[size]}
        height={imageSizes[size]}
        className={cn(
          'object-contain transition-opacity duration-200',
          imageLoaded ? 'opacity-100' : 'opacity-0'
        )}
        onLoad={() => setImageLoaded(true)}
        onError={handleImageError}
      />
    </div>
  )
}
