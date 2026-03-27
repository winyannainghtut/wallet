'use client'

import { useState } from 'react'
import { Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ExpenseList } from '@/components/ExpenseList'
import { ExpenseForm } from '@/components/ExpenseForm'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useApp } from '@/contexts/AppContext'
import { CATEGORIES, Expense, getCategoryLabel } from '@/types'
import { t, getLanguage } from '@/i18n/config'
import { getCurrencyDisplayLabel } from '@/lib/settings'

export default function HistoryPage() {
  const { expenses, personalExpenses, deleteExpense, updateExpense, settings } = useApp()
  const language = getLanguage()
  const displayCurrency = getCurrencyDisplayLabel(settings)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [search, setSearch] = useState('')

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  let filteredExpenses = [...expenses]

  if (startDate) {
    filteredExpenses = filteredExpenses.filter((expense) => expense.date >= startDate)
  }
  if (endDate) {
    filteredExpenses = filteredExpenses.filter((expense) => expense.date <= endDate)
  }
  if (category !== 'all') {
    filteredExpenses = filteredExpenses.filter((expense) => expense.category === category)
  }
  if (search) {
    const searchLower = search.toLowerCase()
    filteredExpenses = filteredExpenses.filter((expense) =>
      expense.description.toLowerCase().includes(searchLower) ||
      expense.category.toLowerCase().includes(searchLower)
    )
  }

  filteredExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setCategory('all')
    setSearch('')
  }

  const hasFilters = Boolean(startDate || endDate || category !== 'all' || search)
  const personalExpenseAmountById = new Map(personalExpenses.map((expense) => [expense.id, expense.amount]))
  const filteredTotal = filteredExpenses.reduce(
    (sum, expense) => sum + (personalExpenseAmountById.get(expense.id) ?? expense.amount),
    0
  )

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense)
    setIsEditDialogOpen(true)
  }

  const handleSave = async (data: Omit<Expense, 'id' | 'createdAt'>) => {
    if (!editingExpense) return

    setIsUpdating(true)
    try {
      await updateExpense(editingExpense.id, data)
      setIsEditDialogOpen(false)
      setEditingExpense(null)
    } catch (error) {
      console.error('Error updating expense:', error)
      alert(t('common.error'))
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('history.title')}</h1>
          <p className="text-sm text-muted-foreground">{filteredExpenses.length} entries matched</p>
        </div>
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters} className="rounded-lg border-border/60">
            <X className="mr-2 h-4 w-4" />
            {t('history.clearFilters')}
          </Button>
        )}
      </div>

      <Card className="border-border/40">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-accent/20">
              <Filter className="h-3.5 w-3.5 text-primary" />
            </span>
            {t('common.filter')}
          </CardTitle>
          <CardDescription>Narrow by date range, category, or keyword.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('history.filterByDate')} (From)</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">To</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('history.filterByCategory')}</Label>
              <Select value={category} onValueChange={(value) => setCategory(value ?? 'all')}>
                <SelectTrigger className="rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background">
                  <SelectValue placeholder={t('expense.selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {getCategoryLabel(cat, language)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('common.search')}</Label>
              <Input
                placeholder={t('common.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/80 px-4 py-3 backdrop-blur-sm">
        <div className="h-2 w-2 rounded-full bg-primary/60" />
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{filteredExpenses.length}</span> expenses | {t('common.total')}:{' '}
          <span className="font-bold tabular-nums text-foreground">{filteredTotal.toLocaleString()} {displayCurrency}</span>
        </p>
      </div>

      <ExpenseList
        expenses={filteredExpenses}
        onDelete={deleteExpense}
        onEdit={handleEdit}
        showDate
        currency={displayCurrency}
      />

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] overflow-hidden border-none bg-transparent p-0">
          <div className="p-1">
            {editingExpense && (
              <ExpenseForm
                initialData={editingExpense}
                onSubmit={handleSave}
                onCancel={() => setIsEditDialogOpen(false)}
                isSubmitting={isUpdating}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
