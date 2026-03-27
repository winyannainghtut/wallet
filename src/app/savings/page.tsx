'use client'

import { type ComponentType, useEffect, useMemo, useState } from 'react'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import { ArrowDownRight, ArrowUpRight, Coins, Edit2, PiggyBank, PlusCircle, Repeat, Shield, Target, Trash2, TrendingUp, Wallet, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useApp } from '@/contexts/AppContext'
import { useFundGoals } from '@/hooks/useFundGoals'
import { getCryptoAssetSymbol, getStockAssetSymbol, normalizeAssetSymbol, useSavingsAssetsPortfolio } from '@/hooks/useSavingsAssetsPortfolio'
import { t } from '@/i18n/config'
import { FundGoal, SavingsAsset, SavingsAssetType, SavingsGoal } from '@/types'
import { getCurrencyDisplayLabel } from '@/lib/settings'

type SavingsGoalApiRecord = {
  id?: string
  month?: string
  targetAmount?: number
  note?: string
  created?: string
  updated?: string
  createdAt?: string
  updatedAt?: string
}

type SavingsGoalsApiResponse = {
  items?: SavingsGoalApiRecord[]
  error?: string
}

type GoalFormState = {
  month: string
  targetAmount: string
  note: string
}

type AssetFormState = {
  type: SavingsAssetType
  name: string
  amount: string
  symbol: string
  recurringMonthlyAmount: string
  recurringStartDate: string
  note: string
}

type FundGoalFormState = {
  name: string
  targetAmount: string
  targetDate: string
  monthlyContribution: string
  includeMonthlySavings: boolean
  linkedTripId: string
  linkedAssetIds: string[]
  note: string
  status: FundGoal['status']
  color: string
}

function normalizeDateKey(rawDate: string): string {
  const datePartMatch = rawDate.match(/^(\d{4}-\d{2}-\d{2})/)
  if (datePartMatch?.[1]) return datePartMatch[1]

  const parsed = new Date(rawDate)
  if (!Number.isNaN(parsed.getTime())) {
    return format(parsed, 'yyyy-MM-dd')
  }

  return rawDate
}

function normalizeGoalRecord(raw: SavingsGoalApiRecord): SavingsGoal | null {
  if (!raw.id || !raw.month || typeof raw.targetAmount !== 'number') {
    return null
  }

  return {
    id: raw.id,
    month: raw.month,
    targetAmount: raw.targetAmount,
    note: raw.note,
    createdAt: raw.createdAt ?? raw.created ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? raw.updated,
  }
}

