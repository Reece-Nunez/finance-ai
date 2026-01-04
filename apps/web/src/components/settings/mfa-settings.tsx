'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Loader2, Shield, ShieldCheck, ShieldOff, Smartphone, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

interface MFAFactor {
  id: string
  friendly_name?: string
  factor_type: string
  status: 'verified' | 'unverified'
  created_at: string
}

export function MFASettings() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [factors, setFactors] = useState<MFAFactor[]>([])
  const [enrolling, setEnrolling] = useState(false)
  const [showEnrollDialog, setShowEnrollDialog] = useState(false)
  const [showDisableDialog, setShowDisableDialog] = useState(false)
  const [factorToDisable, setFactorToDisable] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadFactors()
  }, [])

  const loadFactors = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      setFactors(data?.totp || [])
    } catch (error) {
      console.error('Failed to load MFA factors:', error)
    }
    setLoading(false)
  }

  const startEnrollment = async () => {
    setEnrolling(true)
    setVerifyCode('')
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App',
      })

      if (error) throw error

      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
      setFactorId(data.id)
      setShowEnrollDialog(true)
    } catch (error: unknown) {
      const err = error as { message?: string }
      toast.error('Failed to start MFA enrollment', { description: err.message })
    }
    setEnrolling(false)
  }

  const verifyEnrollment = async () => {
    if (!factorId || verifyCode.length !== 6) return

    setVerifying(true)
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      })

      if (challengeError) throw challengeError

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      })

      if (verifyError) throw verifyError

      toast.success('MFA Enabled', { description: 'Two-factor authentication is now active on your account.' })
      setShowEnrollDialog(false)
      setQrCode(null)
      setSecret(null)
      setFactorId(null)
      setVerifyCode('')
      loadFactors()
    } catch (error: unknown) {
      const err = error as { message?: string }
      toast.error('Verification Failed', { description: err.message || 'Invalid code. Please try again.' })
    }
    setVerifying(false)
  }

  const disableFactor = async () => {
    if (!factorToDisable) return

    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: factorToDisable,
      })

      if (error) throw error

      toast.success('MFA Disabled', { description: 'Two-factor authentication has been removed from your account.' })
      setShowDisableDialog(false)
      setFactorToDisable(null)
      loadFactors()
    } catch (error: unknown) {
      const err = error as { message?: string }
      toast.error('Failed to disable MFA', { description: err.message })
    }
  }

  const copySecret = () => {
    if (secret) {
      navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success('Copied to clipboard')
    }
  }

  const hasVerifiedFactor = factors.some(f => f.status === 'verified')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Status Display */}
      <div className={`flex items-center justify-between p-4 rounded-lg border ${
        hasVerifiedFactor
          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
          : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
      }`}>
        <div className="flex items-center gap-3">
          {hasVerifiedFactor ? (
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <ShieldOff className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          )}
          <div>
            <p className={`font-medium ${
              hasVerifiedFactor
                ? 'text-emerald-800 dark:text-emerald-200'
                : 'text-amber-800 dark:text-amber-200'
            }`}>
              {hasVerifiedFactor ? 'Two-Factor Authentication Enabled' : 'Two-Factor Authentication Disabled'}
            </p>
            <p className={`text-sm ${
              hasVerifiedFactor
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-amber-700 dark:text-amber-300'
            }`}>
              {hasVerifiedFactor
                ? 'Your account is protected with an authenticator app'
                : 'Add an extra layer of security to your account'}
            </p>
          </div>
        </div>
        <Badge variant={hasVerifiedFactor ? 'default' : 'secondary'} className={
          hasVerifiedFactor
            ? 'bg-emerald-600 hover:bg-emerald-700'
            : ''
        }>
          {hasVerifiedFactor ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Enrolled Factors */}
      {factors.filter(f => f.status === 'verified').map((factor) => (
        <div key={factor.id} className="flex items-center justify-between p-4 rounded-lg border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800">
              <Smartphone className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <p className="font-medium">{factor.friendly_name || 'Authenticator App'}</p>
              <p className="text-sm text-muted-foreground">
                Added {new Date(factor.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={() => {
              setFactorToDisable(factor.id)
              setShowDisableDialog(true)
            }}
          >
            Remove
          </Button>
        </div>
      ))}

      {/* Enable/Add Button */}
      {!hasVerifiedFactor ? (
        <Button
          onClick={startEnrollment}
          disabled={enrolling}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
        >
          {enrolling ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Setting up...
            </>
          ) : (
            <>
              <Shield className="mr-2 h-4 w-4" />
              Enable Two-Factor Authentication
            </>
          )}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground text-center">
          You can remove two-factor authentication above, but we recommend keeping it enabled for security.
        </p>
      )}

      {/* Enrollment Dialog */}
      <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* QR Code */}
            {qrCode && (
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img
                  src={qrCode}
                  alt="MFA QR Code"
                  width={200}
                  height={200}
                  className="rounded"
                />
              </div>
            )}

            {/* Manual Entry */}
            {secret && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Or enter this code manually:
                </Label>
                <div className="flex gap-2">
                  <code className="flex-1 p-2 text-sm bg-muted rounded font-mono break-all">
                    {secret}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copySecret}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Verification Code Input */}
            <div className="space-y-2">
              <Label htmlFor="verify-code">Enter the 6-digit code from your app</Label>
              <Input
                id="verify-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-widest font-mono"
                autoComplete="one-time-code"
              />
            </div>

            <Button
              onClick={verifyEnrollment}
              disabled={verifying || verifyCode.length !== 6}
              className="w-full"
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify and Enable'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Disable Confirmation Dialog */}
      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the extra security layer from your account. You can re-enable it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={disableFactor}
              className="bg-red-600 hover:bg-red-700"
            >
              Disable MFA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
