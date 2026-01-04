'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ChevronDown,
  Plus,
  ShoppingCart,
  Utensils,
  Car,
  Home,
  Zap,
  Heart,
  Plane,
  Gamepad2,
  GraduationCap,
  Gift,
  Briefcase,
  CreditCard,
  Banknote,
  MoreHorizontal,
  Check,
} from 'lucide-react'

interface CategorySelectorProps {
  value: string | null
  onChange: (category: string) => void
  disabled?: boolean
}

interface CategoryItem {
  id?: string
  name: string
  is_default?: boolean
}

// Icon mapping for categories
const CATEGORY_ICONS: Record<string, typeof Utensils> = {
  'food': Utensils,
  'food & dining': Utensils,
  'groceries': ShoppingCart,
  'transportation': Car,
  'gas': Car,
  'gas & fuel': Car,
  'shopping': ShoppingCart,
  'entertainment': Gamepad2,
  'bills': Zap,
  'bills & utilities': Zap,
  'health': Heart,
  'health & medical': Heart,
  'travel': Plane,
  'education': GraduationCap,
  'personal care': Heart,
  'home': Home,
  'home & garden': Home,
  'gifts': Gift,
  'gifts & donations': Gift,
  'subscriptions': CreditCard,
  'income': Banknote,
  'transfer': CreditCard,
  'other': MoreHorizontal,
}

function formatCategory(category: string | null): string {
  if (!category) return 'Uncategorized'
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function getCategoryIcon(category: string | null) {
  if (!category) return MoreHorizontal
  const lower = category.toLowerCase()
  // Check for partial matches
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (lower.includes(key) || key.includes(lower)) {
      return icon
    }
  }
  return MoreHorizontal
}

export function CategorySelector({
  value,
  onChange,
  disabled,
}: CategorySelectorProps) {
  const [open, setOpen] = useState(false)
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Handle wheel events to enable scrolling
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const container = scrollRef.current
    if (!container) return

    // Scroll the container
    container.scrollTop += e.deltaY

    // Prevent the event from bubbling to the popover
    e.stopPropagation()
  }

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories')
        if (response.ok) {
          const data = await response.json()
          // Handle both array of objects and array of strings
          const cats = data.categories || []
          setCategories(cats.map((c: CategoryItem | string) =>
            typeof c === 'string' ? { name: c } : c
          ))
        }
      } catch (error) {
        console.error('Error fetching categories:', error)
      }
    }
    fetchCategories()
  }, [])

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return
    setLoading(true)
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      })
      if (response.ok) {
        const data = await response.json()
        const newCat = data.category
        setCategories([...categories, typeof newCat === 'string' ? { name: newCat } : newCat])
        onChange(newCategoryName.trim())
        setNewCategoryName('')
        setIsCreating(false)
        setOpen(false)
      }
    } catch (error) {
      console.error('Error creating category:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectCategory = (category: string) => {
    onChange(category)
    setOpen(false)
  }

  const Icon = getCategoryIcon(value)

  // Separate default and custom categories
  const defaultCategories = categories.filter((c) => c.is_default !== false)
  const customCategories = categories.filter((c) => c.is_default === false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-between rounded-lg bg-muted/50 p-3 font-normal hover:bg-muted"
          disabled={disabled}
        >
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <p className="text-sm text-muted-foreground">Category</p>
              <p className="font-medium">{formatCategory(value)}</p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div
          ref={scrollRef}
          onWheel={handleWheel}
          className="max-h-[300px] overflow-y-auto p-1"
        >
          {/* All categories from API */}
          {defaultCategories.map((category) => {
            const CategoryIcon = getCategoryIcon(category.name)
            const isSelected = value?.toLowerCase() === category.name.toLowerCase()
            return (
              <button
                key={category.name}
                onClick={() => handleSelectCategory(category.name)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted ${
                  isSelected ? 'bg-muted' : ''
                }`}
              >
                <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-left">{category.name}</span>
                {isSelected && <Check className="h-4 w-4 text-emerald-600" />}
              </button>
            )
          })}

          {/* Custom categories */}
          {customCategories.length > 0 && (
            <>
              <div className="my-1 border-t" />
              <p className="px-3 py-1 text-xs text-muted-foreground">
                Custom Categories
              </p>
              {customCategories.map((category) => {
                const isSelected = value?.toLowerCase() === category.name.toLowerCase()
                return (
                  <button
                    key={category.name}
                    onClick={() => handleSelectCategory(category.name)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted ${
                      isSelected ? 'bg-muted' : ''
                    }`}
                  >
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-left">{category.name}</span>
                    {isSelected && <Check className="h-4 w-4 text-emerald-600" />}
                  </button>
                )
              })}
            </>
          )}
        </div>

        {/* Create new category */}
        <div className="border-t p-2">
          {isCreating ? (
            <div className="flex gap-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Category name"
                className="h-8 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateCategory()
                  if (e.key === 'Escape') setIsCreating(false)
                }}
              />
              <Button
                size="sm"
                className="h-8"
                onClick={handleCreateCategory}
                disabled={loading || !newCategoryName.trim()}
              >
                Add
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-emerald-600 transition-colors hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
              <span>Create Category</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
