'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Wand2,
  Trash2,
  MoreVertical,
  Loader2,
  ArrowLeft,
  Tag,
  DollarSign,
  EyeOff,
  Pencil,
  PlayCircle,
  Check,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface TransactionRule {
  id: string
  match_field: string
  match_pattern: string
  display_name: string | null
  set_category: string | null
  set_as_income: boolean
  set_ignore_type: string | null
  description: string | null
  is_active: boolean
  priority: number
  created_at: string
}

function formatCategory(category: string | null): string {
  if (!category) return ''
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export default function TransactionRulesPage() {
  const [rules, setRules] = useState<TransactionRule[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<TransactionRule | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<{ updated: number } | null>(null)

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    try {
      const response = await fetch('/api/transaction-rules')
      if (response.ok) {
        const data = await response.json()
        setRules(data.rules || [])
      }
    } catch (error) {
      console.error('Error fetching rules:', error)
      toast.error('Failed to load transaction rules')
    } finally {
      setLoading(false)
    }
  }

  const toggleRule = async (rule: TransactionRule) => {
    try {
      const response = await fetch('/api/transaction-rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rule.id,
          is_active: !rule.is_active,
        }),
      })

      if (response.ok) {
        setRules(rules.map(r =>
          r.id === rule.id ? { ...r, is_active: !r.is_active } : r
        ))
        toast.success(`Rule ${rule.is_active ? 'disabled' : 'enabled'}`)
      } else {
        toast.error('Failed to update rule')
      }
    } catch (error) {
      console.error('Error toggling rule:', error)
      toast.error('Failed to update rule')
    }
  }

  const deleteRule = async () => {
    if (!deleteConfirm) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/transaction-rules?id=${deleteConfirm.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setRules(rules.filter(r => r.id !== deleteConfirm.id))
        toast.success('Rule deleted')
        setDeleteConfirm(null)
      } else {
        toast.error('Failed to delete rule')
      }
    } catch (error) {
      console.error('Error deleting rule:', error)
      toast.error('Failed to delete rule')
    } finally {
      setDeleting(false)
    }
  }

  const applyAllRules = async () => {
    setApplying(true)
    setApplyResult(null)
    try {
      const response = await fetch('/api/transaction-rules', {
        method: 'PUT',
      })

      if (response.ok) {
        const data = await response.json()
        setApplyResult({ updated: data.updated })
        toast.success(data.message || `Applied ${data.applied} rules to ${data.updated} transactions`)
      } else {
        toast.error('Failed to apply rules')
      }
    } catch (error) {
      console.error('Error applying rules:', error)
      toast.error('Failed to apply rules')
    } finally {
      setApplying(false)
    }
  }

  const getRuleActions = (rule: TransactionRule) => {
    const actions: string[] = []
    if (rule.display_name) actions.push(`Rename to "${rule.display_name}"`)
    if (rule.set_category) actions.push(`Set category to "${formatCategory(rule.set_category)}"`)
    if (rule.set_as_income) actions.push('Mark as recurring income')
    if (rule.set_ignore_type === 'all') actions.push('Ignore from all reports')
    if (rule.set_ignore_type === 'budget') actions.push('Ignore from budget')
    return actions
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-muted-foreground">Loading transaction rules...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Transaction Rules</h1>
            <p className="text-muted-foreground">
              Manage rules that automatically rename, categorize, or ignore transactions
            </p>
          </div>
        </div>
        {rules.length > 0 && (
          <Button
            onClick={applyAllRules}
            disabled={applying}
            variant={applyResult ? 'outline' : 'default'}
          >
            {applying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Applying...
              </>
            ) : applyResult ? (
              <>
                <Check className="mr-2 h-4 w-4 text-green-500" />
                Updated {applyResult.updated} transactions
              </>
            ) : (
              <>
                <PlayCircle className="mr-2 h-4 w-4" />
                Apply All Rules Now
              </>
            )}
          </Button>
        )}
      </div>

      {/* Rules List */}
      {rules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Wand2 className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No Transaction Rules</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              You haven&apos;t created any transaction rules yet. Rules are created from the transaction detail view
              when you click &quot;Create Transaction Rule&quot;.
            </p>
            <Link href="/dashboard/transactions" className="mt-4">
              <Button>
                Go to Transactions
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const actions = getRuleActions(rule)

            return (
              <Card key={rule.id} className={!rule.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Pattern */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-muted-foreground">When</span>
                        <Badge variant="secondary" className="font-mono">
                          {rule.match_field === 'name' ? 'description' : rule.match_field}
                        </Badge>
                        <span className="text-sm text-muted-foreground">contains</span>
                        <Badge variant="outline" className="font-mono max-w-[300px] truncate">
                          &quot;{rule.match_pattern}&quot;
                        </Badge>
                      </div>

                      {/* Actions */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {rule.display_name && (
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            <Tag className="h-3 w-3 mr-1" />
                            Rename: {rule.display_name}
                          </Badge>
                        )}
                        {rule.set_category && (
                          <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                            <Pencil className="h-3 w-3 mr-1" />
                            Category: {formatCategory(rule.set_category)}
                          </Badge>
                        )}
                        {rule.set_as_income && (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                            <DollarSign className="h-3 w-3 mr-1" />
                            Recurring Income
                          </Badge>
                        )}
                        {rule.set_ignore_type && rule.set_ignore_type !== 'none' && (
                          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            <EyeOff className="h-3 w-3 mr-1" />
                            {rule.set_ignore_type === 'all' ? 'Ignore All' : 'Ignore Budget'}
                          </Badge>
                        )}
                      </div>

                      {/* Description */}
                      {rule.description && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {rule.description}
                        </p>
                      )}

                      {/* Created date */}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Created {new Date(rule.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => toggleRule(rule)}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setDeleteConfirm(rule)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Rule
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            How Rules Work
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Rules apply automatically</strong> to all matching transactions, including new ones that sync in the future.
          </p>
          <p>
            <strong>Disabling a rule</strong> stops it from applying to new transactions, but doesn&apos;t undo changes already made.
          </p>
          <p>
            <strong>Deleting a rule</strong> removes it completely. Previously affected transactions keep their changes.
          </p>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Rule?</DialogTitle>
            <DialogDescription>
              This will permanently delete this rule. Transactions that were already affected will keep their changes.
            </DialogDescription>
          </DialogHeader>

          {deleteConfirm && (
            <div className="py-4">
              <div className="rounded-lg border p-3 bg-muted/50">
                <p className="text-sm font-medium">
                  Match: &quot;{deleteConfirm.match_pattern}&quot;
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {getRuleActions(deleteConfirm).map((action, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {action}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteRule}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Rule
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
