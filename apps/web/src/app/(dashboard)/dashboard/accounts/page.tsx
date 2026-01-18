'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PlaidLinkButton } from '@/components/plaid/plaid-link-button'
import {
  Building2,
  CreditCard,
  Wallet,
  PiggyBank,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface Account {
  id: string
  name: string
  display_name: string | null
  official_name: string | null
  type: string
  subtype: string | null
  mask: string | null
  current_balance: number | null
  available_balance: number | null
  plaid_item_id: string
  plaid_account_id: string
  hidden: boolean
  is_budget_envelope: boolean
}

interface PlaidItem {
  id: string
  item_id: string
  institution_name: string
  status: string
  updated_at: string
}

function getAccountIcon(type: string) {
  switch (type) {
    case 'depository':
      return <Wallet className="h-5 w-5" />
    case 'credit':
      return <CreditCard className="h-5 w-5" />
    case 'investment':
      return <PiggyBank className="h-5 w-5" />
    default:
      return <Building2 className="h-5 w-5" />
  }
}

function formatCurrency(amount: number | null) {
  if (amount === null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export default function AccountsPage() {
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [plaidItems, setPlaidItems] = useState<PlaidItem[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<PlaidItem | null>(null)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [highlightedAccountId, setHighlightedAccountId] = useState<string | null>(null)
  const accountRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [accountsRes, itemsRes] = await Promise.all([
      supabase.from('accounts').select('*').order('type'),
      supabase.from('plaid_items').select('*'),
    ])
    setAccounts(accountsRes.data || [])
    setPlaidItems(itemsRes.data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle deep link from notifications
  useEffect(() => {
    const accountId = searchParams.get('id')
    if (accountId && accounts.length > 0) {
      // Show hidden accounts if the target is hidden
      const targetAccount = accounts.find(a => a.id === accountId)
      if (targetAccount?.hidden) {
        setShowHidden(true)
      }

      // Highlight and scroll to the account
      setHighlightedAccountId(accountId)

      // Scroll to the account after a brief delay to allow render
      setTimeout(() => {
        const ref = accountRefs.current[accountId]
        if (ref) {
          ref.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)

      // Clear highlight after 3 seconds
      setTimeout(() => {
        setHighlightedAccountId(null)
      }, 3000)

      // Clear URL
      window.history.replaceState({}, '', '/dashboard/accounts')
    }
  }, [searchParams, accounts])

  const handleSync = async (itemId: string) => {
    setSyncing(true)

    const toastId = toast.loading('Syncing account...', {
      description: 'This may take a moment, especially for first-time syncs.',
    })

    try {
      const response = await fetch('/api/plaid/sync-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId }),
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('Sync complete!', {
          id: toastId,
          description: `Added ${data.added}, updated ${data.modified}, removed ${data.removed} transactions.`,
        })
      } else {
        toast.error('Sync failed', {
          id: toastId,
          description: 'Please try again later.',
        })
      }

      await fetchData()
    } catch (error) {
      toast.error('Sync failed', {
        id: toastId,
        description: 'Network error. Please check your connection.',
      })
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = async (item: PlaidItem) => {
    setDeleting(true)
    try {
      const response = await fetch('/api/plaid/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.item_id }),
      })
      if (response.ok) {
        await fetchData()
      }
    } finally {
      setDeleting(false)
      setDeleteConfirm(null)
    }
  }

  const handleToggleHidden = async (account: Account) => {
    const newHidden = !account.hidden
    await supabase
      .from('accounts')
      .update({ hidden: newHidden })
      .eq('id', account.id)
    setAccounts(prev => prev.map(a => a.id === account.id ? { ...a, hidden: newHidden } : a))
  }

  const handleToggleBudgetEnvelope = async (account: Account) => {
    const newValue = !account.is_budget_envelope

    // Update the account
    await supabase
      .from('accounts')
      .update({ is_budget_envelope: newValue })
      .eq('id', account.id)

    // If marking as budget envelope, update all transactions from this account to be ignored
    if (newValue) {
      const { error } = await supabase
        .from('transactions')
        .update({ ignore_type: 'all' })
        .eq('plaid_account_id', account.plaid_account_id)

      if (!error) {
        toast.success('Account marked as budget envelope', {
          description: 'All transactions from this account are now hidden from reports'
        })
      }
    } else {
      // If unmarking, reset ignore_type to null for transactions from this account
      await supabase
        .from('transactions')
        .update({ ignore_type: null })
        .eq('plaid_account_id', account.plaid_account_id)

      toast.success('Account unmarked as budget envelope', {
        description: 'Transactions from this account will now appear in reports'
      })
    }

    setAccounts(prev => prev.map(a => a.id === account.id ? { ...a, is_budget_envelope: newValue } : a))
  }

  const handleSaveAccount = async () => {
    if (!editAccount) return
    setSaving(true)
    try {
      await supabase
        .from('accounts')
        .update({ display_name: editName || null })
        .eq('id', editAccount.id)
      setAccounts(prev => prev.map(a => a.id === editAccount.id ? { ...a, display_name: editName || null } : a))
      setEditAccount(null)
    } finally {
      setSaving(false)
    }
  }

  const openEditDialog = (account: Account) => {
    setEditAccount(account)
    setEditName(account.display_name || account.name)
  }

  const visibleAccounts = showHidden ? accounts : accounts.filter(a => !a.hidden)
  const hiddenCount = accounts.filter(a => a.hidden).length

  const totalBalance = visibleAccounts.reduce((sum, acc) => {
    if (acc.type === 'credit') {
      return sum - (acc.current_balance || 0)
    }
    return sum + (acc.current_balance || 0)
  }, 0)

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading accounts...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Accounts</h2>
          <p className="text-muted-foreground">Manage your connected bank accounts</p>
        </div>
        <PlaidLinkButton onSuccess={fetchData} />
      </div>

      {/* Total Net Worth Card */}
      <Card className="border-none bg-gradient-to-br from-slate-500 to-slate-700 text-white">
        <CardHeader>
          <CardDescription className="text-slate-200">Total Net Balance</CardDescription>
          <CardTitle className="text-4xl font-bold">{formatCurrency(totalBalance)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-200">
              Across {visibleAccounts.length} account{visibleAccounts.length !== 1 ? 's' : ''} at{' '}
              {plaidItems.length} institution{plaidItems.length !== 1 ? 's' : ''}
            </p>
            {hiddenCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHidden(!showHidden)}
                className="text-slate-200 hover:text-white hover:bg-slate-600"
              >
                {showHidden ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                {hiddenCount} hidden
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Accounts by Institution */}
      {plaidItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="font-medium">No accounts connected</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect your bank accounts to start tracking your finances
            </p>
          </CardContent>
        </Card>
      ) : (
        plaidItems.map((item) => {
          const itemAccounts = (showHidden ? accounts : visibleAccounts).filter((a) => a.plaid_item_id === item.item_id)
          if (itemAccounts.length === 0 && !showHidden) return null
          return (
            <Card key={item.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200">
                    <Building2 className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{item.institution_name}</CardTitle>
                    <div className="flex items-center gap-2 mt-0.5">
                      <CardDescription>{itemAccounts.length} accounts</CardDescription>
                      <span className="text-muted-foreground">•</span>
                      <span className="flex items-center text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatTimeAgo(item.updated_at)}
                      </span>
                      {item.status === 'active' ? (
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 text-[10px] px-1.5 py-0">
                          <CheckCircle className="h-3 w-3 mr-0.5" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-[10px] px-1.5 py-0">
                          <XCircle className="h-3 w-3 mr-0.5" />
                          Error
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(item.item_id)}
                    disabled={syncing}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                    Sync
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteConfirm(item)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {itemAccounts.map((account) => (
                    <div
                      key={account.id}
                      ref={(el) => { accountRefs.current[account.id] = el }}
                      className={`flex items-center justify-between rounded-lg border p-4 transition-all hover:bg-muted/50 ${
                        highlightedAccountId === account.id
                          ? 'ring-2 ring-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                          : ''
                      } ${account.is_budget_envelope ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          account.is_budget_envelope
                            ? 'bg-gradient-to-br from-amber-100 to-amber-200 text-amber-600'
                            : 'bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-600'
                        }`}>
                          {getAccountIcon(account.type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{account.display_name || account.name}</p>
                            {account.is_budget_envelope && (
                              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-100 text-[10px] px-1.5 py-0">
                                <Wallet className="h-3 w-3 mr-0.5" />
                                Budget Envelope
                              </Badge>
                            )}
                            {account.hidden && (
                              <Badge variant="outline" className="text-gray-500 border-gray-300 text-[10px] px-1.5 py-0">
                                <EyeOff className="h-3 w-3 mr-0.5" />
                                Hidden
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {account.subtype} {account.mask && `•••• ${account.mask}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`font-semibold ${account.type === 'credit' ? 'text-red-600' : ''}`}>
                            {account.type === 'credit' && account.current_balance ? '-' : ''}
                            {formatCurrency(account.current_balance)}
                          </p>
                          {account.available_balance !== null && account.type !== 'credit' && (
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(account.available_balance)} available
                            </p>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(account)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Rename Account
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleHidden(account)}>
                              {account.hidden ? (
                                <>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Show Account
                                </>
                              ) : (
                                <>
                                  <EyeOff className="mr-2 h-4 w-4" />
                                  Hide Account
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleToggleBudgetEnvelope(account)}>
                              <Wallet className="mr-2 h-4 w-4" />
                              {account.is_budget_envelope ? 'Unmark as Budget Envelope' : 'Mark as Budget Envelope'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Disconnect {deleteConfirm?.institution_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all accounts from {deleteConfirm?.institution_name} and delete all
              associated transaction history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Disconnecting...' : 'Disconnect'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
