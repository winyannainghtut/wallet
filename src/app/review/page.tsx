'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Pencil, PlusCircle, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApp } from '@/contexts/AppContext'
import { AccountRecord } from '@/lib/accounts'
import { TransactionRuleRecord } from '@/lib/transaction-rules'
import { CATEGORIES, INCOME_CATEGORIES, getCategoryLabel, getIncomeCategoryLabel } from '@/types'
import { getLanguage, t } from '@/i18n/config'

type ReviewItem = {
  id: string
  type: 'income' | 'expense'
  amount: number
  category: string
  description: string
  date: string
  merchantName: string
  tags: string[]
  reviewStatus: 'pending' | 'reviewed' | 'ignored'
  accountId: string
}

type ReviewSummary = {
  pending: number
  reviewed: number
  ignored: number
  total: number
}

type ApiListResponse<T> = {
  items?: T[]
  error?: string
  page?: number
  perPage?: number
  totalItems?: number
  totalPages?: number
  summary?: ReviewSummary
}

type RuleFormState = {
  name: string
  matchText: string
  renameTo: string
  category: string
  tagsText: string
  markReviewed: boolean
  isActive: boolean
}

const REVIEW_PAGE_SIZE = 50
const emptyRuleForm: RuleFormState = {
  name: '',
  matchText: '',
  renameTo: '',
  category: '',
  tagsText: '',
  markReviewed: false,
  isActive: true,
}

