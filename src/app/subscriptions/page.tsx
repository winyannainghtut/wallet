'use client'

import React, { useState } from 'react'
import { PlusCircle, Repeat, CalendarIcon, Trash2, Edit2, CheckCircle2, PauseCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { CATEGORIES, Subscription, BillingCycle, Category } from '@/types'
import { useApp } from '@/contexts/AppContext'
import { t, getLanguage } from '@/i18n/config'
import { format } from 'date-fns'

export default function SubscriptionsPage() {
  const { subscriptions, addSubscription, updateSubscription, deleteSubscription, settings } = useApp()
  const language = getLanguage()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSub, setEditingSub] = useState<Subscription | null>(null)
  const [subForm, setSubForm] = useState<Partial<Subscription>>({
    name: '',
    amount: 0,
    category: 'entertainment',
    billingCycle: 'monthly',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    isActive: true
  })

  // Calculate total monthly cost
  const totalMonthly = subscriptions
    .filter(s => s.isActive)
    .reduce((total, s) => {
      let monthlyEquivalent = s.amount
      if (s.billingCycle === 'yearly') monthlyEquivalent = s.amount / 12
      if (s.billingCycle === 'weekly') monthlyEquivalent = s.amount * 4.33
      return total + monthlyEquivalent
    }, 0)

  const handleOpenDialog = (sub?: Subscription) => {
    if (sub) {
      setEditingSub(sub)
      setSubForm(sub)
    } else {
      setEditingSub(null)
      setSubForm({
        name: '',
        amount: 0,
        category: 'entertainment',
        billingCycle: 'monthly',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        isActive: true
      })
    }
    setIsDialogOpen(true)
  }

  const handleSave = () => {
    if (!subForm.name || !subForm.amount || !subForm.startDate || !subForm.category || !subForm.billingCycle) return

    if (editingSub) {
      updateSubscription(editingSub.id, subForm as Partial<Omit<Subscription, 'id' | 'createdAt'>>)
    } else {
      addSubscription(subForm as Omit<Subscription, 'id' | 'createdAt'>)
    }

    setIsDialogOpen(false)
  }

  const handleDelete = (id: string) => {
    if (confirm(t('subscriptions.deleteConfirm'))) {
      deleteSubscription(id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('subscriptions.title')}</h1>
          <p className="text-muted-foreground">{t('subscriptions.subtitle')}</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="rounded-xl bg-gradient-to-r from-primary to-primary/85 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25">
          <PlusCircle className="mr-2 h-4 w-4" />
          {t('subscriptions.addSubscription')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card className="border-border/40 bg-gradient-to-br from-primary/5 to-accent/5 backdrop-blur-xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-primary">
                <Repeat className="h-4 w-4" />
                {t('subscriptions.totalMonthly')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tabular-nums">
                {Math.round(totalMonthly).toLocaleString()} <span className="text-lg font-semibold text-muted-foreground">{settings.currency}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-4">
          {subscriptions.length === 0 ? (
            <Card className="border-dashed border-border/60 bg-transparent flex flex-col items-center justify-center h-[200px]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-3">
                <Repeat className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">{t('subscriptions.noSubscriptions')}</h3>
              <p className="text-sm text-muted-foreground">{t('subscriptions.noSubscriptionsSubtitle')}</p>
              <Button variant="link" onClick={() => handleOpenDialog()} className="mt-2 text-primary">
                {t('subscriptions.addSubscription')}
              </Button>
            </Card>
          ) : (
            subscriptions.map(sub => (
              <Card key={sub.id} className="group border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${sub.isActive ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'}`}>
                        <Repeat className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-base">{sub.name}</h3>
                        <p className="text-sm text-muted-foreground capitalize flex items-center gap-1.5">
                          {t(`subscriptions.${sub.billingCycle}`)} • Next: {sub.startDate}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0">
                      <div className="text-left sm:text-right">
                        <div className={`text-lg font-bold tabular-nums ${sub.isActive ? '' : 'opacity-50 line-through'}`}>
                          {sub.amount.toLocaleString()} <span className="text-sm font-semibold text-muted-foreground">{settings.currency}</span>
                        </div>
                        <div className={`text-xs font-medium flex items-center gap-1 mt-0.5 ${sub.isActive ? 'text-green-500' : 'text-muted-foreground'}`}>
                          {sub.isActive ? <CheckCircle2 className="h-3 w-3" /> : <PauseCircle className="h-3 w-3" />}
                          {sub.isActive ? t('subscriptions.active') : t('subscriptions.paused')}
                        </div>
                      </div>

                      <div className="flex gap-1 opacity-100 sm:opacity-50 transition-opacity group-hover:opacity-100">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(sub)} className="h-8 w-8 rounded-lg">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(sub.id)} className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingSub ? t('subscriptions.editSubscription') : t('subscriptions.addSubscription')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>{t('subscriptions.name')}</Label>
              <Input
                placeholder="Netflix, Spotify..."
                value={subForm.name}
                onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('subscriptions.amount')} ({settings.currency})</Label>
                <Input
                  type="number"
                  value={subForm.amount || ''}
                  onChange={(e) => setSubForm({ ...subForm, amount: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('subscriptions.billingCycle')}</Label>
                <Select value={subForm.billingCycle} onValueChange={(v) => setSubForm({ ...subForm, billingCycle: v as BillingCycle })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{t('subscriptions.monthly')}</SelectItem>
                    <SelectItem value="yearly">{t('subscriptions.yearly')}</SelectItem>
                    <SelectItem value="weekly">{t('subscriptions.weekly')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('subscriptions.category')}</Label>
                <Select value={subForm.category} onValueChange={(v) => setSubForm({ ...subForm, category: v as Category })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat /* Ideally use CATEGORY_LABELS[cat][language] but simple for now */}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('subscriptions.startDate')}</Label>
                <Input
                  type="date"
                  value={subForm.startDate}
                  onChange={(e) => setSubForm({ ...subForm, startDate: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/50 p-3 mt-2 shadow-sm">
              <div className="space-y-0.5">
                <Label>{t('subscriptions.isActive')}</Label>
                <p className="text-xs text-muted-foreground">
                  {subForm.isActive ? t('subscriptions.active') : t('subscriptions.paused')}
                </p>
              </div>
              <Switch
                checked={subForm.isActive}
                onCheckedChange={(c) => setSubForm({ ...subForm, isActive: c })}
              />
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{t('subscriptions.cancel')}</Button>
            <Button onClick={handleSave}>{t('subscriptions.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
