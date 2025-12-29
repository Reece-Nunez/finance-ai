'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PlaidLinkButton } from '@/components/plaid/plaid-link-button'
import { Building2, CreditCard, Wallet, PiggyBank, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Account {
  id: string
  name: string
  official_name: string | null
  type: string
  subtype: string | null
  mask: string | null
  current_balance: number | null
  available_balance: number | null
  plaid_item_id: string
}

interface PlaidItem {
  id: string
  item_id: string
  institution_name: string
  status: string
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

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [plaidItems, setPlaidItems] = useState<PlaidItem[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
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

  const handleSync = async (itemId: string) => {
    setSyncing(true)
    try {
      await fetch('/api/plaid/sync-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId }),
      })
      await fetchData()
    } finally {
      setSyncing(false)
    }
  }

  const totalBalance = accounts.reduce((sum, acc) => {
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
      <Card className="border-none bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
        <CardHeader>
          <CardDescription className="text-emerald-100">Total Net Balance</CardDescription>
          <CardTitle className="text-4xl font-bold">{formatCurrency(totalBalance)}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-emerald-100">
            Across {accounts.length} account{accounts.length !== 1 ? 's' : ''} at{' '}
            {plaidItems.length} institution{plaidItems.length !== 1 ? 's' : ''}
          </p>
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
          const itemAccounts = accounts.filter((a) => a.plaid_item_id === item.item_id)
          return (
            <Card key={item.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200">
                    <Building2 className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{item.institution_name}</CardTitle>
                    <CardDescription>{itemAccounts.length} accounts</CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSync(item.item_id)}
                  disabled={syncing}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                  Sync
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {itemAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-600">
                          {getAccountIcon(account.type)}
                        </div>
                        <div>
                          <p className="font-medium">{account.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {account.subtype} {account.mask && `•••• ${account.mask}`}
                          </p>
                        </div>
                      </div>
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
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
