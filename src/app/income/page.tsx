'use client'

import { useMemo, useState } from 'react'
import { format, startOfMonth } from 'date-fns'
import { Edit2, Landmark, PlusCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApp } from '@/contexts/AppContext'
import { getLanguage, t } from '@/i18n/config'
import { INCOME_CATEGORIES, INCOME_CATEGORY_LABELS, Income, IncomeCategory } from '@/types'

type IncomeFormState = {
  amount: number
  category: IncomeCategory
  description: string
  date: string
}

const DEFAULT_FORM: IncomeFormState = {
  amount: 0,
  category: 'salary',
  description: '',
  date: format(new Date(), 'yyyy-MM-dd'),
}

export default function IncomePage() {
  const language = getLanguage()
  const { incomes, addIncome, updateIncome, deleteIncome, settings } = useApp()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingIncome, setEditingIncome] = useState<Income | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<IncomeFormState>(DEFAULT_FORM)

  const thisMonthStart = startOfMonth(new Date())
  const thisMonthPrefix = format(thisMonthStart, 'yyyy-MM')

  const monthlyIncome = useMemo(
    () => incomes.reduce((sum, item) => item.date.startsWith(thisMonthPrefix) ? sum + item.amount : sum, 0),
    [incomes, thisMonthPrefix]
  )

  const filteredIncomes = useMemo(() => {
    const searchText = search.trim().toLowerCase()
    const list = [...incomes]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    if (!searchText) {
      return list
    }

    return list.filter((item) => {
      const categoryLabel = INCOME_CATEGORY_LABELS[item.category][language].toLowerCase()
      return (
        item.description.toLowerCase().includes(searchText) ||
        categoryLabel.includes(searchText)
      )
    })
  }, [incomes, language, search])

  const openCreateDialog = () => {
    setEditingIncome(null)
    setForm(DEFAULT_FORM)
    setIsDialogOpen(true)
  }

  const openEditDialog = (item: Income) => {
    setEditingIncome(item)
    setForm({
      amount: item.amount,
      category: item.category,
      description: item.description,
      date: item.date,
    })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.amount || !form.date) return

    try {
      setIsSaving(true)
      if (editingIncome) {
        await updateIncome(editingIncome.id, form)
      } else {
        await addIncome(form)
      }
      setIsDialogOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.error')
      alert(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('income.deleteConfirm'))) return

    try {
      await deleteIncome(id)
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.error')
      alert(message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('income.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('income.subtitle')}</p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="rounded-xl bg-gradient-to-r from-primary to-primary/85 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          {t('income.addIncome')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="border-border/40 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-primary">
              <Landmark className="h-4 w-4" />
              {t('income.monthlyIncome')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">
              {Math.round(monthlyIncome).toLocaleString()} <span className="text-lg font-semibold text-muted-foreground">{settings.currency}</span>
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('income.records')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{filteredIncomes.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/40">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{t('income.history')}</CardTitle>
          <CardDescription>{t('income.historyDesc')}</CardDescription>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('income.searchPlaceholder')}
            className="mt-3 rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background"
          />
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredIncomes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
              {t('income.noIncome')}
            </div>
          ) : (
            filteredIncomes.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-border/40 px-4 py-3"
              >
                <div className="space-y-1">
                  <p className="font-semibold">
                    {INCOME_CATEGORY_LABELS[item.category][language]}
                  </p>
                  <p className="text-sm text-muted-foreground">{item.description || '-'}</p>
                  <p className="text-xs text-muted-foreground">{item.date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-bold tabular-nums text-primary">
                    +{item.amount.toLocaleString()} {settings.currency}
                  </p>
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="h-8 w-8 rounded-lg">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleDelete(item.id)}
                    className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{editingIncome ? t('income.editIncome') : t('income.addIncome')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>{t('common.amount')}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('common.category')}</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setForm((prev) => ({ ...prev, category: value as IncomeCategory }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCOME_CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {INCOME_CATEGORY_LABELS[item][language]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('common.date')}</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('common.description')}</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={t('income.descriptionPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? `${t('common.save')}...` : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
