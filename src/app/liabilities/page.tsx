'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, CreditCard, Pencil, PlusCircle, Trash2, Wallet } from 'lucide-react'
import { format, isValid, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useApp } from '@/contexts/AppContext'
import { t } from '@/i18n/config'
import { getCurrencyDisplayLabel } from '@/lib/settings'
import { AccountRecord, mapAccountRecord } from '@/lib/accounts'
import {
  LiabilityRecord,
  LiabilityType,
  calculateDebtProjection,
  getLiabilityNextDueDate,
  getLiabilityTypeLabel,
  getMonthlyLiabilityPayment,
  mapLiabilityRecord,
} from '@/lib/liabilities'

type ApiListResponse<T> = {
  items?: T[]
  error?: string
}

type LiabilityFormState = {
  name: string
  type: LiabilityType
  accountId: string
  balance: string
  interestRate: string
  minimumPayment: string
  dueDay: string
  extraPayment: string
  startDate: string
  targetPayoffDate: string
  note: string
  isActive: boolean
}

const liabilityTypes: LiabilityType[] = ['credit_card', 'personal_loan', 'mortgage', 'bnpl', 'other']

const emptyForm: LiabilityFormState = {
  name: '',
  type: 'credit_card',
  accountId: '',
  balance: '',
  interestRate: '0',
  minimumPayment: '',
  dueDay: format(new Date(), 'd'),
  extraPayment: '0',
  startDate: format(new Date(), 'yyyy-MM-dd'),
  targetPayoffDate: '',
  note: '',
  isActive: true,
}

function formatDateLabel(dateText: string | undefined): string {
  if (!dateText) {
    return '-'
  }

  const parsed = parseISO(dateText)
  return isValid(parsed) ? format(parsed, 'dd MMM yyyy') : dateText
}

