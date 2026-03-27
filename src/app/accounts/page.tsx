'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, PlusCircle, Trash2, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useApp } from '@/contexts/AppContext'
import { getCurrencyDisplayLabel } from '@/lib/settings'
import { AccountRecord, AccountType, getAccountTypeLabel, mapAccountRecord } from '@/lib/accounts'

type ApiListResponse<T> = {
  items?: T[]
  error?: string
}

const accountTypes: AccountType[] = ['cash', 'bank', 'credit_card', 'ewallet', 'investment', 'other']

type AccountFormState = {
  name: string
  type: AccountType
  institution: string
  currency: string
  balance: string
  note: string
  isActive: boolean
}

const emptyForm: AccountFormState = {
  name: '',
  type: 'bank',
  institution: '',
  currency: 'SGD',
  balance: '',
  note: '',
  isActive: true,
}

function getAccountIcon(type: AccountType) {
  void type
  return Wallet
}

export default function AccountsPage() {
  const { settings } = useApp()
  const displayCurrency = getCurrencyDisplayLabel(settings)
  const [accounts, setAccounts] = useState<AccountRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<AccountRecord | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState<AccountFormState>({ ...emptyForm, currency: settings.currency })

  const loadAccounts = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/accounts?perPage=500')
      const data = await response.json() as ApiListResponse<Record<string, unknown>>
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load accounts')
      }

      const mappedAccounts = (data.items ?? [])
        .map((item) => mapAccountRecord(item))
        .filter((item): item is AccountRecord => item !== null)

      setAccounts(mappedAccounts.sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.balance - a.balance))
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load accounts'
      setError(message)
      setAccounts([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  const summary = useMemo(() => {
    const activeAccounts = accounts.filter((account) => account.isActive)
    const appCurrencyBalance = activeAccounts
      .filter((account) => account.currency === settings.currency)
      .reduce((sum, account) => sum + account.balance, 0)
    const foreignCount = activeAccounts.filter((account) => account.currency !== settings.currency).length

    return {
      total: accounts.length,
      active: activeAccounts.length,
      appCurrencyBalance,
      foreignCount,
    }
  }, [accounts, settings.currency])

  const resetForm = useCallback(() => {
    setEditingAccount(null)
    setForm({ ...emptyForm, currency: settings.currency })
  }, [settings.currency])

  const openCreate = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const openEdit = (account: AccountRecord) => {
    setEditingAccount(account)
    setForm({
      name: account.name,
      type: account.type,
      institution: account.institution ?? '',
      currency: account.currency,
      balance: account.balance.toString(),
      note: account.note ?? '',
      isActive: account.isActive,
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.currency.trim() || !form.balance.trim()) {
      return
    }

    try {
      setIsSaving(true)
      const payload = {
        name: form.name.trim(),
        type: form.type,
        institution: form.institution.trim(),
        currency: form.currency.trim().toUpperCase(),
        balance: Number(form.balance),
        note: form.note.trim(),
        isActive: form.isActive,
      }

      const response = await fetch(editingAccount ? `/api/accounts/${editingAccount.id}` : '/api/accounts', {
        method: editingAccount ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save account')
      }

      await loadAccounts()
      setIsDialogOpen(false)
      resetForm()
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : 'Failed to save account')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (account: AccountRecord) => {
    if (!confirm(`Delete ${account.name}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/accounts/${account.id}`, { method: 'DELETE' })
      const data = await response.json() as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete account')
      }
      await loadAccounts()
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : 'Failed to delete account')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Track manual balances across bank accounts, wallets, and investments.
          </p>
        </div>
        <Button onClick={openCreate} className="rounded-xl">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Accounts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.total}</CardContent>
        </Card>
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active Accounts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.active}</CardContent>
        </Card>
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{`Balance (${displayCurrency})`}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.appCurrencyBalance.toFixed(2)}</CardContent>
        </Card>
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Foreign Currency Accounts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.foreignCount}</CardContent>
        </Card>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {isLoading ? (
          <Card className="border-border/40">
            <CardContent className="py-10 text-sm text-muted-foreground">Loading accounts...</CardContent>
          </Card>
        ) : accounts.length === 0 ? (
          <Card className="border-dashed border-border/50 lg:col-span-2">
            <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-semibold">No accounts yet</h2>
                <p className="text-sm text-muted-foreground">
                  Add your manual bank, wallet, or investment balances.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          accounts.map((account) => {
            const Icon = getAccountIcon(account.type)

            return (
              <Card key={account.id} className="border-border/40">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold">{account.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {getAccountTypeLabel(account.type)}
                      {account.institution ? ` · ${account.institution}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(account)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => void handleDelete(account)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/40 bg-muted/15 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Balance</p>
                      <p className="mt-1 text-xl font-semibold">
                        {account.balance.toFixed(2)} {account.currency}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-muted/15 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                      <p className="mt-1 text-xl font-semibold">{account.isActive ? 'Active' : 'Inactive'}</p>
                    </div>
                  </div>

                  {account.note && (
                    <p className="text-sm text-muted-foreground">{account.note}</p>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Edit Account' : 'Add Account'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="account-name">Name</Label>
              <Input id="account-name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(value) => setForm((prev) => ({ ...prev, type: value as AccountType }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accountTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {getAccountTypeLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-institution">Institution</Label>
                <Input id="account-institution" value={form.institution} onChange={(event) => setForm((prev) => ({ ...prev, institution: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="account-currency">Currency</Label>
                <Input id="account-currency" maxLength={3} value={form.currency} onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-balance">Balance</Label>
                <Input id="account-balance" type="number" step="0.01" value={form.balance} onChange={(event) => setForm((prev) => ({ ...prev, balance: event.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-note">Note</Label>
              <Textarea id="account-note" rows={3} value={form.note} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
              <div>
                <p className="text-sm font-medium">Active account</p>
                <p className="text-xs text-muted-foreground">Inactive accounts stay visible but are excluded from active totals.</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

