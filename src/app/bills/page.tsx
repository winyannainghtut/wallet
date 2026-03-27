'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { addMonths, addWeeks, differenceInCalendarDays, endOfMonth, format, isBefore, isValid, parseISO, setDate, startOfToday } from 'date-fns'
import { CalendarClock, CreditCard, Repeat, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useApp } from '@/contexts/AppContext'
import { getCurrencyDisplayLabel } from '@/lib/settings'
import { LiabilityRecord, getLiabilityNextDueDate, getLiabilityTypeLabel, getMonthlyLiabilityPayment, mapLiabilityRecord } from '@/lib/liabilities'
import { getNextRecurringContributionDate, isValidDateOnly } from '@/lib/savings-assets'
import { t } from '@/i18n/config'
import type { BillingCycle, SavingsAsset, Subscription } from '@/types'

type ApiListResponse<T> = {
  items?: T[]
  error?: string
}

type BillItem = {
  id: string
  source: 'subscription' | 'liability' | 'insurance'
  name: string
  dueDate: string
  amount: number
  cadenceLabel: string
  detail: string
  isActive: boolean
}

type SavingsAssetApiRecord = {
  id?: string
  type?: string
  name?: string
  amount?: number
  recurringMonthlyAmount?: number | null
  recurringStartDate?: string | null
}

function formatDateLabel(dateText: string): string {
  const parsed = parseISO(dateText)
  return isValid(parsed) ? format(parsed, 'dd MMM yyyy') : dateText
}

function getSubscriptionMonthlyEquivalent(subscription: Subscription): number {
  switch (subscription.billingCycle) {
    case 'weekly':
      return subscription.amount * 4.33
    case 'yearly':
      return subscription.amount / 12
    default:
      return subscription.amount
  }
}

function getBillingCycleLabel(cycle: BillingCycle): string {
  switch (cycle) {
    case 'weekly':
      return t('common.weekly')
    case 'yearly':
      return t('common.yearly')
    default:
      return t('common.monthly')
  }
}

function getNextSubscriptionDueDate(subscription: Subscription, today = startOfToday()): string {
  const startDate = parseISO(subscription.startDate)
  if (!isValid(startDate)) {
    return format(today, 'yyyy-MM-dd')
  }

  if (subscription.billingCycle === 'weekly') {
    let cursor = startDate
    while (isBefore(cursor, today)) {
      cursor = addWeeks(cursor, 1)
    }
    return format(cursor, 'yyyy-MM-dd')
  }

  if (subscription.billingCycle === 'yearly') {
    let candidate = new Date(today.getFullYear(), startDate.getMonth(), 1)
    candidate = setDate(candidate, Math.min(startDate.getDate(), endOfMonth(candidate).getDate()))
    if (isBefore(candidate, today)) {
      candidate = new Date(today.getFullYear() + 1, startDate.getMonth(), 1)
      candidate = setDate(candidate, Math.min(startDate.getDate(), endOfMonth(candidate).getDate()))
    }
    return format(candidate, 'yyyy-MM-dd')
  }

  const targetDay = startDate.getDate()
  let candidate = setDate(today, Math.min(targetDay, endOfMonth(today).getDate()))
  if (isBefore(candidate, today)) {
    const nextMonth = addMonths(today, 1)
    candidate = setDate(nextMonth, Math.min(targetDay, endOfMonth(nextMonth).getDate()))
  }
  return format(candidate, 'yyyy-MM-dd')
}

function mapSavingsAssetRecord(record: SavingsAssetApiRecord): SavingsAsset | null {
  if (
    typeof record.id !== 'string' ||
    typeof record.type !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.amount !== 'number'
  ) {
    return null
  }

  return {
    id: record.id,
    type: record.type as SavingsAsset['type'],
    name: record.name,
    amount: record.amount,
    recurringMonthlyAmount:
      typeof record.recurringMonthlyAmount === 'number' ? record.recurringMonthlyAmount : undefined,
    recurringStartDate:
      typeof record.recurringStartDate === 'string' && isValidDateOnly(record.recurringStartDate)
        ? record.recurringStartDate
        : undefined,
    createdAt: '',
  }
}