export default function LiabilitiesPage() {
  const { settings } = useApp()
  const displayCurrency = getCurrencyDisplayLabel(settings)
  const [liabilities, setLiabilities] = useState<LiabilityRecord[]>([])
  const [accounts, setAccounts] = useState<AccountRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingLiability, setEditingLiability] = useState<LiabilityRecord | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [simulatorExtra, setSimulatorExtra] = useState('0')
  const [selectedLiabilityId, setSelectedLiabilityId] = useState('')
  const [form, setForm] = useState<LiabilityFormState>({ ...emptyForm })

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [liabilitiesResponse, accountsResponse] = await Promise.all([
        fetch('/api/liabilities?perPage=500'),
        fetch('/api/accounts?perPage=500'),
      ])

      const liabilityData = await liabilitiesResponse.json() as ApiListResponse<Record<string, unknown>>
      const accountData = await accountsResponse.json() as ApiListResponse<Record<string, unknown>>

      if (!liabilitiesResponse.ok) {
        throw new Error(liabilityData.error || t('common.error'))
      }
      if (!accountsResponse.ok) {
        throw new Error(accountData.error || t('common.error'))
      }

      const mappedLiabilities = (liabilityData.items ?? [])
        .map((item) => mapLiabilityRecord(item))
        .filter((item): item is LiabilityRecord => item !== null)

      const mappedAccounts = (accountData.items ?? [])
        .map((item) => mapAccountRecord(item))
        .filter((item): item is AccountRecord => item !== null)

      setLiabilities(
        mappedLiabilities.sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.balance - a.balance)
      )
      setAccounts(mappedAccounts.sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)))
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : t('common.error')
      setError(message)
      setLiabilities([])
      setAccounts([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const activeLiabilities = useMemo(
    () => liabilities.filter((liability) => liability.isActive),
    [liabilities]
  )

  useEffect(() => {
    if (activeLiabilities.length === 0) {
      setSelectedLiabilityId('')
      return
    }

    if (!selectedLiabilityId || !activeLiabilities.some((liability) => liability.id === selectedLiabilityId)) {
      setSelectedLiabilityId(activeLiabilities[0].id)
    }
  }, [activeLiabilities, selectedLiabilityId])

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts]
  )

  const summary = useMemo(() => {
    const totalOutstanding = activeLiabilities.reduce((sum, liability) => sum + liability.balance, 0)
    const monthlyCommitment = activeLiabilities.reduce((sum, liability) => sum + getMonthlyLiabilityPayment(liability), 0)
    const highestApr = activeLiabilities.reduce((max, liability) => Math.max(max, liability.interestRate), 0)

    return {
      totalOutstanding,
      monthlyCommitment,
      highestApr,
      activeCount: activeLiabilities.length,
    }
  }, [activeLiabilities])

  const selectedLiability = useMemo(
    () => activeLiabilities.find((liability) => liability.id === selectedLiabilityId) ?? null,
    [activeLiabilities, selectedLiabilityId]
  )

  const baselineProjection = useMemo(
    () => (selectedLiability ? calculateDebtProjection(selectedLiability) : null),
    [selectedLiability]
  )

  const scenarioProjection = useMemo(() => {
    if (!selectedLiability) {
      return null
    }

    const simulatedExtra = Number.parseFloat(simulatorExtra)
    return calculateDebtProjection({
      ...selectedLiability,
      extraPayment: selectedLiability.extraPayment + (Number.isFinite(simulatedExtra) && simulatedExtra > 0 ? simulatedExtra : 0),
    })
  }, [selectedLiability, simulatorExtra])

  const monthsSaved = useMemo(() => {
    if (!baselineProjection || !scenarioProjection) {
      return null
    }

    if (baselineProjection.months === null || scenarioProjection.months === null) {
      return null
    }

    return Math.max(0, baselineProjection.months - scenarioProjection.months)
  }, [baselineProjection, scenarioProjection])

  const resetForm = useCallback(() => {
    setEditingLiability(null)
    setForm({ ...emptyForm, dueDay: format(new Date(), 'd'), startDate: format(new Date(), 'yyyy-MM-dd') })
  }, [])

  const openCreate = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const openEdit = (liability: LiabilityRecord) => {
    setEditingLiability(liability)
    setForm({
      name: liability.name,
      type: liability.type,
      accountId: liability.accountId ?? '',
      balance: liability.balance.toString(),
      interestRate: liability.interestRate.toString(),
      minimumPayment: liability.minimumPayment.toString(),
      dueDay: liability.dueDay.toString(),
      extraPayment: liability.extraPayment.toString(),
      startDate: liability.startDate,
      targetPayoffDate: liability.targetPayoffDate ?? '',
      note: liability.note ?? '',
      isActive: liability.isActive,
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.balance.trim() || !form.minimumPayment.trim() || !form.dueDay.trim() || !form.startDate) {
      return
    }

    try {
      setIsSaving(true)
      const payload = {
        name: form.name.trim(),
        type: form.type,
        accountId: form.accountId,
        balance: Number(form.balance),
        interestRate: form.interestRate.trim() ? Number(form.interestRate) : 0,
        minimumPayment: Number(form.minimumPayment),
        dueDay: Number(form.dueDay),
        extraPayment: form.extraPayment.trim() ? Number(form.extraPayment) : 0,
        startDate: form.startDate,
        targetPayoffDate: form.targetPayoffDate,
        note: form.note.trim(),
        isActive: form.isActive,
      }

      const response = await fetch(editingLiability ? `/api/liabilities/${editingLiability.id}` : '/api/liabilities', {
        method: editingLiability ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || t('common.error'))
      }

      await loadData()
      setIsDialogOpen(false)
      resetForm()
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : t('common.error'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (liability: LiabilityRecord) => {
    if (!confirm(t('liabilities.deleteConfirm', { name: liability.name }))) {
      return
    }

    try {
      const response = await fetch(`/api/liabilities/${liability.id}`, { method: 'DELETE' })
      const data = await response.json() as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || t('common.error'))
      }
      await loadData()
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : t('common.error'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('liabilities.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('liabilities.subtitle')}
          </p>
        </div>
        <Button onClick={openCreate} className="rounded-xl">
          <PlusCircle className="mr-2 h-4 w-4" />
          {t('liabilities.addLiability')}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{`${t('liabilities.outstanding')} (${displayCurrency})`}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.totalOutstanding.toFixed(2)}</CardContent>
        </Card>
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{`${t('liabilities.monthlyPayment')} (${displayCurrency})`}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.monthlyCommitment.toFixed(2)}</CardContent>
        </Card>
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t('liabilities.highestApr')}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.highestApr.toFixed(2)}%</CardContent>
        </Card>
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t('liabilities.activeDebts')}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.activeCount}</CardContent>
        </Card>
      </div>

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            {t('liabilities.simulatorTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedLiability ? (
            <>
              <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
                <div className="space-y-2">
                  <Label>{t('liabilities.activeLiability')}</Label>
                  <Select value={selectedLiabilityId || null} onValueChange={(value) => setSelectedLiabilityId(value ?? '')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {activeLiabilities.map((liability) => (
                        <SelectItem key={liability.id} value={liability.id}>
                          {liability.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{`${t('liabilities.extraMonthlyPayment')} (${displayCurrency})`}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={simulatorExtra}
                    onChange={(event) => setSimulatorExtra(event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-border/40 bg-muted/15 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('liabilities.currentPlan')}</p>
                  <p className="mt-1 font-semibold">
                    {baselineProjection?.isNegativeAmortization
                      ? t('liabilities.paymentTooLow')
                      : `${baselineProjection?.months ?? '-'} months`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('liabilities.projectedPayoff')}: {formatDateLabel(baselineProjection?.payoffDate)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/40 bg-muted/15 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('liabilities.withExtraPayment')}</p>
                  <p className="mt-1 font-semibold">
                    {scenarioProjection?.isNegativeAmortization
                      ? t('liabilities.paymentTooLow')
                      : `${scenarioProjection?.months ?? '-'} months`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('liabilities.projectedPayoff')}: {formatDateLabel(scenarioProjection?.payoffDate)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/40 bg-muted/15 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('liabilities.potentialSavings')}</p>
                  <p className="mt-1 font-semibold">
                    {monthsSaved !== null ? t('liabilities.monthsFaster', { months: monthsSaved }) : '-'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('liabilities.interestAvoided')}:{' '}
                    {baselineProjection && scenarioProjection && !baselineProjection.isNegativeAmortization && !scenarioProjection.isNegativeAmortization
                      ? `${Math.max(0, baselineProjection.totalInterest - scenarioProjection.totalInterest).toFixed(2)} ${displayCurrency}`
                      : '-'}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('liabilities.noActiveLiabilityHint')}</p>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {isLoading ? (
          <Card className="border-border/40 xl:col-span-2">
            <CardContent className="py-10 text-sm text-muted-foreground">{t('common.loading')}...</CardContent>
          </Card>
        ) : liabilities.length === 0 ? (
          <Card className="border-dashed border-border/50 xl:col-span-2">
            <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-semibold">{t('liabilities.noLiabilitiesTitle')}</h2>
                <p className="text-sm text-muted-foreground">
                  {t('liabilities.noLiabilitiesDesc')}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          liabilities.map((liability) => {
            const projection = calculateDebtProjection(liability)
            const linkedAccount = liability.accountId ? accountsById.get(liability.accountId) : null

            return (
              <Card key={liability.id} className="border-border/40">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold">{liability.name}</p>
                        <Badge variant={liability.isActive ? 'default' : 'secondary'}>
                          {liability.isActive ? t('common.active') : t('common.inactive')}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{t(getLiabilityTypeLabel(liability.type))}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(liability)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => void handleDelete(liability)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-border/40 bg-muted/15 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('common.balance')}</p>
                      <p className="mt-1 text-xl font-semibold">{liability.balance.toFixed(2)} {displayCurrency}</p>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-muted/15 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('liabilities.monthlyPayment')}</p>
                      <p className="mt-1 text-xl font-semibold">{getMonthlyLiabilityPayment(liability).toFixed(2)} {displayCurrency}</p>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-muted/15 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">APR</p>
                      <p className="mt-1 text-xl font-semibold">{liability.interestRate.toFixed(2)}%</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/40 p-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Calendar className="h-4 w-4 text-primary" />
                        {t('liabilities.nextDue')}: {formatDateLabel(getLiabilityNextDueDate(liability))}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('liabilities.dueDay')} {liability.dueDay}
                        {linkedAccount ? ` / ${t('liabilities.paidFrom')} ${linkedAccount.name}` : ''}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/40 p-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Wallet className="h-4 w-4 text-primary" />
                        {projection.isNegativeAmortization ? t('liabilities.paymentTooLow') : `${t('liabilities.projectedPayoff')} ${formatDateLabel(projection.payoffDate)}`}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {projection.isNegativeAmortization
                          ? t('liabilities.noActiveLiabilityHint')
                          : `${projection.months ?? 0} months / ${projection.totalInterest.toFixed(2)} ${displayCurrency} interest`}
                      </p>
                    </div>
                  </div>

                  {liability.targetPayoffDate && (
                    <p className="text-sm text-muted-foreground">
                      {t('liabilities.targetPayoff')}: {formatDateLabel(liability.targetPayoffDate)}
                    </p>
                  )}

                  {liability.note && <p className="text-sm text-muted-foreground">{liability.note}</p>}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{editingLiability ? t('liabilities.editLiability') : t('liabilities.addLiability')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="liability-name">{t('common.name')}</Label>
              <Input id="liability-name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('common.type')}</Label>
                <Select value={form.type} onValueChange={(value) => setForm((prev) => ({ ...prev, type: value as LiabilityType }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {liabilityTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(getLiabilityTypeLabel(type))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('liabilities.paidFrom')}</Label>
                <Select
                  value={form.accountId || 'unlinked'}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, accountId: !value || value === 'unlinked' ? '' : value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unlinked">No linked account</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="liability-balance">{t('common.balance')}</Label>
                <Input id="liability-balance" type="number" step="0.01" value={form.balance} onChange={(event) => setForm((prev) => ({ ...prev, balance: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="liability-interest">Interest Rate %</Label>
                <Input id="liability-interest" type="number" step="0.01" min="0" value={form.interestRate} onChange={(event) => setForm((prev) => ({ ...prev, interestRate: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="liability-minimum">{t('liabilities.monthlyPayment')}</Label>
                <Input id="liability-minimum" type="number" step="0.01" min="0" value={form.minimumPayment} onChange={(event) => setForm((prev) => ({ ...prev, minimumPayment: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="liability-extra">{t('liabilities.extraMonthlyPayment')}</Label>
                <Input id="liability-extra" type="number" step="0.01" min="0" value={form.extraPayment} onChange={(event) => setForm((prev) => ({ ...prev, extraPayment: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="liability-due-day">{t('liabilities.dueDay')}</Label>
                <Input id="liability-due-day" type="number" min="1" max="31" value={form.dueDay} onChange={(event) => setForm((prev) => ({ ...prev, dueDay: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="liability-start-date">{t('common.date')}</Label>
                <Input id="liability-start-date" type="date" value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="liability-target-date">{t('liabilities.targetPayoff')}</Label>
                <Input id="liability-target-date" type="date" value={form.targetPayoffDate} onChange={(event) => setForm((prev) => ({ ...prev, targetPayoffDate: event.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="liability-note">{t('common.note')}</Label>
              <Textarea id="liability-note" rows={3} value={form.note} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
              <div>
                <p className="text-sm font-medium">{t('liabilities.activeLiability')}</p>
                <p className="text-xs text-muted-foreground">{t('liabilities.activeLiabilityDesc')}</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? `${t('common.save')}...` : t('liabilities.saveLiability')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
