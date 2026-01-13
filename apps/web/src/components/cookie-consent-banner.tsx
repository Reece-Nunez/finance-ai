'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { useCookieConsent } from '@/hooks/useCookieConsent'
import { CONSENT_CATEGORIES } from '@/lib/cookie-consent'
import { Cookie, Settings2, Shield } from 'lucide-react'

export function CookieConsentBanner() {
  const {
    consent,
    showBanner,
    isLoading,
    acceptAll,
    rejectAll,
    updateConsent,
  } = useCookieConsent()

  const [showPreferences, setShowPreferences] = useState(false)
  const [tempAnalytics, setTempAnalytics] = useState(consent?.analytics ?? false)
  const [tempMarketing, setTempMarketing] = useState(consent?.marketing ?? false)

  // Don't render anything while loading or if banner shouldn't show
  if (isLoading || !showBanner) {
    return null
  }

  const handleSavePreferences = () => {
    updateConsent({
      analytics: tempAnalytics,
      marketing: tempMarketing,
    })
    setShowPreferences(false)
  }

  const handleOpenPreferences = () => {
    setTempAnalytics(consent?.analytics ?? false)
    setTempMarketing(consent?.marketing ?? false)
    setShowPreferences(true)
  }

  return (
    <>
      {/* Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background border-t shadow-lg">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <Cookie className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">We value your privacy</p>
              <p className="text-sm text-muted-foreground">
                We use cookies to enhance your experience and analyze app usage.
                You can manage your preferences anytime.{' '}
                <Link
                  href="/privacy"
                  className="text-primary hover:underline"
                >
                  Privacy Policy
                </Link>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenPreferences}
              className="flex-1 sm:flex-none"
            >
              <Settings2 className="h-4 w-4 mr-1" />
              Preferences
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={rejectAll}
              className="flex-1 sm:flex-none"
            >
              Reject All
            </Button>
            <Button
              size="sm"
              onClick={acceptAll}
              className="flex-1 sm:flex-none"
            >
              Accept All
            </Button>
          </div>
        </div>
      </div>

      {/* Preferences Dialog */}
      <Dialog open={showPreferences} onOpenChange={setShowPreferences}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Cookie Preferences
            </DialogTitle>
            <DialogDescription>
              Manage how we use cookies to personalize your experience.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Essential - Always on */}
            <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-muted/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {CONSENT_CATEGORIES.essential.name}
                  </span>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    Required
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {CONSENT_CATEGORIES.essential.description}
                </p>
              </div>
              <Switch checked disabled className="opacity-50" />
            </div>

            {/* Analytics */}
            <div className="flex items-start justify-between gap-4 p-3 rounded-lg border">
              <div className="space-y-1">
                <span className="font-medium text-sm">
                  {CONSENT_CATEGORIES.analytics.name}
                </span>
                <p className="text-xs text-muted-foreground">
                  {CONSENT_CATEGORIES.analytics.description}
                </p>
              </div>
              <Switch
                checked={tempAnalytics}
                onCheckedChange={setTempAnalytics}
              />
            </div>

            {/* Marketing */}
            <div className="flex items-start justify-between gap-4 p-3 rounded-lg border">
              <div className="space-y-1">
                <span className="font-medium text-sm">
                  {CONSENT_CATEGORIES.marketing.name}
                </span>
                <p className="text-xs text-muted-foreground">
                  {CONSENT_CATEGORIES.marketing.description}
                </p>
              </div>
              <Switch
                checked={tempMarketing}
                onCheckedChange={setTempMarketing}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPreferences(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePreferences}
              className="w-full sm:w-auto"
            >
              Save Preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