function formatGoalMonth(month: string): string {
  const parsed = new Date(`${month}-01T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return month
  }
  return format(parsed, 'MMM yyyy')
}

const ASSET_TYPE_META: Record<SavingsAssetType, { label: string; icon: ComponentType<{ className?: string }> }> = {
  insurance: { label: 'Insurance', icon: Shield },
  crypto: { label: 'Crypto', icon: Coins },
  stocks: { label: 'Stocks', icon: TrendingUp },
  personal_funds: { label: 'Personal Saving Funds', icon: Wallet },
}

function formatFundGoalStatus(status: FundGoal['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function getFundGoalBadgeVariant(status: FundGoal['status']): 'default' | 'secondary' | 'outline' {
  if (status === 'completed') return 'default'
  if (status === 'archived') return 'outline'
  return 'secondary'
}

export default function SavingsPage() {
  const { incomes, monthlySummary, subscriptions, settings, trips } = useApp()
  const displayCurrency = getCurrencyDisplayLabel(settings)
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [isGoalsLoading, setIsGoalsLoading] = useState(true)
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false)
  const [isGoalSaving, setIsGoalSaving] = useState(false)
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null)
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null)
  const [goalForm, setGoalForm] = useState<GoalFormState>({
    month: format(new Date(), 'yyyy-MM'),
    targetAmount: '',
    note: '',
  })
  const [isAssetDialogOpen, setIsAssetDialogOpen] = useState(false)
  const [isAssetSaving, setIsAssetSaving] = useState(false)
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null)
  const [editingAsset, setEditingAsset] = useState<SavingsAsset | null>(null)
  const [assetForm, setAssetForm] = useState<AssetFormState>({
    type: 'insurance',
    name: '',
    amount: '',
    symbol: '',
    recurringMonthlyAmount: '',
    recurringStartDate: format(new Date(), 'yyyy-MM-dd'),
    note: '',
  })
  const [isRecurringInsuranceEnabled, setIsRecurringInsuranceEnabled] = useState(false)
  const [isFundGoalDialogOpen, setIsFundGoalDialogOpen] = useState(false)
  const [isFundGoalSaving, setIsFundGoalSaving] = useState(false)
  const [deletingFundGoalId, setDeletingFundGoalId] = useState<string | null>(null)
  const [editingFundGoal, setEditingFundGoal] = useState<FundGoal | null>(null)
  const [fundGoalForm, setFundGoalForm] = useState<FundGoalFormState>({
    name: '',
    targetAmount: '',
    targetDate: '',
    monthlyContribution: '',
    includeMonthlySavings: true,
    linkedTripId: '',
    linkedAssetIds: [],
    note: '',
    status: 'active',
    color: '#6366f1',
  })
  const {
    isAssetsLoading,
    assetsError,
    refreshAssets,
    sortedPortfolioAssets,
    totalAssetValue,
    insuranceValue,
    cryptoValue,
    stocksValue,
    personalFundsValue,
    trackedCryptoProducts,
    cryptoSocketState,
    cryptoSocketError,
    trackedStockSymbols,
    stockSocketState,
    stockSocketError,
    usdToCurrencyRate,
    fxError,
  } = useSavingsAssetsPortfolio(settings.currency)

  const monthStart = startOfMonth(new Date())
  const monthEnd = endOfMonth(new Date())
  const monthStartKey = format(monthStart, 'yyyy-MM-dd')
  const monthEndKey = format(monthEnd, 'yyyy-MM-dd')
  const thisMonthKey = format(new Date(), 'yyyy-MM')

  const monthlyIncome = incomes.reduce((sum, income) => {
    const key = normalizeDateKey(income.date)
    if (key < monthStartKey || key > monthEndKey) {
      return sum
    }
    return sum + income.amount
  }, 0)

  const monthlyExpense = monthlySummary.total
  const monthlySavings = monthlyIncome - monthlyExpense
  const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0
  const {
    enrichedGoals: enrichedFundGoals,
    isLoading: isFundGoalsLoading,
    error: fundGoalsError,
    refreshGoals: refreshFundGoals,
  } = useFundGoals(sortedPortfolioAssets, trips, monthlySavings)

  const monthlySubscriptionCost = subscriptions
    .filter((item) => item.isActive)
    .reduce((sum, item) => {
      if (item.billingCycle === 'monthly') return sum + item.amount
      if (item.billingCycle === 'yearly') return sum + item.amount / 12
      if (item.billingCycle === 'weekly') return sum + item.amount * 4.33
      return sum
    }, 0)

  const sortedGoals = useMemo(
    () => [...goals].sort((a, b) => b.month.localeCompare(a.month)),
    [goals]
  )
  const currentGoal = useMemo(
    () => goals.find((goal) => goal.month === thisMonthKey) ?? null,
    [goals, thisMonthKey]
  )

  const positiveMonthlySavings = Math.max(monthlySavings, 0)
  const goalTarget = currentGoal?.targetAmount ?? 0
  const progressRatio = goalTarget > 0 ? positiveMonthlySavings / goalTarget : 0
  const progressPercentage = goalTarget > 0 ? Math.min(100, Math.max(progressRatio * 100, 0)) : 0
  const remainingAmount = currentGoal ? Math.max(currentGoal.targetAmount - positiveMonthlySavings, 0) : 0
  const exceededAmount = currentGoal ? Math.max(positiveMonthlySavings - currentGoal.targetAmount, 0) : 0
  const goalReached = Boolean(currentGoal && positiveMonthlySavings >= currentGoal.targetAmount)
  const activeFundGoals = useMemo(
    () => enrichedFundGoals
      .filter((goal) => goal.status === 'active')
      .sort((a, b) => {
        if (a.targetDate && b.targetDate) return a.targetDate.localeCompare(b.targetDate)
        if (a.targetDate) return -1
        if (b.targetDate) return 1
        return b.progressPercentage - a.progressPercentage
      }),
    [enrichedFundGoals]
  )
  const sortedFundGoals = useMemo(
    () => [...enrichedFundGoals].sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === 'active') return -1
        if (b.status === 'active') return 1
        if (a.status === 'completed') return -1
        if (b.status === 'completed') return 1
      }
      if (a.targetDate && b.targetDate) return a.targetDate.localeCompare(b.targetDate)
      if (a.targetDate) return -1
      if (b.targetDate) return 1
      return b.progressPercentage - a.progressPercentage
    }),
    [enrichedFundGoals]
  )
  const fundGoalCurrentAmount = activeFundGoals.reduce((sum, goal) => sum + goal.currentAmount, 0)
  const fundGoalTargetAmount = activeFundGoals.reduce((sum, goal) => sum + goal.targetAmount, 0)
  const fundGoalProjectedMonthly = activeFundGoals.reduce((sum, goal) => sum + goal.projectedMonthlyContribution, 0)
  const fundGoalsOnTrack = activeFundGoals.filter((goal) => goal.isOnTrack !== false).length

  const openCreateGoalDialog = () => {
    setEditingGoal(null)
    setGoalForm({
      month: thisMonthKey,
      targetAmount: '',
      note: '',
    })
    setIsGoalDialogOpen(true)
  }

  const openEditGoalDialog = (goal: SavingsGoal) => {
    setEditingGoal(goal)
    setGoalForm({
      month: goal.month,
      targetAmount: String(goal.targetAmount),
      note: goal.note ?? '',
    })
    setIsGoalDialogOpen(true)
  }

  const openCreateAssetDialog = () => {
    setEditingAsset(null)
    setAssetForm({
      type: 'insurance',
      name: '',
      amount: '',
      symbol: '',
      recurringMonthlyAmount: '',
      recurringStartDate: format(new Date(), 'yyyy-MM-dd'),
      note: '',
    })
    setIsRecurringInsuranceEnabled(false)
    setIsAssetDialogOpen(true)
  }

  const openEditAssetDialog = (asset: SavingsAsset) => {
    const currentSymbol = asset.type === 'crypto'
      ? getCryptoAssetSymbol(asset)
      : asset.type === 'stocks'
        ? getStockAssetSymbol(asset)
        : undefined
    setEditingAsset(asset)
    setAssetForm({
      type: asset.type,
      name: asset.name,
      amount: String(asset.amount),
      symbol: currentSymbol ?? '',
      recurringMonthlyAmount: asset.recurringMonthlyAmount ? String(asset.recurringMonthlyAmount) : '',
      recurringStartDate: asset.recurringStartDate ?? format(new Date(), 'yyyy-MM-dd'),
      note: asset.note ?? '',
    })
    setIsRecurringInsuranceEnabled(
      asset.type === 'insurance' &&
      typeof asset.recurringMonthlyAmount === 'number' &&
      asset.recurringMonthlyAmount > 0 &&
      Boolean(asset.recurringStartDate)
    )
    setIsAssetDialogOpen(true)
  }

  const openCreateFundGoalDialog = () => {
    setEditingFundGoal(null)
    setFundGoalForm({
      name: '',
      targetAmount: '',
      targetDate: '',
      monthlyContribution: '',
      includeMonthlySavings: true,
      linkedTripId: '',
      linkedAssetIds: [],
      note: '',
      status: 'active',
      color: '#6366f1',
    })
    setIsFundGoalDialogOpen(true)
  }

  const openEditFundGoalDialog = (goal: FundGoal) => {
    setEditingFundGoal(goal)
    setFundGoalForm({
      name: goal.name,
      targetAmount: String(goal.targetAmount),
      targetDate: goal.targetDate ?? '',
      monthlyContribution: goal.monthlyContribution ? String(goal.monthlyContribution) : '',
      includeMonthlySavings: goal.includeMonthlySavings === true,
      linkedTripId: goal.linkedTripId ?? '',
      linkedAssetIds: goal.linkedAssetIds,
      note: goal.note ?? '',
      status: goal.status,
      color: goal.color ?? '#6366f1',
    })
    setIsFundGoalDialogOpen(true)
  }

  const toggleLinkedAsset = (assetId: string) => {
    setFundGoalForm((prev) => ({
      ...prev,
      linkedAssetIds: prev.linkedAssetIds.includes(assetId)
        ? prev.linkedAssetIds.filter((id) => id !== assetId)
        : [...prev.linkedAssetIds, assetId],
    }))
  }

  const fetchGoals = async () => {
    try {
      setIsGoalsLoading(true)
      const response = await fetch('/api/savings-goals?perPage=200')
      const data = (await response.json()) as SavingsGoalsApiResponse
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load savings goals')
      }

      const normalized = (data.items ?? [])
        .map(normalizeGoalRecord)
        .filter((goal): goal is SavingsGoal => goal !== null)
      setGoals(normalized)
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.error')
      alert(message)
    } finally {
      setIsGoalsLoading(false)
    }
  }

  useEffect(() => {
    void fetchGoals()
  }, [])

  const handleSaveGoal = async () => {
    if (!goalForm.month) {
      alert(t('savings.goalMonthInvalid'))
      return
    }

    const parsedAmount = Number(goalForm.targetAmount)
    if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
      alert(t('savings.goalAmountInvalid'))
      return
    }

    const payload = {
      month: goalForm.month,
      targetAmount: parsedAmount,
      note: goalForm.note.trim() || undefined,
    }

    try {
      setIsGoalSaving(true)
      const url = editingGoal ? `/api/savings-goals/${editingGoal.id}` : '/api/savings-goals'
      const method = editingGoal ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const data = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(data.error || t('savings.goalSaveFailed'))
      }

      setIsGoalDialogOpen(false)
      setEditingGoal(null)
      await fetchGoals()
    } catch (error) {
      const message = error instanceof Error ? error.message : t('savings.goalSaveFailed')
      alert(message)
    } finally {
      setIsGoalSaving(false)
    }
  }

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm(t('savings.deleteGoalConfirm'))) {
      return
    }

    try {
      setDeletingGoalId(goalId)
      const response = await fetch(`/api/savings-goals/${goalId}`, {
        method: 'DELETE',
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || t('savings.goalDeleteFailed'))
      }
      await fetchGoals()
    } catch (error) {
      const message = error instanceof Error ? error.message : t('savings.goalDeleteFailed')
      alert(message)
    } finally {
      setDeletingGoalId(null)
    }
  }

  const handleSaveAsset = async () => {
    if (!assetForm.name.trim()) {
      alert('Asset name is required.')
      return
    }

    const parsedAmount = Number(assetForm.amount)
    if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
      alert(assetForm.type === 'crypto' || (assetForm.type === 'stocks' && assetForm.symbol.trim())
        ? 'Quantity must be a number greater than or equal to zero.'
        : 'Amount must be a number greater than or equal to zero.')
      return
    }

    const normalizedSymbol = normalizeAssetSymbol(assetForm.symbol)
    if (assetForm.type === 'crypto' && !normalizedSymbol) {
      alert('Crypto symbol is required (for example: BTC, ETH, SOL).')
      return
    }
    if (assetForm.symbol.trim() && !normalizedSymbol) {
      alert('Symbol must contain only A-Z, 0-9, dot, or hyphen.')
      return
    }

    const parsedRecurringMonthlyAmount = isRecurringInsuranceEnabled && assetForm.type === 'insurance'
      ? Number(assetForm.recurringMonthlyAmount)
      : null

    if (
      isRecurringInsuranceEnabled &&
      assetForm.type === 'insurance' &&
      (Number.isNaN(parsedRecurringMonthlyAmount) || parsedRecurringMonthlyAmount === null || parsedRecurringMonthlyAmount <= 0)
    ) {
      alert('Recurring monthly insurance contribution must be greater than 0.')
      return
    }

    if (
      isRecurringInsuranceEnabled &&
      assetForm.type === 'insurance' &&
      !/^\d{4}-\d{2}-\d{2}$/.test(assetForm.recurringStartDate)
    ) {
      alert('Recurring start date is required.')
      return
    }

    const symbolPayload =
      assetForm.type === 'crypto'
        ? normalizedSymbol
        : assetForm.type === 'stocks'
          ? normalizedSymbol ?? (editingAsset ? '' : undefined)
        : editingAsset
          ? ''
          : undefined

    const payload = {
      type: assetForm.type,
      name: assetForm.name.trim(),
      amount: parsedAmount,
      symbol: symbolPayload,
      recurringMonthlyAmount:
        assetForm.type === 'insurance' && isRecurringInsuranceEnabled
          ? parsedRecurringMonthlyAmount
          : null,
      recurringStartDate:
        assetForm.type === 'insurance' && isRecurringInsuranceEnabled
          ? assetForm.recurringStartDate
          : null,
      note: assetForm.note.trim() || undefined,
    }

    try {
      setIsAssetSaving(true)
      const url = editingAsset ? `/api/savings-assets/${editingAsset.id}` : '/api/savings-assets'
      const method = editingAsset ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save savings asset')
      }

      setIsAssetDialogOpen(false)
      setEditingAsset(null)
      await refreshAssets()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save savings asset'
      alert(message)
    } finally {
      setIsAssetSaving(false)
    }
  }

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) {
      return
    }

    try {
      setDeletingAssetId(assetId)
      const response = await fetch(`/api/savings-assets/${assetId}`, {
        method: 'DELETE',
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete savings asset')
      }
      await refreshAssets()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete savings asset'
      alert(message)
    } finally {
      setDeletingAssetId(null)
    }
  }

  const handleSaveFundGoal = async () => {
    if (!fundGoalForm.name.trim()) {
      alert('Goal name is required.')
      return
    }

    const parsedTargetAmount = Number(fundGoalForm.targetAmount)
    if (Number.isNaN(parsedTargetAmount) || parsedTargetAmount < 0) {
      alert('Target amount must be a non-negative number.')
      return
    }

    const parsedMonthlyContribution = fundGoalForm.monthlyContribution.trim().length > 0
      ? Number(fundGoalForm.monthlyContribution)
      : null
    if (
      parsedMonthlyContribution !== null &&
      (Number.isNaN(parsedMonthlyContribution) || parsedMonthlyContribution < 0)
    ) {
      alert('Monthly contribution must be a non-negative number.')
      return
    }

    if (
      fundGoalForm.targetDate.trim() &&
      !/^\d{4}-\d{2}-\d{2}$/.test(fundGoalForm.targetDate)
    ) {
      alert('Target date must use YYYY-MM-DD format.')
      return
    }

    const payload = {
      name: fundGoalForm.name.trim(),
      targetAmount: parsedTargetAmount,
      targetDate: fundGoalForm.targetDate.trim() || undefined,
      monthlyContribution: parsedMonthlyContribution,
      includeMonthlySavings: fundGoalForm.includeMonthlySavings,
      linkedTripId: fundGoalForm.linkedTripId || undefined,
      linkedAssets: fundGoalForm.linkedAssetIds,
      note: fundGoalForm.note.trim() || undefined,
      status: fundGoalForm.status,
      color: fundGoalForm.color.trim() || undefined,
    }

    try {
      setIsFundGoalSaving(true)
      const url = editingFundGoal ? `/api/fund-goals/${editingFundGoal.id}` : '/api/fund-goals'
      const method = editingFundGoal ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save fund goal')
      }

      setIsFundGoalDialogOpen(false)
      setEditingFundGoal(null)
      await refreshFundGoals()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save fund goal'
      alert(message)
    } finally {
      setIsFundGoalSaving(false)
    }
  }

  const handleDeleteFundGoal = async (goalId: string) => {
    if (!confirm('Are you sure you want to delete this fund goal?')) {
      return
    }

    try {
      setDeletingFundGoalId(goalId)
      const response = await fetch(`/api/fund-goals/${goalId}`, {
        method: 'DELETE',
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete fund goal')
      }
      await refreshFundGoals()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete fund goal'
      alert(message)
    } finally {
      setDeletingFundGoalId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('savings.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('savings.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('savings.monthlyIncome')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-2xl font-bold tabular-nums text-emerald-600">
              <ArrowUpRight className="h-5 w-5" />
              {Math.round(monthlyIncome).toLocaleString()} {displayCurrency}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('savings.monthlyExpense')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-2xl font-bold tabular-nums text-rose-600">
              <ArrowDownRight className="h-5 w-5" />
              {Math.round(monthlyExpense).toLocaleString()} {displayCurrency}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-primary">
              <PiggyBank className="h-4 w-4" />
              {t('savings.netSavings')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold tabular-nums ${monthlySavings >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {Math.round(monthlySavings).toLocaleString()} {displayCurrency}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('savings.savingsRate')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold tabular-nums ${savingsRate >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {savingsRate.toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tracked Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-primary">
              {Math.round(totalAssetValue).toLocaleString()} {displayCurrency}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Insurance, crypto, stocks, and personal saving funds
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/40">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" />
              {t('savings.currentGoal')}
            </CardTitle>
            <CardDescription>{t('savings.goalsDesc')}</CardDescription>
          </div>
          <Button
            onClick={() => currentGoal ? openEditGoalDialog(currentGoal) : openCreateGoalDialog()}
            variant={currentGoal ? 'outline' : 'default'}
            className="rounded-xl"
          >
            {currentGoal ? (
              <>
                <Edit2 className="mr-2 h-4 w-4" />
                {t('savings.editGoal')}
              </>
            ) : (
              <>
                <PlusCircle className="mr-2 h-4 w-4" />
                {t('savings.setGoal')}
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {isGoalsLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : !currentGoal ? (
            <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
              {t('savings.noGoalForMonth')}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border/50 px-4 py-3">
                  <p className="text-xs uppercase text-muted-foreground">{t('savings.goalTarget')}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {Math.round(currentGoal.targetAmount).toLocaleString()} {displayCurrency}
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 px-4 py-3">
                  <p className="text-xs uppercase text-muted-foreground">{t('savings.goalSaved')}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-primary">
                    {Math.round(positiveMonthlySavings).toLocaleString()} {displayCurrency}
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 px-4 py-3">
                  <p className="text-xs uppercase text-muted-foreground">
                    {goalReached ? t('savings.goalExceeded') : t('savings.goalRemaining')}
                  </p>
                  <p className={`mt-1 text-lg font-semibold tabular-nums ${goalReached ? 'text-primary' : 'text-muted-foreground'}`}>
                    {Math.round(goalReached ? exceededAmount : remainingAmount).toLocaleString()} {displayCurrency}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('savings.goalProgress')}</span>
                  <span className="font-semibold tabular-nums">{progressPercentage.toFixed(1)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${goalReached ? 'bg-primary' : 'bg-amber-500'}`}
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <p className={`text-sm ${goalReached ? 'text-primary' : 'text-muted-foreground'}`}>
                  {goalReached ? t('savings.goalAchieved') : t('savings.goalInProgress')}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/40">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" />
              Fund Goals
            </CardTitle>
            <CardDescription>
              Link assets, trips, and monthly savings to long-term funding goals.
            </CardDescription>
          </div>
          <Button onClick={openCreateFundGoalDialog} className="rounded-xl">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Fund Goal
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {fundGoalsError && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {fundGoalsError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border/50 px-4 py-3">
              <p className="text-xs uppercase text-muted-foreground">Active Goals</p>
              <p className="mt-1 text-lg font-semibold">{activeFundGoals.length}</p>
            </div>
            <div className="rounded-xl border border-border/50 px-4 py-3">
              <p className="text-xs uppercase text-muted-foreground">Tracked Amount</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {Math.round(fundGoalCurrentAmount).toLocaleString()} {displayCurrency}
              </p>
            </div>
            <div className="rounded-xl border border-border/50 px-4 py-3">
              <p className="text-xs uppercase text-muted-foreground">Target Total</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {Math.round(fundGoalTargetAmount).toLocaleString()} {displayCurrency}
              </p>
            </div>
            <div className="rounded-xl border border-border/50 px-4 py-3">
              <p className="text-xs uppercase text-muted-foreground">Projected Monthly</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {Math.round(fundGoalProjectedMonthly).toLocaleString()} {displayCurrency}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {fundGoalsOnTrack}/{activeFundGoals.length || 0} on track
              </p>
            </div>
          </div>

          {isFundGoalsLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : sortedFundGoals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
              No fund goals yet. Create one to track a trip fund, emergency fund, or other long-term target.
            </div>
          ) : (
            <div className="space-y-3">
              {sortedFundGoals.map((goal) => (
                <div
                  key={goal.id}
                  className="space-y-4 rounded-xl border border-border/40 p-4"
                  style={goal.color ? { borderColor: `${goal.color}55` } : undefined}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{goal.name}</p>
                        <Badge variant={getFundGoalBadgeVariant(goal.status)}>
                          {formatFundGoalStatus(goal.status)}
                        </Badge>
                        {goal.isOnTrack !== undefined && (
                          <Badge variant={goal.isOnTrack ? 'default' : 'secondary'}>
                            {goal.isOnTrack ? 'On Track' : 'Behind'}
                          </Badge>
                        )}
                        {goal.color && (
                          <span
                            className="h-3 w-3 rounded-full border border-border/50"
                            style={{ backgroundColor: goal.color }}
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      {goal.note && (
                        <p className="text-sm text-muted-foreground">{goal.note}</p>
                      )}
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {goal.targetDate && <span>Target by {format(new Date(`${goal.targetDate}T00:00:00`), 'MMM d, yyyy')}</span>}
                        {goal.linkedTrip && <span>Trip: {goal.linkedTrip.name}</span>}
                        {goal.includeMonthlySavings && <span>Includes monthly savings</span>}
                        <span>{goal.linkedAssets.length} linked assets</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditFundGoalDialog(goal)} className="h-8 w-8 rounded-lg">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleDeleteFundGoal(goal.id)}
                        className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                        disabled={deletingFundGoalId === goal.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-border/50 px-4 py-3">
                      <p className="text-xs uppercase text-muted-foreground">Current</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {Math.round(goal.currentAmount).toLocaleString()} {displayCurrency}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/50 px-4 py-3">
                      <p className="text-xs uppercase text-muted-foreground">Target</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {Math.round(goal.targetAmount).toLocaleString()} {displayCurrency}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/50 px-4 py-3">
                      <p className="text-xs uppercase text-muted-foreground">Remaining</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {Math.round(goal.remainingAmount).toLocaleString()} {displayCurrency}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/50 px-4 py-3">
                      <p className="text-xs uppercase text-muted-foreground">Projected Monthly</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {Math.round(goal.projectedMonthlyContribution).toLocaleString()} {displayCurrency}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-semibold tabular-nums">{goal.progressPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{
                          width: `${goal.progressPercentage}%`,
                          backgroundColor: goal.color || undefined,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {goal.projectedCompletionDate
                        ? `Projected completion ${format(new Date(`${goal.projectedCompletionDate}T00:00:00`), 'MMM d, yyyy')}`
                        : 'Add linked assets or monthly contributions to estimate completion.'}
                    </p>
                  </div>

                  {goal.linkedAssets.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {goal.linkedAssets.map((asset) => (
                        <Badge key={asset.asset.id} variant="outline">
                          {asset.asset.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/40">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" />
              Financial Assets
            </CardTitle>
            <CardDescription>
              Track insurance, crypto holdings, stocks, and personal saving funds inside savings.
            </CardDescription>
          </div>
          <Button onClick={openCreateAssetDialog} className="rounded-xl">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Asset
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAssetsLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : (
            <>
              {assetsError && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {assetsError}
                </div>
              )}
              {(trackedCryptoProducts.length > 0 || trackedStockSymbols.length > 0) && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    {cryptoSocketState === 'connected' || stockSocketState === 'connected' ? (
                      <Wifi className="h-4 w-4 text-primary" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">Market Live Feed</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {trackedCryptoProducts.length > 0 && (
                      <span>
                        Crypto: {cryptoSocketState === 'connected'
                          ? 'Connected'
                          : cryptoSocketState === 'connecting'
                            ? 'Connecting...'
                            : cryptoSocketState === 'error'
                              ? 'Disconnected'
                              : 'Idle'}
                      </span>
                    )}
                    {trackedStockSymbols.length > 0 && (
                      <span>
                        Stocks: {stockSocketState === 'connected'
                          ? 'Connected'
                          : stockSocketState === 'connecting'
                            ? 'Connecting...'
                            : stockSocketState === 'error'
                              ? 'Disconnected'
                              : 'Idle'}
                      </span>
                    )}
                    {trackedCryptoProducts.length > 0 && <span>Crypto Pairs: {trackedCryptoProducts.map((item) => item.productId).join(', ')}</span>}
                    {trackedStockSymbols.length > 0 && <span>Stock Symbols: {trackedStockSymbols.join(', ')}</span>}
                    <span>USD/{settings.currency}: {usdToCurrencyRate.toFixed(4)}</span>
                    {cryptoSocketError && <span>{cryptoSocketError}</span>}
                    {stockSocketError && <span>{stockSocketError}</span>}
                    {fxError && <span>{fxError}</span>}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl border border-border/50 px-4 py-3">
                  <p className="text-xs uppercase text-muted-foreground">Total Assets</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {Math.round(totalAssetValue).toLocaleString()} {displayCurrency}
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 px-4 py-3">
                  <p className="text-xs uppercase text-muted-foreground">Insurance</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {Math.round(insuranceValue).toLocaleString()} {displayCurrency}
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 px-4 py-3">
                  <p className="text-xs uppercase text-muted-foreground">Crypto</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {Math.round(cryptoValue).toLocaleString()} {displayCurrency}
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 px-4 py-3">
                  <p className="text-xs uppercase text-muted-foreground">Stocks</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {Math.round(stocksValue).toLocaleString()} {displayCurrency}
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 px-4 py-3">
                  <p className="text-xs uppercase text-muted-foreground">Personal Saving Funds</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {Math.round(personalFundsValue).toLocaleString()} {displayCurrency}
                  </p>
                </div>
              </div>

              {sortedPortfolioAssets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                  No assets yet. Add insurance, crypto, stocks, or personal saving funds to track your full savings position.
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedPortfolioAssets.map((portfolioAsset) => {
                    const { asset } = portfolioAsset
                    const Icon = ASSET_TYPE_META[asset.type].icon
                    return (
                      <div
                        key={asset.id}
                        className="flex flex-col gap-3 rounded-xl border border-border/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                              <Icon className="h-4 w-4 text-primary" />
                            </span>
                            <p className="font-semibold">{asset.name}</p>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              {ASSET_TYPE_META[asset.type].label}
                            </span>
                          </div>
                          {asset.note && (
                            <p className="text-sm text-muted-foreground">{asset.note}</p>
                          )}
                          {asset.type === 'insurance' && portfolioAsset.recurringMonthlyAmount && portfolioAsset.recurringStartDate && (
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                                {Math.round(portfolioAsset.recurringMonthlyAmount).toLocaleString()} {displayCurrency} / month
                              </span>
                              <span>Since {format(new Date(`${portfolioAsset.recurringStartDate}T00:00:00`), 'MMM d, yyyy')}</span>
                              {typeof portfolioAsset.recurringContributionCount === 'number' && (
                                <span>
                                  {portfolioAsset.recurringContributionCount} contributions
                                </span>
                              )}
                              {typeof portfolioAsset.recurringContributionValue === 'number' && portfolioAsset.recurringContributionValue > 0 && (
                                <span>
                                  Added {Math.round(portfolioAsset.recurringContributionValue).toLocaleString()} {displayCurrency}
                                </span>
                              )}
                              {portfolioAsset.nextRecurringContributionDate && (
                                <span>
                                  Next {format(new Date(`${portfolioAsset.nextRecurringContributionDate}T00:00:00`), 'MMM d, yyyy')}
                                </span>
                              )}
                            </div>
                          )}
                          {(asset.type === 'crypto' || asset.type === 'stocks') && (
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                                {portfolioAsset.productId ?? 'No Symbol'}
                              </span>
                              <span>
                                Qty: {asset.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: asset.type === 'stocks' ? 4 : 8 })}
                              </span>
                              <span className="font-medium text-foreground">
                                {typeof portfolioAsset.unitPriceUsd === 'number'
                                  ? `$${portfolioAsset.unitPriceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  : 'Live: --'}
                              </span>
                              {portfolioAsset.valueSource === 'pending' && (
                                <span>Waiting for quote...</span>
                              )}
                              {portfolioAsset.quoteUpdatedAt && (
                                <span>
                                  Updated {format(new Date(portfolioAsset.quoteUpdatedAt), 'HH:mm:ss')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="font-semibold tabular-nums">
                              {Math.round(portfolioAsset.currentValue).toLocaleString()} {displayCurrency}
                            </p>
                            {asset.type === 'insurance' && portfolioAsset.recurringContributionValue && portfolioAsset.recurringContributionValue > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Base {Math.round(asset.amount).toLocaleString()} + recurring {Math.round(portfolioAsset.recurringContributionValue).toLocaleString()}
                              </p>
                            )}
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => openEditAssetDialog(asset)} className="h-8 w-8 rounded-lg">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => void handleDeleteAsset(asset.id)}
                            className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                            disabled={deletingAssetId === asset.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-base">{t('savings.goalsHistory')}</CardTitle>
          <CardDescription>{t('savings.goalsHistoryDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isGoalsLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : sortedGoals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
              {t('savings.noGoals')}
            </div>
          ) : (
            sortedGoals.map((goal) => (
              <div
                key={goal.id}
                className="flex flex-col gap-3 rounded-xl border border-border/40 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{formatGoalMonth(goal.month)}</p>
                    {goal.month === thisMonthKey && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {t('common.thisMonth')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {Math.round(goal.targetAmount).toLocaleString()} {displayCurrency}
                  </p>
                  {goal.note && (
                    <p className="text-xs text-muted-foreground">{goal.note}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => openEditGoalDialog(goal)} className="h-8 w-8 rounded-lg">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleDeleteGoal(goal.id)}
                    className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                    disabled={deletingGoalId === goal.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-base">{t('savings.breakdownTitle')}</CardTitle>
          <CardDescription>{t('savings.breakdownDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-border/40 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Repeat className="h-4 w-4" />
              {t('savings.subscriptionCost')}
            </div>
            <div className="font-semibold tabular-nums">
              {Math.round(monthlySubscriptionCost).toLocaleString()} {displayCurrency}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {monthlySavings >= 0 ? t('savings.goodMessage') : t('savings.warningMessage')}
          </p>
        </CardContent>
      </Card>

      <Dialog
        open={isGoalDialogOpen}
        onOpenChange={(open) => {
          setIsGoalDialogOpen(open)
          if (!open) {
            setEditingGoal(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{editingGoal ? t('savings.editGoal') : t('savings.setGoal')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>{t('savings.goalMonth')}</Label>
              <Input
                type="month"
                value={goalForm.month}
                onChange={(e) => setGoalForm((prev) => ({ ...prev, month: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('savings.targetAmount')}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={goalForm.targetAmount}
                onChange={(e) => setGoalForm((prev) => ({ ...prev, targetAmount: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('savings.goalNote')}</Label>
              <Textarea
                value={goalForm.note}
                onChange={(e) => setGoalForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder={t('savings.goalNotePlaceholder')}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGoalDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => void handleSaveGoal()} disabled={isGoalSaving}>
              {isGoalSaving ? `${t('common.save')}...` : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isFundGoalDialogOpen}
        onOpenChange={(open) => {
          setIsFundGoalDialogOpen(open)
          if (!open) {
            setEditingFundGoal(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editingFundGoal ? 'Edit Fund Goal' : 'Add Fund Goal'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Goal Name</Label>
                <Input
                  value={fundGoalForm.name}
                  onChange={(e) => setFundGoalForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Emergency fund, Japan 2027, Retirement top-up..."
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={fundGoalForm.status}
                  onValueChange={(value) => {
                    if (value === 'active' || value === 'completed' || value === 'archived') {
                      setFundGoalForm((prev) => ({ ...prev, status: value }))
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Target Amount</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={fundGoalForm.targetAmount}
                  onChange={(e) => setFundGoalForm((prev) => ({ ...prev, targetAmount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Target Date</Label>
                <Input
                  type="date"
                  value={fundGoalForm.targetDate}
                  onChange={(e) => setFundGoalForm((prev) => ({ ...prev, targetDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label>Monthly Contribution</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={fundGoalForm.monthlyContribution}
                  onChange={(e) => setFundGoalForm((prev) => ({ ...prev, monthlyContribution: e.target.value }))}
                  placeholder="Optional manual monthly amount"
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <Input
                  type="color"
                  value={fundGoalForm.color}
                  onChange={(e) => setFundGoalForm((prev) => ({ ...prev, color: e.target.value }))}
                  className="h-10 w-20 p-1"
                />
              </div>
            </div>

            <div className="flex items-start justify-between rounded-xl border border-border/50 bg-muted/15 px-4 py-3">
              <div className="space-y-1">
                <Label className="text-sm font-medium">Include Net Monthly Savings</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically count this month&apos;s net savings toward the goal projection.
                </p>
              </div>
              <Switch
                checked={fundGoalForm.includeMonthlySavings}
                onCheckedChange={(checked) => setFundGoalForm((prev) => ({ ...prev, includeMonthlySavings: checked }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Linked Trip</Label>
              <Select
                value={fundGoalForm.linkedTripId || 'none'}
                onValueChange={(value) => setFundGoalForm((prev) => ({ ...prev, linkedTripId: value === 'none' ? '' : (value ?? '') }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked trip</SelectItem>
                  {trips.map((trip) => (
                    <SelectItem key={trip.id} value={trip.id}>
                      {trip.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Linked Assets</Label>
                <p className="text-xs text-muted-foreground">
                  Pick the savings assets that already belong to this goal.
                </p>
              </div>
              {sortedPortfolioAssets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                  Add savings assets first, then link them here.
                </div>
              ) : (
                <div className="grid gap-2">
                  {sortedPortfolioAssets.map((asset) => {
                    const isSelected = fundGoalForm.linkedAssetIds.includes(asset.asset.id)
                    return (
                      <button
                        key={asset.asset.id}
                        type="button"
                        onClick={() => toggleLinkedAsset(asset.asset.id)}
                        className={[
                          'flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-all',
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-border/50 bg-background hover:bg-muted/20',
                        ].join(' ')}
                      >
                        <div>
                          <p className="font-medium">{asset.asset.name}</p>
                          <p className="text-xs text-muted-foreground">{ASSET_TYPE_META[asset.asset.type].label}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold tabular-nums">
                            {Math.round(asset.currentValue).toLocaleString()} {displayCurrency}
                          </p>
                          {isSelected && <p className="text-xs text-primary">Linked</p>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea
                value={fundGoalForm.note}
                onChange={(e) => setFundGoalForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Optional notes about this goal"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFundGoalDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => void handleSaveFundGoal()} disabled={isFundGoalSaving}>
              {isFundGoalSaving ? `${t('common.save')}...` : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAssetDialogOpen}
        onOpenChange={(open) => {
          setIsAssetDialogOpen(open)
          if (!open) {
            setEditingAsset(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{editingAsset ? 'Edit Asset' : 'Add Asset'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Asset Type</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(Object.keys(ASSET_TYPE_META) as SavingsAssetType[]).map((assetType) => {
                  const Icon = ASSET_TYPE_META[assetType].icon
                  const active = assetForm.type === assetType
                  return (
                    <button
                      key={assetType}
                      type="button"
                      onClick={() => {
                        setAssetForm((prev) => ({
                          ...prev,
                          type: assetType,
                          symbol: assetType === 'crypto' ? prev.symbol : '',
                          recurringMonthlyAmount: assetType === 'insurance' ? prev.recurringMonthlyAmount : '',
                          recurringStartDate: assetType === 'insurance' ? prev.recurringStartDate : format(new Date(), 'yyyy-MM-dd'),
                        }))
                        if (assetType !== 'insurance') {
                          setIsRecurringInsuranceEnabled(false)
                        }
                      }}
                      className={[
                        'flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-all',
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground',
                      ].join(' ')}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {ASSET_TYPE_META[assetType].label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={assetForm.name}
                onChange={(e) => setAssetForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="AIA policy, BTC wallet, emergency fund..."
              />
            </div>
            {assetForm.type === 'insurance' && (
              <div className="space-y-3 rounded-xl border border-border/50 bg-muted/15 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Recurring Monthly Insurance Saving</Label>
                    <p className="text-xs text-muted-foreground">
                      Add a monthly insurance contribution and track when it started.
                    </p>
                  </div>
                  <Switch
                    checked={isRecurringInsuranceEnabled}
                    onCheckedChange={(checked) => {
                      setIsRecurringInsuranceEnabled(checked)
                      if (!checked) {
                        setAssetForm((prev) => ({
                          ...prev,
                          recurringMonthlyAmount: '',
                          recurringStartDate: format(new Date(), 'yyyy-MM-dd'),
                        }))
                      }
                    }}
                  />
                </div>

                {isRecurringInsuranceEnabled && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Monthly Contribution</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={assetForm.recurringMonthlyAmount}
                        onChange={(e) => setAssetForm((prev) => ({ ...prev, recurringMonthlyAmount: e.target.value }))}
                        placeholder="e.g. 250"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Recurring Start Date</Label>
                      <Input
                        type="date"
                        value={assetForm.recurringStartDate}
                        onChange={(e) => setAssetForm((prev) => ({ ...prev, recurringStartDate: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            {(assetForm.type === 'crypto' || assetForm.type === 'stocks') && (
              <div className="space-y-2">
                <Label>{assetForm.type === 'crypto' ? 'Crypto Symbol' : 'Stock Symbol'}</Label>
                <Input
                  value={assetForm.symbol}
                  onChange={(e) => setAssetForm((prev) => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                  placeholder={assetForm.type === 'crypto' ? 'BTC, ETH, SOL' : 'AAPL, NVDA, TSLA'}
                />
                <p className="text-xs text-muted-foreground">
                  {assetForm.type === 'crypto'
                    ? `Used for Coinbase live ticker stream (mapped as SYMBOL-USD) and converted to ${settings.currency}.`
                    : `Optional. When provided, app will use the Yahoo live stock feed from the backend streamer and convert to ${settings.currency}.`}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>
                {assetForm.type === 'crypto'
                  ? 'Crypto Quantity'
                  : assetForm.type === 'stocks' && assetForm.symbol.trim()
                    ? 'Stock Quantity'
                  : assetForm.type === 'insurance' && isRecurringInsuranceEnabled
                    ? `Base Amount (${displayCurrency})`
                    : `Amount (${displayCurrency})`}
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={assetForm.amount}
                onChange={(e) => setAssetForm((prev) => ({ ...prev, amount: e.target.value }))}
              />
              {assetForm.type === 'crypto' && (
                <p className="text-xs text-muted-foreground">
                  Enter coin amount (for example 0.25 BTC). App will calculate live {settings.currency} value.
                </p>
              )}
              {assetForm.type === 'stocks' && assetForm.symbol.trim() && (
                <p className="text-xs text-muted-foreground">
                  Enter share quantity (for example 12 AAPL). App will calculate live {settings.currency} value when Yahoo pricing is available.
                </p>
              )}
              {assetForm.type === 'insurance' && isRecurringInsuranceEnabled && (
                <p className="text-xs text-muted-foreground">
                  Base amount stays fixed. Monthly insurance contributions are added automatically from the selected start date.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Note (Optional)</Label>
              <Textarea
                value={assetForm.note}
                onChange={(e) => setAssetForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Policy term, exchange, broker account..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssetDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => void handleSaveAsset()} disabled={isAssetSaving}>
              {isAssetSaving ? `${t('common.save')}...` : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
