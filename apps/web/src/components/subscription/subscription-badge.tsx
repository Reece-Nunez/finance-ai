'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sparkles, Crown } from 'lucide-react'
import { useSubscription } from '@/hooks/useSubscription'
import { useState } from 'react'
import { UpgradeModal } from './upgrade-modal'

export function SubscriptionBadge() {
  const { isPro, isTrialing, isLoading } = useSubscription()
  const [showUpgrade, setShowUpgrade] = useState(false)

  if (isLoading) {
    return null
  }

  if (isPro) {
    return (
      <Badge
        variant="secondary"
        className="bg-gradient-to-r from-slate-500 to-slate-700 text-white border-0 gap-1"
      >
        <Crown className="h-3 w-3" />
        {isTrialing ? 'Trial' : 'Pro'}
      </Badge>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowUpgrade(true)}
        className="h-7 gap-1.5 text-xs border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Sparkles className="h-3 w-3" />
        Upgrade
      </Button>
      <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
    </>
  )
}
