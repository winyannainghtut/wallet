'use client'

import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Sparkles, Wand2, Plane, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CATEGORIES, Category, Expense, TripMember, getCategoryLabel } from '@/types'
import { useApp } from '@/contexts/AppContext'
import { isAiKeyNotConfiguredError, parseExpenseText, suggestCategory } from '@/lib/ai-client'
import { t, getLanguage } from '@/i18n/config'
import {
  convertBaseAmountToTripCurrency,
  getTripDisplayCurrency,
  hasTripCurrencyConfig,
} from '@/lib/trips'
import { getCurrencyDisplayLabel } from '@/lib/settings'

interface ExpenseFormProps {
  initialData?: Expense
  onSubmit: (data: Omit<Expense, 'id' | 'createdAt'>) => void
  onCancel?: () => void
  isSubmitting?: boolean
}

type AccountOption = {
  id: string
  name: string
  currency: string
  isActive: boolean
}

function formatEditableAmount(value: number): string {
  if (!Number.isFinite(value)) {
    return ''
  }

  return value
    .toFixed(4)
    .replace(/\.?0+$/, '')
}

function getHistoricalTripExchangeRate(
  initialExpense: Expense | undefined,
  tripId: string,
  tripCurrency: string
): number | null {
  if (!initialExpense || initialExpense.tripId !== tripId) {
    return null
  }

  if (
    typeof initialExpense.sourceExchangeRate !== 'number' ||
    !Number.isFinite(initialExpense.sourceExchangeRate) ||
    initialExpense.sourceExchangeRate <= 0
  ) {
    return null
  }

  if (
    typeof initialExpense.sourceCurrency === 'string' &&
    initialExpense.sourceCurrency.trim().toUpperCase() !== tripCurrency.trim().toUpperCase()
  ) {
    return null
  }

  return initialExpense.sourceExchangeRate
}