export default function ReviewPage() {
  const { customCategories } = useApp()
  const language = getLanguage()
  const [items, setItems] = useState<ReviewItem[]>([])
  const [rules, setRules] = useState<TransactionRuleRecord[]>([])
  const [accounts, setAccounts] = useState<AccountRecord[]>([])
  const [summary, setSummary] = useState<ReviewSummary>({ pending: 0, reviewed: 0, ignored: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [reviewFilter, setReviewFilter] = useState<'pending' | 'reviewed' | 'ignored' | 'all'>('pending')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<TransactionRuleRecord | null>(null)
  const [ruleForm, setRuleForm] = useState<RuleFormState>(emptyRuleForm)
  const [isApplyingRules, setIsApplyingRules] = useState(false)
  const [savingItemId, setSavingItemId] = useState<string | null>(null)
  const [savingRule, setSavingRule] = useState(false)

  const categoryOptions = useMemo(() => {
    const expense = CATEGORIES.map((value) => ({ value, label: getCategoryLabel(value, language) }))
    const income = INCOME_CATEGORIES.map((value) => ({ value, label: getIncomeCategoryLabel(value, language) }))
    const custom = customCategories.map((value) => ({ value: value.name, label: value.name }))
    return [...expense, ...income, ...custom].filter((item, index, array) => array.findIndex((entry) => entry.value === item.value) === index)
  }, [customCategories, language])

  const getSelectableAccounts = useCallback((selectedAccountId: string) => (
    accounts.filter((account) => account.isActive !== false || account.id === selectedAccountId)
  ), [accounts])

  useEffect(() => {
    setPage(1)
  }, [reviewFilter, search])

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const query = new URLSearchParams({ page: String(page), perPage: String(REVIEW_PAGE_SIZE) })
      if (reviewFilter !== 'all') query.set('reviewStatus', reviewFilter)
      if (search.trim()) query.set('q', search.trim())

      const [itemsResponse, rulesResponse, accountsResponse] = await Promise.all([
        fetch(`/api/transactions/review?${query.toString()}`),
        fetch('/api/transaction-rules'),
        fetch('/api/accounts?perPage=500'),
      ])

      const itemsData = await itemsResponse.json() as ApiListResponse<ReviewItem>
      const rulesData = await rulesResponse.json() as ApiListResponse<TransactionRuleRecord>
      const accountsData = await accountsResponse.json() as ApiListResponse<AccountRecord>

      if (!itemsResponse.ok) throw new Error(itemsData.error || t('common.error'))
      if (!rulesResponse.ok) throw new Error(rulesData.error || t('common.error'))
      if (!accountsResponse.ok) throw new Error(accountsData.error || t('common.error'))

      setItems(itemsData.items ?? [])
      setRules(rulesData.items ?? [])
      setAccounts(accountsData.items ?? [])
      setSummary(itemsData.summary ?? { pending: 0, reviewed: 0, ignored: 0, total: 0 })
      setTotalItems(itemsData.totalItems ?? 0)
      setTotalPages(itemsData.totalPages ?? 1)
      if (typeof itemsData.page === 'number' && itemsData.page !== page) {
        setPage(itemsData.page)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('review.loadFailed'))
      setItems([])
      setRules([])
      setAccounts([])
      setSummary({ pending: 0, reviewed: 0, ignored: 0, total: 0 })
      setTotalItems(0)
      setTotalPages(1)
    } finally {
      setIsLoading(false)
    }
  }, [page, reviewFilter, search])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const updateLocalItem = (id: string, updates: Partial<ReviewItem>) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, ...updates } : item))
  }

  const saveReviewItem = async (item: ReviewItem) => {
    try {
      setSavingItemId(item.id)
      const response = await fetch(`/api/transactions/review/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantName: item.merchantName,
          category: item.category,
          tagsJson: item.tags,
          reviewStatus: item.reviewStatus,
          accountId: item.accountId || null,
        }),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error || t('common.error'))
      await loadData()
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : t('review.saveFailed'))
    } finally {
      setSavingItemId(null)
    }
  }

  const applyRules = async () => {
    try {
      setIsApplyingRules(true)
      const response = await fetch('/api/transactions/review', { method: 'POST' })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error || t('common.error'))
      await loadData()
    } catch (applyError) {
      alert(applyError instanceof Error ? applyError.message : t('review.applyRulesFailed'))
    } finally {
      setIsApplyingRules(false)
    }
  }

  const openCreateRule = () => {
    setEditingRule(null)
    setRuleForm(emptyRuleForm)
    setIsRuleDialogOpen(true)
  }

  const openEditRule = (rule: TransactionRuleRecord) => {
    setEditingRule(rule)
    setRuleForm({
      name: rule.name,
      matchText: rule.matchText,
      renameTo: rule.renameTo ?? '',
      category: rule.category ?? '',
      tagsText: rule.tags.join(', '),
      markReviewed: rule.markReviewed === true,
      isActive: rule.isActive !== false,
    })
    setIsRuleDialogOpen(true)
  }

  const saveRule = async () => {
    if (!ruleForm.name.trim() || !ruleForm.matchText.trim()) return
    try {
      setSavingRule(true)
      const response = await fetch(editingRule ? `/api/transaction-rules/${editingRule.id}` : '/api/transaction-rules', {
        method: editingRule ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ruleForm.name.trim(),
          matchText: ruleForm.matchText.trim(),
          renameTo: ruleForm.renameTo.trim(),
          category: ruleForm.category,
          tagsJson: ruleForm.tagsText.split(',').map((tag) => tag.trim()).filter(Boolean),
          markReviewed: ruleForm.markReviewed,
          isActive: ruleForm.isActive,
        }),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error || t('common.error'))
      setIsRuleDialogOpen(false)
      await loadData()
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : t('review.saveRuleFailed'))
    } finally {
      setSavingRule(false)
    }
  }

  const deleteRule = async (rule: TransactionRuleRecord) => {
    if (!confirm(t('common.deleteConfirm', { name: rule.name }))) return
    const response = await fetch(`/api/transaction-rules/${rule.id}`, { method: 'DELETE' })
    const data = await response.json() as { error?: string }
    if (!response.ok) {
      alert(data.error || t('review.deleteRuleFailed'))
      return
    }
    await loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('review.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('review.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => void applyRules()} disabled={isApplyingRules}>
            <Sparkles className="mr-2 h-4 w-4" />
            {isApplyingRules ? t('review.applying') : t('review.applyRules')}
          </Button>
          <Button className="rounded-xl" onClick={openCreateRule}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {t('review.addRule')}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">{t('review.queueTab')} ({summary.pending})</TabsTrigger>
          <TabsTrigger value="rules">{t('review.rulesTab')} ({rules.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-border/40"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('review.pending')}</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{summary.pending}</CardContent></Card>
            <Card className="border-border/40"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('review.reviewed')}</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{summary.reviewed}</CardContent></Card>
            <Card className="border-border/40"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('review.ignored')}</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{summary.ignored}</CardContent></Card>
            <Card className="border-border/40"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('review.visible')}</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{totalItems}</CardContent></Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('review.searchPlaceholder')} className="rounded-xl md:col-span-2" />
            <Select value={reviewFilter} onValueChange={(value) => setReviewFilter(value as typeof reviewFilter)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">{t('review.pending')}</SelectItem>
                <SelectItem value="reviewed">{t('review.reviewed')}</SelectItem>
                <SelectItem value="ignored">{t('review.ignored')}</SelectItem>
                <SelectItem value="all">{t('review.all')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? <Card className="border-border/40"><CardContent className="py-10 text-sm text-muted-foreground">{t('common.loading')}...</CardContent></Card> : items.length === 0 ? <Card className="border-dashed border-border/50"><CardContent className="py-10 text-sm text-muted-foreground">{t('review.noItems')}</CardContent></Card> : (
            <div className="space-y-4">
              {items.map((item) => (
                <Card key={item.id} className="border-border/40">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold">{item.description || item.merchantName || item.category}</p>
                        <p className="text-sm text-muted-foreground">{item.date} | {item.type === 'income' ? t('review.typeIncome') : t('review.typeExpense')} | {item.amount.toFixed(2)}</p>
                      </div>
                      <div className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{t(`review.${item.reviewStatus}`)}</div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="space-y-2"><Label>{t('review.merchant')}</Label><Input value={item.merchantName} onChange={(event) => updateLocalItem(item.id, { merchantName: event.target.value })} className="rounded-xl" /></div>
                      <div className="space-y-2"><Label>{t('common.category')}</Label><Select value={item.category} onValueChange={(value) => updateLocalItem(item.id, { category: value ?? item.category })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{categoryOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-2"><Label>{t('review.tags')}</Label><Input value={item.tags.join(', ')} onChange={(event) => updateLocalItem(item.id, { tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} className="rounded-xl" /></div>
                      <div className="space-y-2"><Label>{t('review.account')}</Label><Select value={item.accountId || 'none'} onValueChange={(value) => updateLocalItem(item.id, { accountId: !value || value === 'none' ? '' : value })}><SelectTrigger className="rounded-xl"><SelectValue placeholder={t('review.noAccount')} /></SelectTrigger><SelectContent><SelectItem value="none">{t('review.noAccount')}</SelectItem>{getSelectableAccounts(item.accountId).map((account) => <SelectItem key={account.id} value={account.id}>{account.name}{account.isActive === false ? ` (${t('common.inactive')})` : ''}</SelectItem>)}</SelectContent></Select></div>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Select value={item.reviewStatus} onValueChange={(value) => updateLocalItem(item.id, { reviewStatus: value as ReviewItem['reviewStatus'] })}><SelectTrigger className="w-full rounded-xl sm:w-[180px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">{t('review.pending')}</SelectItem><SelectItem value="reviewed">{t('review.reviewed')}</SelectItem><SelectItem value="ignored">{t('review.ignored')}</SelectItem></SelectContent></Select>
                      <Button className="rounded-xl" onClick={() => void saveReviewItem(item)} disabled={savingItemId === item.id}><CheckCircle2 className="mr-2 h-4 w-4" />{savingItemId === item.id ? `${t('common.save')}...` : t('review.saveReview')}</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && totalPages > 1 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">{`${t('common.total')}: ${summary.total}`}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="rounded-xl" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>{t('common.prev')}</Button>
                <span className="min-w-[88px] text-center text-sm text-muted-foreground">{page} / {totalPages}</span>
                <Button variant="outline" className="rounded-xl" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page >= totalPages}>{t('common.next')}</Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="rules" className="space-y-4 pt-4">
          {rules.length === 0 ? <Card className="border-dashed border-border/50"><CardContent className="py-10 text-sm text-muted-foreground">{t('review.noRules')}</CardContent></Card> : (
            <div className="space-y-4">
              {rules.map((rule) => (
                <Card key={rule.id} className="border-border/40">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{rule.name}</p>
                        <p className="text-sm text-muted-foreground">{t('review.matches')}: {rule.matchText}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEditRule(rule)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => void deleteRule(rule)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {rule.renameTo && <span className="rounded-full bg-muted px-3 py-1">{t('review.renameTo')}: {rule.renameTo}</span>}
                      {rule.category && <span className="rounded-full bg-muted px-3 py-1">{t('common.category')}: {rule.category}</span>}
                      {rule.tags.map((tag) => <span key={tag} className="rounded-full bg-muted px-3 py-1">#{tag}</span>)}
                      {rule.markReviewed && <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-700">{t('review.autoReviewed')}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader><DialogTitle>{editingRule ? t('review.editRule') : t('review.addRule')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label htmlFor="rule-name">{t('common.name')}</Label><Input id="rule-name" value={ruleForm.name} onChange={(event) => setRuleForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="rule-match">{t('review.matchText')}</Label><Input id="rule-match" value={ruleForm.matchText} onChange={(event) => setRuleForm((prev) => ({ ...prev, matchText: event.target.value }))} placeholder={t('review.matchPlaceholder')} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="rule-rename">{t('review.renameMerchant')}</Label><Input id="rule-rename" value={ruleForm.renameTo} onChange={(event) => setRuleForm((prev) => ({ ...prev, renameTo: event.target.value }))} /></div>
              <div className="space-y-2"><Label>{t('common.category')}</Label><Select value={ruleForm.category || 'none'} onValueChange={(value) => setRuleForm((prev) => ({ ...prev, category: !value || value === 'none' ? '' : value }))}><SelectTrigger><SelectValue placeholder={t('review.categoryOptional')} /></SelectTrigger><SelectContent><SelectItem value="none">{t('review.noCategoryChange')}</SelectItem>{categoryOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label htmlFor="rule-tags">{t('review.tags')}</Label><Input id="rule-tags" value={ruleForm.tagsText} onChange={(event) => setRuleForm((prev) => ({ ...prev, tagsText: event.target.value }))} placeholder={t('review.tagsPlaceholder')} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border border-border/40 p-3"><div><p className="text-sm font-medium">{t('review.autoMarkReviewed')}</p></div><Switch checked={ruleForm.markReviewed} onCheckedChange={(checked) => setRuleForm((prev) => ({ ...prev, markReviewed: checked }))} /></div>
              <div className="flex items-center justify-between rounded-xl border border-border/40 p-3"><div><p className="text-sm font-medium">{t('review.ruleActive')}</p></div><Switch checked={ruleForm.isActive} onCheckedChange={(checked) => setRuleForm((prev) => ({ ...prev, isActive: checked }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRuleDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => void saveRule()} disabled={savingRule}>{savingRule ? `${t('common.save')}...` : t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
