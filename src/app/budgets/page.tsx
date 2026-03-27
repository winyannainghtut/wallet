'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { addMonths, format, subMonths } from 'date-fns'
import { Pencil, PiggyBank, PlusCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useApp } from '@/contexts/AppContext'
import { BudgetRecord } from '@/lib/budgets'
import { getCurrencyDisplayLabel } from '@/lib/settings'
import { CATEGORIES, Category, getCategoryLabel } from '@/types'
import { getLanguage } from '@/i18n/config'

type ApiListResponse<T> = {
  items?: T[]
  error?: string
}

type BudgetFormState = {
  month: string
  category: string
  limitAmount: string
  rolloverAmount: string
  note: string
  isActive: boolean
}

const emptyForm = (): BudgetFormState => ({
  month: format(new Date(), 'yyyy-MM'),
  category: 'groceries',
  limitAmount: '',
  rolloverAmount: '',
  note: '',
  isActive: true,
})

function dedupeBudgets(records: BudgetRecord[]): BudgetRecord[] {
  const latestByKey = new Map<string, BudgetRecord>()

  for (const record of records) {
    const key = `${record.month}::${record.category}`
    const existing = latestByKey.get(key)
    if (!existing) {
      latestByKey.set(key, record)
      continue
    }

    const existingStamp = existing.updated ?? existing.created ?? ''
    const nextStamp = record.updated ?? record.created ?? ''
    if (nextStamp >= existingStamp) {
      latestByKey.set(key, record)
    }
  }

  return Array.from(latestByKey.values())
}

