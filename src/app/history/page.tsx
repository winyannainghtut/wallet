'use client'

import { useState } from 'react'
import { Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ExpenseList } from '@/components/ExpenseList'
import { useApp } from '@/contexts/AppContext'
import { CATEGORIES, CATEGORY_LABELS } from '@/types'
import { t, getLanguage } from '@/i18n/config'

export default function HistoryPage() {
  const { expenses, deleteExpense } = useApp()
  const language = getLanguage()

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [search, setSearch] = useState('')

  let filteredExpenses = [...expenses]

  if (startDate) {
    filteredExpenses = filteredExpenses.filter(e => e.date >= startDate)
  }
  if (endDate) {
    filteredExpenses = filteredExpenses.filter(e => e.date <= endDate)
  }
  if (category !== 'all') {
    filteredExpenses = filteredExpenses.filter(e => e.category === category)
  }
  if (search) {
    const searchLower = search.toLowerCase()
    filteredExpenses = filteredExpenses.filter(e =>
      e.description.toLowerCase().includes(searchLower) ||
      e.category.toLowerCase().includes(searchLower)
    )
  }

  filteredExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setCategory('all')
    setSearch('')
  }

  const hasFilters = !!(startDate || endDate || category !== 'all' || search)
  const filteredTotal = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)

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
                      {CATEGORY_LABELS[cat][language]}
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
          <span className="font-medium text-foreground">{filteredExpenses.length}</span> expenses · {t('common.total')}: <span className="font-bold tabular-nums text-foreground">{filteredTotal.toLocaleString()} SGD</span>
        </p>
      </div>

      <ExpenseList
        expenses={filteredExpenses}
        onDelete={deleteExpense}
        showDate
      />
    </div>
  )
}
