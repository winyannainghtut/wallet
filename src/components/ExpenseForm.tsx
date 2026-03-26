'use client'

import React, { useState } from 'react'
import { format } from 'date-fns'
import { Sparkles, Wand2, Plane, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CATEGORIES, Category, Expense, getCategoryLabel } from '@/types'
import { useApp } from '@/contexts/AppContext'
import { isAiKeyNotConfiguredError, parseExpenseText, suggestCategory } from '@/lib/ai-client'
import { t, getLanguage } from '@/i18n/config'

interface ExpenseFormProps {
  initialData?: Expense
  onSubmit: (data: Omit<Expense, 'id' | 'createdAt'>) => void
  onCancel?: () => void
  isSubmitting?: boolean
}

export function ExpenseForm({ initialData, onSubmit, onCancel, isSubmitting = false }: ExpenseFormProps) {
  const { trips, settings, customCategories, addCustomCategory } = useApp()
  const expenseCustomCategories = customCategories.filter(c => c.type === 'expense')
  const [mode, setMode] = useState<'manual' | 'magic'>('manual')
  const [magicText, setMagicText] = useState('')
  const [isParsing, setIsParsing] = useState(false)

  const [amount, setAmount] = useState(initialData?.amount?.toString() || '')
  const [category, setCategory] = useState<Category | ''>(initialData?.category || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [date, setDate] = useState(initialData?.date || format(new Date(), 'yyyy-MM-dd'))
  const [tripId, setTripId] = useState(initialData?.tripId || '')
  const [sharedGroupExpense, setSharedGroupExpense] = useState(initialData?.sharedGroupExpense === true)
  const [isSuggesting, setIsSuggesting] = useState(false)
  
  const language = getLanguage()
  const selectedTrip = trips.find((trip) => trip.id === tripId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !category || isSubmitting) return

    const normalizedTripId = tripId.trim()

    onSubmit({
      amount: parseFloat(amount),
      category: category as Category,
      description,
      date,
      tripId: normalizedTripId,
      sharedGroupExpense: normalizedTripId ? sharedGroupExpense : false,
    })
  }

  const handleSuggestCategory = async () => {
    if (!description.trim()) {
      alert(t('ai.suggestCategoryNeedDescription'))
      return
    }

    setIsSuggesting(true)
    try {
      const suggested = await suggestCategory(description, settings.aiModel)

      if (suggested.shouldCreateCustomCategory && suggested.customCategoryName) {
        const created = addCustomCategory({
          name: suggested.customCategoryName,
          type: 'expense',
        })
        setCategory(created.name)
        alert(`${t('ai.customCategoryCreated')}: ${created.name}`)
      } else {
        setCategory(suggested.category)
      }
    } catch (error) {
      console.error('Error suggesting category:', error)
      alert(isAiKeyNotConfiguredError(error) ? t('ai.noApiKey') : t('ai.suggestCategoryFailed'))
    } finally {
      setIsSuggesting(false)
    }
  }

  const handleMagicAdd = async () => {
    if (!magicText.trim()) return

    setIsParsing(true)
    try {
      const parsed = await parseExpenseText(magicText, settings.aiModel)
      if (parsed) {
        setAmount(parsed.amount.toString())
        setCategory(parsed.category)
        setDate(parsed.date)
        setDescription(parsed.description)
        setMode('manual') // switch back to let user confirm
        setMagicText('')
      } else {
        alert(t('common.error'))
      }
    } catch (error) {
      console.error('Error parsing magic text:', error)
      alert(t('common.error'))
    } finally {
      setIsParsing(false)
    }
  }

  const isSubmitDisabled = !amount || !category || isSubmitting || isSuggesting

  return (
    <Card className="border-border/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {initialData ? t('expense.editTitle') : t('expense.addTitle')}
          </CardTitle>
          {!initialData && (
            <div className="flex items-center rounded-lg bg-muted/50 p-1">
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${mode === 'manual' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Manual
              </button>
              <button
                type="button"
                onClick={() => setMode('magic')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${mode === 'magic' ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {t('expense.magicAdd')}
              </button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {mode === 'magic' ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('expense.magicAdd')}</Label>
              <Textarea
                placeholder={t('expense.magicAddPlaceholder')}
                value={magicText}
                onChange={(e) => setMagicText(e.target.value)}
                rows={3}
                className="rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Paste an SMS, receipt text, or simply describe what you spent.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleMagicAdd}
              disabled={isParsing || !magicText.trim()}
              className="w-full rounded-xl bg-gradient-to-r from-primary to-primary/80 shadow-sm shadow-primary/20 transition-all hover:shadow-md hover:shadow-primary/25"
            >
              {isParsing ? (
                t('expense.magicAddProcessing')
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  {t('expense.magicAddButton')}
                </>
              )}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} className="w-full rounded-xl border-border/60 mt-2">
                {t('common.cancel')}
              </Button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 animate-in fade-in duration-300">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm font-medium">{t('common.amount')} *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder={t('expense.amountPlaceholder')}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background"
                />
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="date" className="text-sm font-medium">{t('common.date')} *</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background"
                />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="category" className="text-sm font-medium">{t('common.category')} *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSuggestCategory}
                  disabled={isSuggesting}
                  className="h-8 gap-1.5 rounded-lg border-primary/30 text-primary transition-all hover:bg-primary/10 disabled:border-border/40 disabled:text-muted-foreground disabled:opacity-80"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {isSuggesting ? t('ai.categorizing') : t('ai.suggestCategory')}
                </Button>
              </div>
              <Select value={category} onValueChange={(v) => v && setCategory(v as Category)} required>
                <SelectTrigger className="rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background">
                  <SelectValue placeholder={t('expense.selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {getCategoryLabel(cat, language)}
                    </SelectItem>
                  ))}
                  {expenseCustomCategories.length > 0 && (
                    <>
                      <div className="h-px bg-border/40 my-1 mx-2" />
                      {expenseCustomCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {description.trim() ? t('ai.suggestCategoryHint') : t('ai.suggestCategoryNeedDescription')}
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">{t('common.description')}</Label>
              <Textarea
                id="description"
                placeholder={t('expense.descriptionPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background"
              />
              <p className="text-xs text-muted-foreground/80">
                Add context like place or purpose for smarter insights.
              </p>
            </div>

            {/* Trip Selection */}
            {trips.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="trip" className="text-sm font-medium flex items-center gap-1.5 pt-1">
                  <Plane className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('expense.selectTrip')}
                </Label>
                <Select
                  value={tripId || 'none'}
                  onValueChange={(value) => {
                    const nextTripId = value === 'none' ? '' : value || ''
                    if (nextTripId !== tripId) {
                      setSharedGroupExpense(false)
                    }
                    setTripId(nextTripId)
                  }}
                >
                  <SelectTrigger className="rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background">
                    <SelectValue placeholder={t('expense.selectTrip')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('expense.noTrip')}</SelectItem>
                    {trips.map(trip => (
                      <SelectItem key={trip.id} value={trip.id}>{trip.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedTrip && (
              <div className="space-y-2 rounded-xl border border-border/40 bg-muted/15 p-4">
                <Label htmlFor="trip-expense-scope" className="flex items-center gap-1.5 text-sm font-medium">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  Trip Expense Scope
                </Label>
                <Select
                  value={sharedGroupExpense ? 'shared-group' : 'personal'}
                  onValueChange={(value) => setSharedGroupExpense(value === 'shared-group')}
                >
                  <SelectTrigger
                    id="trip-expense-scope"
                    className="rounded-xl border-border/60 bg-background/80 transition-all focus:bg-background"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="shared-group">Shared Friend Group</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {sharedGroupExpense
                    ? `This expense will count toward ${selectedTrip.groupName || 'the shared friend group fund'} for ${selectedTrip.name}.`
                    : `This expense stays as your personal cost inside ${selectedTrip.name}.`}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-border/40 mt-2">
              <Button
                type="submit"
                className="flex-1 rounded-xl bg-gradient-to-r from-primary to-primary/85 shadow-sm shadow-primary/20 transition-all hover:shadow-md hover:shadow-primary/25"
                disabled={isSubmitDisabled}
              >
                {isSubmitting ? `${t('common.save')}...` : (initialData ? t('common.edit') : t('common.add'))}
              </Button>
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl border-border/60">
                  {t('common.cancel')}
                </Button>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