export default function BudgetsPage() {
  const { personalExpenses, customCategories, settings } = useApp()
  const language = getLanguage()
  const displayCurrency = getCurrencyDisplayLabel(settings)
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [budgets, setBudgets] = useState<BudgetRecord[]>([])
  const [previousBudgets, setPreviousBudgets] = useState<BudgetRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<BudgetRecord | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState<BudgetFormState>(emptyForm)

  const expenseCategories = useMemo(
    () => [
      ...CATEGORIES,
      ...customCategories.filter((item) => item.type === 'expense').map((item) => item.name as Category),
    ].filter((value, index, array) => array.indexOf(value) === index),
    [customCategories]
  )

  const loadBudgets = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const previousMonth = format(subMonths(new Date(`${selectedMonth}-01T00:00:00`), 1), 'yyyy-MM')
      const [currentResponse, previousResponse] = await Promise.all([
        fetch(`/api/budgets?month=${selectedMonth}`),
        fetch(`/api/budgets?month=${previousMonth}`),
      ])
      const currentData = await currentResponse.json() as ApiListResponse<BudgetRecord>
      const previousData = await previousResponse.json() as ApiListResponse<BudgetRecord>
      if (!currentResponse.ok) {
        throw new Error(currentData.error || 'Failed to load budgets')
      }
      if (!previousResponse.ok) {
        throw new Error(previousData.error || 'Failed to load previous budgets')
      }
      setBudgets(dedupeBudgets(currentData.items ?? []).sort((a, b) => a.category.localeCompare(b.category)))
      setPreviousBudgets(dedupeBudgets(previousData.items ?? []))
    } catch (loadError) {
      setBudgets([])
      setPreviousBudgets([])
      setError(loadError instanceof Error ? loadError.message : 'Failed to load budgets')
    } finally {
      setIsLoading(false)
    }
  }, [selectedMonth])

  useEffect(() => {
    void loadBudgets()
  }, [loadBudgets])

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const expense of personalExpenses) {
      if (!expense.date.startsWith(selectedMonth)) continue
      map.set(expense.category, (map.get(expense.category) ?? 0) + expense.amount)
    }
    return map
  }, [personalExpenses, selectedMonth])

  const previousMonthLeftoverByCategory = useMemo(() => {
    const previousMonth = format(subMonths(new Date(`${selectedMonth}-01T00:00:00`), 1), 'yyyy-MM')
    const previousSpent = new Map<string, number>()
    for (const expense of personalExpenses) {
      if (!expense.date.startsWith(previousMonth)) continue
      previousSpent.set(expense.category, (previousSpent.get(expense.category) ?? 0) + expense.amount)
    }

    return new Map(previousBudgets.map((budget) => [
      budget.category,
      Math.max((budget.limitAmount + (budget.rolloverAmount ?? 0)) - (previousSpent.get(budget.category) ?? 0), 0),
    ]))
  }, [previousBudgets, personalExpenses, selectedMonth])

  const activeBudgets = budgets.filter((budget) => budget.month === selectedMonth && budget.isActive !== false)
  const summary = useMemo(() => {
    const planned = activeBudgets.reduce((sum, budget) => sum + budget.limitAmount + (budget.rolloverAmount ?? 0), 0)
    const spent = activeBudgets.reduce((sum, budget) => sum + (spentByCategory.get(budget.category) ?? 0), 0)
    const remaining = planned - spent
    return { planned, spent, remaining }
  }, [activeBudgets, spentByCategory])

  const openCreate = () => {
    setEditingBudget(null)
    setForm({ ...emptyForm(), month: selectedMonth, category: expenseCategories[0] ?? 'groceries' })
    setIsDialogOpen(true)
  }

  const openEdit = (budget: BudgetRecord) => {
    setEditingBudget(budget)
    setForm({
      month: budget.month,
      category: budget.category,
      limitAmount: budget.limitAmount.toString(),
      rolloverAmount: typeof budget.rolloverAmount === 'number' ? budget.rolloverAmount.toString() : '',
      note: budget.note ?? '',
      isActive: budget.isActive !== false,
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.category || !form.month || !form.limitAmount) {
      return
    }

    try {
      setIsSaving(true)
      const payload = {
        month: form.month,
        category: form.category,
        limitAmount: Number(form.limitAmount),
        rolloverAmount: form.rolloverAmount ? Number(form.rolloverAmount) : null,
        note: form.note.trim(),
        isActive: form.isActive,
      }

      const response = await fetch(editingBudget ? `/api/budgets/${editingBudget.id}` : '/api/budgets', {
        method: editingBudget ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save budget')
      }
      await loadBudgets()
      setIsDialogOpen(false)
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : 'Failed to save budget')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (budget: BudgetRecord) => {
    if (!confirm(`Delete ${budget.category} budget?`)) {
      return
    }

    try {
      const response = await fetch(`/api/budgets/${budget.id}`, { method: 'DELETE' })
      const data = await response.json() as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete budget')
      }
      await loadBudgets()
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : 'Failed to delete budget')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
          <p className="text-sm text-muted-foreground">
            Set monthly limits, carry leftover budget forward, and compare against your actual spend.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => setSelectedMonth(format(subMonths(new Date(`${selectedMonth}-01T00:00:00`), 1), 'yyyy-MM'))}>Previous</Button>
          <Input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="w-[160px] rounded-xl" />
          <Button variant="outline" className="rounded-xl" onClick={() => setSelectedMonth(format(addMonths(new Date(`${selectedMonth}-01T00:00:00`), 1), 'yyyy-MM'))}>Next</Button>
          <Button onClick={openCreate} className="rounded-xl">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Budget
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/40">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Planned</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{summary.planned.toFixed(2)} {displayCurrency}</CardContent>
        </Card>
        <Card className="border-border/40">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Spent</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{summary.spent.toFixed(2)} {displayCurrency}</CardContent>
        </Card>
        <Card className="border-border/40">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Remaining</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{summary.remaining.toFixed(2)} {displayCurrency}</CardContent>
        </Card>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {isLoading ? (
          <Card className="border-border/40 xl:col-span-2"><CardContent className="py-10 text-sm text-muted-foreground">Loading budgets...</CardContent></Card>
        ) : activeBudgets.length === 0 ? (
          <Card className="border-dashed border-border/50 xl:col-span-2">
            <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <PiggyBank className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-semibold">No budgets for {selectedMonth}</h2>
                <p className="text-sm text-muted-foreground">Create category budgets and optionally carry forward leftover amounts.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          activeBudgets.map((budget) => {
            const spent = spentByCategory.get(budget.category) ?? 0
            const planned = budget.limitAmount + (budget.rolloverAmount ?? 0)
            const progress = planned > 0 ? Math.min((spent / planned) * 100, 100) : 0
            const leftoverRecommendation = previousMonthLeftoverByCategory.get(budget.category) ?? 0
            return (
              <Card key={budget.id} className="border-border/40">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{getCategoryLabel(budget.category, language)}</p>
                      <p className="text-sm text-muted-foreground">{budget.month}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(budget)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => void handleDelete(budget)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-border/40 bg-muted/15 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Planned</p>
                      <p className="mt-1 text-lg font-semibold">{planned.toFixed(2)} {displayCurrency}</p>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-muted/15 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Spent</p>
                      <p className="mt-1 text-lg font-semibold">{spent.toFixed(2)} {displayCurrency}</p>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-muted/15 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Remaining</p>
                      <p className="mt-1 text-lg font-semibold">{(planned - spent).toFixed(2)} {displayCurrency}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${spent > planned ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>Base limit: {budget.limitAmount.toFixed(2)} {displayCurrency}</span>
                      {(budget.rolloverAmount ?? 0) > 0 && <span>Rollover: {(budget.rolloverAmount ?? 0).toFixed(2)} {displayCurrency}</span>}
                      {leftoverRecommendation > 0 && <span>Suggested rollover from previous month: {leftoverRecommendation.toFixed(2)} {displayCurrency}</span>}
                    </div>
                    {budget.note && <p className="text-sm text-muted-foreground">{budget.note}</p>}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingBudget ? 'Edit Budget' : 'Add Budget'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="budget-month">Month</Label>
                <Input id="budget-month" type="month" value={form.month} onChange={(event) => setForm((prev) => ({ ...prev, month: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(value) => setForm((prev) => ({ ...prev, category: value ?? prev.category }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((category) => (
                      <SelectItem key={category} value={category}>{getCategoryLabel(category, language)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="budget-limit">Limit Amount</Label>
                <Input id="budget-limit" type="number" step="0.01" value={form.limitAmount} onChange={(event) => setForm((prev) => ({ ...prev, limitAmount: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget-rollover">Rollover Amount</Label>
                <Input id="budget-rollover" type="number" step="0.01" value={form.rolloverAmount} onChange={(event) => setForm((prev) => ({ ...prev, rolloverAmount: event.target.value }))} placeholder={`Suggested ${(previousMonthLeftoverByCategory.get(form.category) ?? 0).toFixed(2)}`} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget-note">Note</Label>
              <Textarea id="budget-note" rows={3} value={form.note} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
              <div>
                <p className="text-sm font-medium">Active budget</p>
                <p className="text-xs text-muted-foreground">Inactive budgets remain as reference but are excluded from summaries.</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Budget'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

