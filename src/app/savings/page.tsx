'use client'

import { useEffect, useMemo, useState } from 'react'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import { ArrowDownRight, ArrowUpRight, Edit2, PiggyBank, PlusCircle, Repeat, Target, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useApp } from '@/contexts/AppContext'
import { t } from '@/i18n/config'
import { SavingsGoal } from '@/types'

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

export default function SavingsPage() {
  const { incomes, monthlySummary, subscriptions, settings } = useApp()
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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('savings.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('savings.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('savings.monthlyIncome')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-2xl font-bold tabular-nums text-emerald-600">
              <ArrowUpRight className="h-5 w-5" />
              {Math.round(monthlyIncome).toLocaleString()} {settings.currency}
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
              {Math.round(monthlyExpense).toLocaleString()} {settings.currency}
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
              {Math.round(monthlySavings).toLocaleString()} {settings.currency}
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
                    {Math.round(currentGoal.targetAmount).toLocaleString()} {settings.currency}
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 px-4 py-3">
                  <p className="text-xs uppercase text-muted-foreground">{t('savings.goalSaved')}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-primary">
                    {Math.round(positiveMonthlySavings).toLocaleString()} {settings.currency}
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 px-4 py-3">
                  <p className="text-xs uppercase text-muted-foreground">
                    {goalReached ? t('savings.goalExceeded') : t('savings.goalRemaining')}
                  </p>
                  <p className={`mt-1 text-lg font-semibold tabular-nums ${goalReached ? 'text-primary' : 'text-muted-foreground'}`}>
                    {Math.round(goalReached ? exceededAmount : remainingAmount).toLocaleString()} {settings.currency}
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
                    {Math.round(goal.targetAmount).toLocaleString()} {settings.currency}
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
              {Math.round(monthlySubscriptionCost).toLocaleString()} {settings.currency}
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
    </div>
  )
}