function BillsSection({
  title,
  description,
  items,
  displayCurrency,
}: {
  title: string
  description: string
  items: BillItem[]
  displayCurrency: string
}) {
  return (
    <Card className="border-border/40">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('bills.nothingHere')}</p>
        ) : (
          items.map((item) => (
            <div key={`${item.source}-${item.id}`} className="rounded-xl border border-border/40 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{item.name}</p>
                    <Badge variant={item.source === 'liability' ? 'outline' : 'secondary'}>
                      {item.source === 'liability' ? t('bills.liability') : item.source === 'insurance' ? t('bills.insurance') : t('bills.subscription')}
                    </Badge>
                    {!item.isActive && <Badge variant="secondary">{t('common.inactive')}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('bills.dueOn', { date: formatDateLabel(item.dueDate), cadence: item.cadenceLabel })}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-lg font-semibold">{item.amount.toFixed(2)} {displayCurrency}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

export default function BillsPage() {
  const { subscriptions, settings } = useApp()
  const displayCurrency = getCurrencyDisplayLabel(settings)
  const today = startOfToday()
  const [liabilities, setLiabilities] = useState<LiabilityRecord[]>([])
  const [insuranceAssets, setInsuranceAssets] = useState<SavingsAsset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadBillsData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const [liabilitiesResponse, savingsAssetsResponse] = await Promise.all([
        fetch('/api/liabilities?perPage=500'),
        fetch('/api/savings-assets?perPage=500'),
      ])
      const liabilitiesData = await liabilitiesResponse.json() as ApiListResponse<Record<string, unknown>>
      const savingsAssetsData = await savingsAssetsResponse.json() as ApiListResponse<SavingsAssetApiRecord>
      if (!liabilitiesResponse.ok) {
        throw new Error(liabilitiesData.error || t('common.error'))
      }
      if (!savingsAssetsResponse.ok) {
        throw new Error(savingsAssetsData.error || t('common.error'))
      }

      const mappedLiabilities = (liabilitiesData.items ?? [])
        .map((item) => mapLiabilityRecord(item))
        .filter((item): item is LiabilityRecord => item !== null)
      const mappedInsuranceAssets = (savingsAssetsData.items ?? [])
        .map((item) => mapSavingsAssetRecord(item))
        .filter((item): item is SavingsAsset => item !== null)
        .filter((item) => item.type === 'insurance' && typeof item.recurringMonthlyAmount === 'number' && item.recurringMonthlyAmount > 0 && item.recurringStartDate)

      setLiabilities(mappedLiabilities.sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.dueDay - b.dueDay))
      setInsuranceAssets(mappedInsuranceAssets.sort((a, b) => a.name.localeCompare(b.name)))
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : t('common.error')
      setError(message)
      setLiabilities([])
      setInsuranceAssets([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBillsData()
  }, [loadBillsData])

  const billItems = useMemo(() => {
    const liabilityBills: BillItem[] = liabilities.map((liability) => ({
      id: liability.id,
      source: 'liability',
      name: liability.name,
      dueDate: getLiabilityNextDueDate(liability),
      amount: getMonthlyLiabilityPayment(liability),
      cadenceLabel: t('bills.cadence.monthlyDay', { day: liability.dueDay }),
      detail: `${getLiabilityTypeLabel(liability.type)} / ${t('bills.detail.minimum', { amount: liability.minimumPayment.toFixed(2) })} ${displayCurrency}${liability.extraPayment > 0 ? ` ${t('bills.detail.extra', { amount: liability.extraPayment.toFixed(2) })} ${displayCurrency}` : ''}`,
      isActive: liability.isActive,
    }))

    const subscriptionBills: BillItem[] = subscriptions.map((subscription) => ({
      id: subscription.id,
      source: 'subscription',
      name: subscription.name,
      dueDate: getNextSubscriptionDueDate(subscription),
      amount: subscription.amount,
      cadenceLabel: getBillingCycleLabel(subscription.billingCycle),
      detail: t('bills.detail.starts', { date: formatDateLabel(subscription.startDate) }),
      isActive: subscription.isActive,
    }))

    const insuranceBills: BillItem[] = insuranceAssets.map((asset) => ({
      id: asset.id,
      source: 'insurance',
      name: asset.name,
      dueDate: getNextRecurringContributionDate(asset.recurringStartDate) ?? format(today, 'yyyy-MM-dd'),
      amount: asset.recurringMonthlyAmount ?? 0,
      cadenceLabel: t('bills.cadence.monthlyInsurance'),
      detail: t('bills.detail.insurance', { date: formatDateLabel(asset.recurringStartDate ?? format(today, 'yyyy-MM-dd')) }),
      isActive: true,
    }))

    return [...liabilityBills, ...subscriptionBills, ...insuranceBills].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.amount - b.amount)
  }, [displayCurrency, insuranceAssets, liabilities, subscriptions, today])

  const activeBills = useMemo(() => billItems.filter((item) => item.isActive), [billItems])
  const inactiveBills = useMemo(() => billItems.filter((item) => !item.isActive), [billItems])

  const dueThisWeek = useMemo(
    () => activeBills.filter((item) => {
      const dueDate = parseISO(item.dueDate)
      if (!isValid(dueDate)) {
        return false
      }
      const diff = differenceInCalendarDays(dueDate, today)
      return diff >= 0 && diff <= 7
    }),
    [activeBills, today]
  )

  const laterThisMonth = useMemo(
    () => activeBills.filter((item) => {
      const dueDate = parseISO(item.dueDate)
      if (!isValid(dueDate)) {
        return false
      }
      const diff = differenceInCalendarDays(dueDate, today)
      return diff > 7 && dueDate.getMonth() === today.getMonth() && dueDate.getFullYear() === today.getFullYear()
    }),
    [activeBills, today]
  )

  const beyondThisMonth = useMemo(
    () => activeBills.filter((item) => {
      const dueDate = parseISO(item.dueDate)
      return isValid(dueDate) && (dueDate.getMonth() !== today.getMonth() || dueDate.getFullYear() !== today.getFullYear())
    }),
    [activeBills, today]
  )

  const summary = useMemo(() => {
    const dueNext30Days = activeBills
      .filter((item) => {
        const dueDate = parseISO(item.dueDate)
        if (!isValid(dueDate)) {
          return false
        }
        const diff = differenceInCalendarDays(dueDate, today)
        return diff >= 0 && diff <= 30
      })
      .reduce((sum, item) => sum + item.amount, 0)

    const monthlySubscriptions = subscriptions
      .filter((subscription) => subscription.isActive)
      .reduce((sum, subscription) => sum + getSubscriptionMonthlyEquivalent(subscription), 0)

    const monthlyLiabilities = liabilities
      .filter((liability) => liability.isActive)
      .reduce((sum, liability) => sum + getMonthlyLiabilityPayment(liability), 0)

    return {
      dueNext30Days,
      monthlyCommitted: monthlySubscriptions + monthlyLiabilities + insuranceAssets.reduce((sum, asset) => sum + (asset.recurringMonthlyAmount ?? 0), 0),
      activeCount: activeBills.length,
      nextDueDate: activeBills[0]?.dueDate ?? null,
    }
  }, [activeBills, insuranceAssets, liabilities, subscriptions, today])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('bills.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('bills.subtitle')}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{`${t('bills.dueNext30Days')} (${displayCurrency})`}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.dueNext30Days.toFixed(2)}</CardContent>
        </Card>
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{`${t('bills.monthlyCommitments')} (${displayCurrency})`}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.monthlyCommitted.toFixed(2)}</CardContent>
        </Card>
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t('bills.activeBills')}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{summary.activeCount}</CardContent>
        </Card>
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t('bills.nextDue')}</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-bold">
            {summary.nextDueDate ? formatDateLabel(summary.nextDueDate) : '-'}
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card className="border-border/40">
          <CardContent className="py-10 text-sm text-muted-foreground">{t('common.loading')}...</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          <BillsSection
            title={t('bills.dueThisWeek')}
            description={t('bills.dueThisWeekDesc')}
            items={dueThisWeek}
            displayCurrency={displayCurrency}
          />
          <BillsSection
            title={t('bills.laterThisMonth')}
            description={t('bills.laterThisMonthDesc')}
            items={laterThisMonth}
            displayCurrency={displayCurrency}
          />
          <BillsSection
            title={t('bills.beyondThisMonth')}
            description={t('bills.beyondThisMonthDesc')}
            items={beyondThisMonth}
            displayCurrency={displayCurrency}
          />
        </div>
      )}

      {!isLoading && activeBills.length === 0 && (
        <Card className="border-dashed border-border/50">
          <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CalendarClock className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-semibold">{t('bills.noActiveBills')}</h2>
              <p className="text-sm text-muted-foreground">
                {t('bills.noActiveBillsDesc')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && inactiveBills.length > 0 && (
        <div className="grid gap-4">
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-primary" />
                {t('bills.pausedOrInactive')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {inactiveBills.map((item) => (
                <div key={`${item.source}-${item.id}`} className="flex flex-col gap-2 rounded-xl border border-border/40 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{item.name}</p>
                      <Badge variant="secondary">{item.source === 'liability' ? t('bills.liability') : t('bills.subscription')}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.detail}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-lg font-semibold">{item.amount.toFixed(2)} {displayCurrency}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('bills.dueOn', { date: formatDateLabel(item.dueDate), cadence: item.cadenceLabel })}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {!isLoading && (subscriptions.length > 0 || liabilities.length > 0 || insuranceAssets.length > 0) && (
        <Card className="border-border/40">
          <CardContent className="flex flex-col gap-3 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              {t('bills.liabilityHint')}
            </div>
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              {t('bills.subscriptionHint')}
            </div>
            <div className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-primary" />
              {t('bills.insuranceHint')}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

