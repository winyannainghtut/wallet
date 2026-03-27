'use client'

import React, { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { INCOME_CATEGORIES, INCOME_CATEGORY_LABELS, Income, IncomeCategory } from '@/types'
import { useApp } from '@/contexts/AppContext'
import { t, getLanguage } from '@/i18n/config'

interface IncomeFormProps {
  initialData?: Income
  onSubmit: (data: Omit<Income, 'id' | 'createdAt'>) => void
  onCancel?: () => void
  isSubmitting?: boolean
}

type AccountOption = {
  id: string
  name: string
  currency: string
  isActive: boolean
}

export function IncomeForm({ initialData, onSubmit, onCancel, isSubmitting = false }: IncomeFormProps) {
  const { customCategories } = useApp()
  const incomeCustomCategories = customCategories.filter(c => c.type === 'income')

  const [amount, setAmount] = useState(initialData?.amount?.toString() || '')
  const [category, setCategory] = useState<IncomeCategory>(initialData?.category || 'salary')
  const [description, setDescription] = useState(initialData?.description || '')
  const [date, setDate] = useState(initialData?.date || format(new Date(), 'yyyy-MM-dd'))
  const [accountId, setAccountId] = useState(initialData?.accountId || '')
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const selectableAccounts = accounts.filter((account) => account.isActive !== false || account.id === accountId)
  
  const language = getLanguage()

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
          setAccounts(data.items ?? [])
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

    onSubmit({
      amount: parseFloat(amount),
      category,
      description,
      date,
      accountId: accountId || undefined,
    })
  }

  const isSubmitDisabled = !amount || !category || isSubmitting

  return (
    <Card className="border-border/40">
      <CardHeader>
        <CardTitle className="text-lg">
          {initialData ? t('income.editIncome') : t('income.addIncome')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5 animate-in fade-in duration-300">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="income-amount" className="text-sm font-medium">{t('common.amount')} *</Label>
              <Input
                id="income-amount"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background"
              />
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="income-date" className="text-sm font-medium">{t('common.date')} *</Label>
              <Input
                id="income-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background"
              />
            </div>
          </div>

          {(selectableAccounts.length > 0 || Boolean(accountId)) && (
            <div className="space-y-2">
              <Label htmlFor="income-account" className="text-sm font-medium">{t('income.account')}</Label>
              <Select value={accountId || 'none'} onValueChange={(value) => setAccountId(!value || value === 'none' ? '' : value)}>
                <SelectTrigger id="income-account" className="rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background">
                  <SelectValue placeholder={t('income.selectAccount')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('income.noAccount')}</SelectItem>
                  {selectableAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.currency}){account.isActive === false ? ` - ${t('common.inactive')}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="income-category" className="text-sm font-medium">{t('common.category')} *</Label>
            <Select value={category} onValueChange={(v) => v && setCategory(v as IncomeCategory)} required>
              <SelectTrigger id="income-category" className="rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background">
                <SelectValue placeholder={t('common.category')} />
              </SelectTrigger>
              <SelectContent>
                {INCOME_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {INCOME_CATEGORY_LABELS[cat]?.[language] ?? cat}
                  </SelectItem>
                ))}
                {incomeCustomCategories.length > 0 && (
                  <>
                    <div className="h-px bg-border/40 my-1 mx-2" />
                    {incomeCustomCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="income-description" className="text-sm font-medium">{t('common.description')}</Label>
            <Input
              id="income-description"
              placeholder={t('income.descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border/40 mt-2">
            <Button
              type="submit"
              className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-sm shadow-emerald-500/20 transition-all hover:shadow-md hover:shadow-emerald-500/25"
              disabled={isSubmitDisabled}
            >
              {isSubmitting ? `${t('common.save')}...` : (initialData ? t('common.save') : t('income.addIncome'))}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl border-border/60">
                {t('common.cancel')}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