export function ExpenseForm({ initialData, onSubmit, onCancel, isSubmitting = false }: ExpenseFormProps) {
  const { trips, settings, customCategories, addCustomCategory } = useApp()
  const expenseCustomCategories = customCategories.filter(c => c.type === 'expense')
  const initialTrip = initialData?.tripId ? trips.find((trip) => trip.id === initialData.tripId) : undefined
  const [mode, setMode] = useState<'manual' | 'magic'>('manual')
  const [magicText, setMagicText] = useState('')
  const [isParsing, setIsParsing] = useState(false)

  const [amount, setAmount] = useState(() => {
    if (!initialData) {
      return ''
    }

    if (hasTripCurrencyConfig(initialTrip)) {
      const initialSourceAmount =
        typeof initialData.sourceAmount === 'number' && Number.isFinite(initialData.sourceAmount) && initialData.sourceAmount > 0
          ? initialData.sourceAmount
          : convertBaseAmountToTripCurrency(initialData.amount, initialTrip)
      return formatEditableAmount(initialSourceAmount)
    }

    return formatEditableAmount(initialData.amount)
  })
  const [category, setCategory] = useState<Category | ''>(initialData?.category || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [date, setDate] = useState(initialData?.date || format(new Date(), 'yyyy-MM-dd'))
  const [tripId, setTripId] = useState(initialData?.tripId || '')
  const [sharedGroupExpense, setSharedGroupExpense] = useState(initialData?.sharedGroupExpense === true)
  const [paidByMemberId, setPaidByMemberId] = useState(initialData?.paidByMemberId || '')
  const [accountId, setAccountId] = useState(initialData?.accountId || '')
  const [tripMembers, setTripMembers] = useState<TripMember[]>([])
  const [isTripMembersLoading, setIsTripMembersLoading] = useState(false)
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [isSuggesting, setIsSuggesting] = useState(false)
  
  const language = getLanguage()
  const baseCurrencyLabel = getCurrencyDisplayLabel(settings)
  const selectedTrip = trips.find((trip) => trip.id === tripId)
  const tripHasCurrencyConfig = hasTripCurrencyConfig(selectedTrip)
  const tripCurrencyLabel = getTripDisplayCurrency(selectedTrip, settings.currency)
  const effectiveTripExchangeRate =
    tripHasCurrencyConfig
      ? getHistoricalTripExchangeRate(initialData, tripId, tripCurrencyLabel) ?? selectedTrip?.exchangeRate ?? null
      : null
  const selectedPayer = tripMembers.find((member) => member.id === paidByMemberId)
  const selectedPayerLabel = selectedPayer
    ? `${selectedPayer.name}${selectedPayer.isOwner ? ' (You)' : ''}`
    : undefined
  const parsedDisplayedAmount = Number.parseFloat(amount)
  const convertedBaseAmountPreview =
    tripHasCurrencyConfig &&
    typeof effectiveTripExchangeRate === 'number' &&
    Number.isFinite(parsedDisplayedAmount) &&
    parsedDisplayedAmount > 0
      ? parsedDisplayedAmount * effectiveTripExchangeRate
      : null

  useEffect(() => {
    let cancelled = false

    const loadTripMembers = async () => {
      if (!tripId) {
        setTripMembers([])
        setPaidByMemberId('')
        return
      }

      try {
        setIsTripMembersLoading(true)
        const response = await fetch(`/api/trip-members?tripId=${encodeURIComponent(tripId)}&perPage=200`)
        const data = await response.json() as { items?: Array<{
          id?: string
          trip?: string
          name?: string
          isOwner?: boolean
          sortOrder?: number
          created?: string
          updated?: string
        }>, error?: string }
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load trip members')
        }

        const normalized = (data.items ?? [])
          .filter((item) => item.id && item.trip === tripId && item.name)
          .map((item) => ({
            id: item.id as string,
            tripId,
            name: item.name as string,
            isOwner: item.isOwner === true,
            sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : undefined,
            createdAt: item.created ?? new Date().toISOString(),
            updatedAt: item.updated,
          }))
          .sort((a, b) => {
            if (a.isOwner && !b.isOwner) return -1
            if (!a.isOwner && b.isOwner) return 1
            return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
          })

        if (cancelled) return
        setTripMembers(normalized)

        if (normalized.length === 0) {
          setPaidByMemberId('')
          return
        }

        setPaidByMemberId((current) => (
          current && normalized.some((member) => member.id === current)
            ? current
            : normalized[0].id
        ))
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load trip members:', error)
          setTripMembers([])
          setPaidByMemberId('')
        }
      } finally {
        if (!cancelled) {
          setIsTripMembersLoading(false)
        }
      }
    }

    void loadTripMembers()

    return () => {
      cancelled = true
    }
  }, [tripId])

  useEffect(() => {
    let cancelled = false

    const loadAccounts = async () => {
      try {
        const response = await fetch('/api/accounts?perPage=200')
        if (!response.ok) {
          return
        }

        const data = await response.json() as { items?: AccountOption[] }
        if (!cancelled) {
          setAccounts((data.items ?? []).filter((account) => account.isActive !== false))
        }
      } catch {
        if (!cancelled) {
          setAccounts([])
        }
      }
    }

    void loadAccounts()

    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !category || isSubmitting) return

    const displayedAmount = Number.parseFloat(amount)
    if (!Number.isFinite(displayedAmount) || displayedAmount <= 0) {
      return
    }

    const normalizedTripId = tripId.trim()

    if (normalizedTripId && sharedGroupExpense && !paidByMemberId) {
      alert('Select who paid for this shared expense.')
      return
    }

    const nextAmount = tripHasCurrencyConfig
      ? displayedAmount * (effectiveTripExchangeRate ?? 1)
      : displayedAmount

    onSubmit({
      amount: Number(nextAmount.toFixed(6)),
      sourceAmount: tripHasCurrencyConfig ? displayedAmount : undefined,
      sourceCurrency: tripHasCurrencyConfig ? tripCurrencyLabel : undefined,
      sourceExchangeRate: tripHasCurrencyConfig ? effectiveTripExchangeRate ?? undefined : undefined,
      category: category as Category,
      description,
      date,
      accountId: accountId || undefined,
      tripId: normalizedTripId,
      sharedGroupExpense: normalizedTripId ? sharedGroupExpense : false,
      paidByMemberId: normalizedTripId && sharedGroupExpense ? paidByMemberId : undefined,
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
        const parsedAmount = tripHasCurrencyConfig
          ? convertBaseAmountToTripCurrency(parsed.amount, selectedTrip)
          : parsed.amount
        setAmount(formatEditableAmount(parsedAmount))
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
                {t('expense.magicAddHint')}
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
                  placeholder={tripHasCurrencyConfig ? `e.g. 150 ${tripCurrencyLabel}` : t('expense.amountPlaceholder')}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background"
                />
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    {selectedTrip && tripHasCurrencyConfig
                      ? `Saved in ${tripCurrencyLabel} for ${selectedTrip.name}.`
                      : `Saved in ${baseCurrencyLabel}.`}
                  </p>
                  {selectedTrip && tripHasCurrencyConfig && typeof selectedTrip.exchangeRate === 'number' && (
                    <>
                      <p>{`1 ${tripCurrencyLabel} = ${(effectiveTripExchangeRate ?? selectedTrip.exchangeRate).toFixed(4)} ${baseCurrencyLabel}`}</p>
                      {convertedBaseAmountPreview !== null && (
                        <p>{`Base amount preview: ${convertedBaseAmountPreview.toFixed(2)} ${baseCurrencyLabel}`}</p>
                      )}
                      {initialData && typeof effectiveTripExchangeRate === 'number' && typeof selectedTrip.exchangeRate === 'number' && Math.abs(effectiveTripExchangeRate - selectedTrip.exchangeRate) > 1e-9 && (
                        <p>{`Editing keeps the saved historical rate instead of the trip's current rate (${selectedTrip.exchangeRate.toFixed(4)}).`}</p>
                      )}
                    </>
                  )}
                </div>
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
                {t('expense.descriptionHint')}
              </p>
            </div>

            {accounts.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="expense-account" className="text-sm font-medium">Account</Label>
                <Select value={accountId || 'none'} onValueChange={(value) => setAccountId(!value || value === 'none' ? '' : value)}>
                  <SelectTrigger id="expense-account" className="rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No account</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} ({account.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
                    const nextTrip = trips.find((trip) => trip.id === nextTripId)
                    const parsedAmount = Number.parseFloat(amount)

                    if (Number.isFinite(parsedAmount) && parsedAmount > 0) {
                      const currentBaseAmount = tripHasCurrencyConfig
                        ? parsedAmount * (effectiveTripExchangeRate ?? 1)
                        : parsedAmount
                      const nextDisplayedAmount = hasTripCurrencyConfig(nextTrip)
                        ? convertBaseAmountToTripCurrency(currentBaseAmount, nextTrip)
                        : currentBaseAmount
                      setAmount(formatEditableAmount(nextDisplayedAmount))
                    }

                    if (nextTripId !== tripId) {
                      setSharedGroupExpense(false)
                      setPaidByMemberId('')
                    }
                    setTripId(nextTripId)
                  }}
                >
                  <SelectTrigger className="rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background">
                    <SelectValue placeholder={t('expense.selectTrip')}>
                      {selectedTrip?.name}
                    </SelectValue>
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
                  {t('expense.tripExpenseScope')}
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
                    <SelectItem value="personal">{t('expense.personal')}</SelectItem>
                    <SelectItem value="shared-group">{t('expense.sharedGroup')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {sharedGroupExpense
                    ? `This expense will count toward ${selectedTrip.groupName || 'the shared friend group fund'} for ${selectedTrip.name}.`
                    : `This expense stays as your personal cost inside ${selectedTrip.name}.`}
                </p>
                {tripHasCurrencyConfig && (
                  <p className="text-xs text-muted-foreground">
                    {`Trip spending is tracked in ${tripCurrencyLabel} using manual rate ${(effectiveTripExchangeRate ?? selectedTrip.exchangeRate ?? 0).toFixed(4)} ${baseCurrencyLabel} per ${tripCurrencyLabel}.`}
                  </p>
                )}
                {sharedGroupExpense && (
                  <div className="space-y-2 pt-1">
                    <Label htmlFor="trip-paid-by" className="text-sm font-medium">
                      {t('expense.paidBy')}
                    </Label>
                    <Select
                      value={paidByMemberId || undefined}
                      onValueChange={(value) => setPaidByMemberId(value || '')}
                      disabled={isTripMembersLoading || tripMembers.length === 0}
                    >
                      <SelectTrigger
                        id="trip-paid-by"
                        className="rounded-xl border-border/60 bg-background/80 transition-all focus:bg-background"
                      >
                        <SelectValue placeholder={tripMembers.length === 0 ? t('expense.addTripMembersFirst') : t('expense.selectPayer')}>
                          {selectedPayerLabel}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {tripMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name}{member.isOwner ? ' (You)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {tripMembers.length === 0
                        ? t('expense.addTripMembersHint')
                        : t('expense.payerHint')}
                    </p>
                  </div>
                )}
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
