'use client'

import React, { useState, useMemo } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isToday,
  isSameMonth,
  startOfWeek,
  endOfWeek,
  differenceInCalendarDays,
  getDaysInMonth
} from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarDays, Plane, TrendingDown, TrendingUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useApp } from '@/contexts/AppContext'
import { t, getLanguage } from '@/i18n/config'
import { Category, Subscription, getCategoryLabel } from '@/types'

const CATEGORY_COLORS: Record<Category, string> = {
  groceries: 'bg-green-500',
  breakfast: 'bg-amber-400',
  lunch: 'bg-orange-500',
  dinner: 'bg-red-500',
  transportation: 'bg-blue-500',
  shopping: 'bg-pink-500',
  donations: 'bg-purple-500',
  insurance: 'bg-cyan-500',
  utilities: 'bg-yellow-500',
  entertainment: 'bg-indigo-500',
  health: 'bg-emerald-500',
  education: 'bg-teal-500',
  other: 'bg-gray-500'
}

type CalendarEntry = {
  id: string
  amount: number
  category?: Category
  description: string
  date: string
  kind: 'expense' | 'subscription' | 'income' | 'trip'
}

function normalizeDateString(rawDate: string): string {
  const datePartMatch = rawDate.match(/^(\d{4}-\d{2}-\d{2})/)
  if (datePartMatch?.[1]) return datePartMatch[1]

  const parsed = new Date(rawDate)
  if (!Number.isNaN(parsed.getTime())) {
    return format(parsed, 'yyyy-MM-dd')
  }

  return rawDate
}

function parseDateOnly(rawDate: string): Date | null {
  const normalized = normalizeDateString(rawDate)
  const parsed = new Date(`${normalized}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function isSubscriptionDueOnDay(subscription: Subscription, day: Date, startDate: Date): boolean {
  if (day < startDate) return false

  if (subscription.billingCycle === 'weekly') {
    return differenceInCalendarDays(day, startDate) % 7 === 0
  }

  if (subscription.billingCycle === 'monthly') {
    const targetDay = Math.min(startDate.getDate(), getDaysInMonth(day))
    return day.getDate() === targetDay
  }

  if (day.getMonth() !== startDate.getMonth()) return false
  const targetDay = Math.min(startDate.getDate(), getDaysInMonth(day))
  return day.getDate() === targetDay
}

export default function CalendarPage() {
  const { expenses, incomes, subscriptions, trips, settings } = useApp()
  const language = getLanguage()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Get days for the calendar grid (including padding days from prev/next month)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const gridStart = startOfWeek(monthStart)
    const gridEnd = endOfWeek(monthEnd)
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [currentMonth])

  // Build a map of date -> calendar entries (expenses + recurring subscriptions + trips)
  const entriesByDate = useMemo(() => {
    const map: Record<string, CalendarEntry[]> = {}

    const pushEntry = (entry: CalendarEntry) => {
      if (!map[entry.date]) map[entry.date] = []
      map[entry.date].push(entry)
    }

    for (const exp of expenses) {
      const date = normalizeDateString(exp.date)
      pushEntry({
        id: exp.id,
        amount: exp.amount,
        category: exp.category,
        description: exp.description,
        date,
        kind: 'expense',
      })
    }

    for (const income of incomes) {
      const date = normalizeDateString(income.date)
      pushEntry({
        id: income.id,
        amount: income.amount,
        description: income.description,
        date,
        kind: 'income',
      })
    }

    const activeSubscriptions = subscriptions.filter((sub) => sub.isActive)
    for (const sub of activeSubscriptions) {
      const startDate = parseDateOnly(sub.startDate)
      if (!startDate) continue

      for (const day of calendarDays) {
        const dayDate = new Date(`${format(day, 'yyyy-MM-dd')}T00:00:00`)
        if (!isSubscriptionDueOnDay(sub, dayDate, startDate)) continue

        const dayKey = format(dayDate, 'yyyy-MM-dd')
        pushEntry({
          id: `subscription-${sub.id}-${dayKey}`,
          amount: sub.amount,
          category: sub.category,
          description: sub.name,
          date: dayKey,
          kind: 'subscription',
        })
      }
    }

    for (const trip of trips) {
      const startDate = parseDateOnly(trip.startDate)
      const endDate = parseDateOnly(trip.endDate)
      if (!startDate || !endDate) continue

      const rangeStart = startDate <= endDate ? startDate : endDate
      const rangeEnd = startDate <= endDate ? endDate : startDate

      for (const day of calendarDays) {
        const dayDate = new Date(`${format(day, 'yyyy-MM-dd')}T00:00:00`)
        if (dayDate < rangeStart || dayDate > rangeEnd) continue

        const dayKey = format(dayDate, 'yyyy-MM-dd')
        pushEntry({
          id: `trip-${trip.id}-${dayKey}`,
          amount: 0,
          description: trip.name,
          date: dayKey,
          kind: 'trip',
        })
      }
    }

    return map
  }, [expenses, incomes, subscriptions, trips, calendarDays])

  // Monthly totals and net comparison
  const monthlyExpenseTotal = useMemo(() => {
    const monthStr = format(currentMonth, 'yyyy-MM')
    return Object.entries(entriesByDate)
      .filter(([date]) => date.startsWith(monthStr))
      .flatMap(([, entries]) => entries)
      .filter((entry) => entry.kind === 'expense' || entry.kind === 'subscription')
      .reduce((sum, entry) => sum + entry.amount, 0)
  }, [entriesByDate, currentMonth])

  const monthlyIncomeTotal = useMemo(() => {
    const monthStr = format(currentMonth, 'yyyy-MM')
    return Object.entries(entriesByDate)
      .filter(([date]) => date.startsWith(monthStr))
      .flatMap(([, entries]) => entries)
      .filter((entry) => entry.kind === 'income')
      .reduce((sum, entry) => sum + entry.amount, 0)
  }, [entriesByDate, currentMonth])

  const monthlyNetSavings = monthlyIncomeTotal - monthlyExpenseTotal

  // Selected day expenses
  const selectedEntries = useMemo(
    () => (selectedDate ? (entriesByDate[selectedDate] || []) : []),
    [entriesByDate, selectedDate]
  )
  const selectedExpenseTotal = selectedEntries
    .filter((entry) => entry.kind === 'expense' || entry.kind === 'subscription')
    .reduce((sum, entry) => sum + entry.amount, 0)
  const selectedIncomeTotal = selectedEntries
    .filter((entry) => entry.kind === 'income')
    .reduce((sum, entry) => sum + entry.amount, 0)
  const selectedNetSavings = selectedIncomeTotal - selectedExpenseTotal

  // Category breakdown for selected day
  const selectedByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const exp of selectedEntries) {
      if (exp.kind === 'income' || exp.kind === 'trip') continue
      if (exp.amount <= 0) continue
      if (!exp.category) continue
      map[exp.category] = (map[exp.category] || 0) + exp.amount
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [selectedEntries])

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Intensity classes based on spending
  const getIntensityClass = (total: number) => {
    if (total === 0) return ''
    if (total < 20) return 'bg-primary/10'
    if (total < 50) return 'bg-primary/20'
    if (total < 100) return 'bg-primary/30'
    return 'bg-primary/40'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('calendar.title')}</h1>
          <p className="text-muted-foreground">{t('calendar.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2">
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="rounded-lg"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <CardTitle className="text-lg font-bold">
                  {format(currentMonth, 'MMMM yyyy')}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="rounded-lg"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 mb-1">
                {weekDays.map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day Cells */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const dayEntries = entriesByDate[dateStr] || []
                  const dayExpenseTotal = dayEntries
                    .filter((entry) => entry.kind === 'expense' || entry.kind === 'subscription')
                    .reduce((sum, entry) => sum + entry.amount, 0)
                  const dayIncomeTotal = dayEntries
                    .filter((entry) => entry.kind === 'income')
                    .reduce((sum, entry) => sum + entry.amount, 0)
                  const hasTrip = dayEntries.some((entry) => entry.kind === 'trip')
                  const inMonth = isSameMonth(day, currentMonth)
                  const today = isToday(day)
                  const isSelected = selectedDate === dateStr
                  // Get unique categories for the day (max 3 dots)
                  const uniqueCategories = [
                    ...new Set(
                      dayEntries
                        .filter((entry) => entry.amount > 0 && entry.kind !== 'income')
                        .map((entry) => entry.category)
                    ),
                  ].filter((entry): entry is Category => Boolean(entry)).slice(0, 4)

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                      className={[
                        'relative flex flex-col items-center rounded-lg p-1 min-h-[72px] transition-all duration-150 text-sm',
                        inMonth ? 'hover:bg-accent/60' : 'opacity-30',
                        today ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : '',
                        isSelected ? 'bg-primary/15 shadow-sm' : '',
                        getIntensityClass(inMonth ? dayExpenseTotal : 0),
                      ].join(' ')}
                    >
                      <span className={[
                        'text-xs font-medium mb-0.5',
                        today ? 'text-primary font-bold' : '',
                        !inMonth ? 'text-muted-foreground/50' : '',
                      ].join(' ')}>
                        {format(day, 'd')}
                      </span>

                      {(dayExpenseTotal > 0 || dayIncomeTotal > 0 || hasTrip) && inMonth && (
                        <>
                          {dayExpenseTotal > 0 && (
                            <span className="text-[10px] font-bold tabular-nums text-foreground/80 leading-tight">
                              {dayExpenseTotal.toLocaleString()}
                            </span>
                          )}
                          {dayIncomeTotal > 0 && (
                            <span className="text-[10px] font-semibold tabular-nums text-emerald-600 leading-tight">
                              +{dayIncomeTotal.toLocaleString()}
                            </span>
                          )}
                          {/* Category dots */}
                          <div className="mt-auto flex items-center gap-0.5 pt-0.5">
                            {uniqueCategories.map(cat => (
                              <span
                                key={cat}
                                className={`h-1.5 w-1.5 rounded-full ${CATEGORY_COLORS[cat] || CATEGORY_COLORS.other}`}
                                title={getCategoryLabel(cat, language)}
                              />
                            ))}
                            {hasTrip && (
                              <span title={t('nav.trips')}>
                                <Plane className="h-3 w-3 text-sky-500" />
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Side Panel */}
        <div className="lg:col-span-1 space-y-4">
          {/* Month Summary */}
          <Card className="border-border/40 bg-gradient-to-br from-primary/5 to-accent/5 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-primary">
                <CalendarDays className="h-4 w-4" />
                {format(currentMonth, 'MMMM')} {t('calendar.total')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingDown className="h-3.5 w-3.5" />
                    {t('reports.totalExpenses')}
                  </div>
                  <span className="font-semibold tabular-nums">{monthlyExpenseTotal.toLocaleString()} {settings.currency}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-3.5 w-3.5" />
                    {t('reports.monthlyIncome')}
                  </div>
                  <span className="font-semibold tabular-nums text-emerald-600">{monthlyIncomeTotal.toLocaleString()} {settings.currency}</span>
                </div>
              </div>
              <div className="rounded-lg border border-border/40 bg-background/70 px-3 py-2">
                <p className="text-xs text-muted-foreground">{t('reports.netSavings')}</p>
                <p className={`text-xl font-bold tabular-nums ${monthlyNetSavings >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {Math.round(monthlyNetSavings).toLocaleString()} {settings.currency}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Selected Day Detail */}
          {selectedDate ? (
            <Card className="border-border/40 shadow-sm animate-fade-in-up">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {format(new Date(selectedDate + 'T00:00:00'), 'EEE, MMM d')}
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setSelectedDate(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {selectedEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">{t('calendar.noExpenses')}</p>
                ) : (
                  <div className="space-y-3">
                    {/* Day Total */}
                    <div className="grid grid-cols-1 gap-2 border-b border-border/40 pb-3 sm:grid-cols-3">
                      <div className="rounded-md border border-border/40 px-2 py-1.5">
                        <p className="text-[11px] uppercase text-muted-foreground">{t('reports.totalExpenses')}</p>
                        <p className="text-sm font-semibold tabular-nums">{selectedExpenseTotal.toLocaleString()} {settings.currency}</p>
                      </div>
                      <div className="rounded-md border border-border/40 px-2 py-1.5">
                        <p className="text-[11px] uppercase text-muted-foreground">{t('reports.monthlyIncome')}</p>
                        <p className="text-sm font-semibold tabular-nums text-emerald-600">{selectedIncomeTotal.toLocaleString()} {settings.currency}</p>
                      </div>
                      <div className="rounded-md border border-border/40 px-2 py-1.5">
                        <p className="text-[11px] uppercase text-muted-foreground">{t('reports.netSavings')}</p>
                        <p className={`text-sm font-semibold tabular-nums ${selectedNetSavings >= 0 ? 'text-primary' : 'text-destructive'}`}>
                          {Math.round(selectedNetSavings).toLocaleString()} {settings.currency}
                        </p>
                      </div>
                    </div>

                    {/* Category Breakdown */}
                    <div className="space-y-2">
                      {selectedByCategory.map(([cat, amount]) => (
                        <div key={cat} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_COLORS[cat as Category] || CATEGORY_COLORS.other}`} />
                            <span className="text-sm capitalize">
                              {getCategoryLabel(cat, language)}
                            </span>
                          </div>
                          <span className="text-sm font-semibold tabular-nums">
                            {amount.toLocaleString()} {settings.currency}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Expense List */}
                    <div className="border-t border-border/40 pt-2 mt-2 space-y-2">
                      {selectedEntries.map(exp => (
                        <div key={exp.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg hover:bg-accent/40 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${exp.kind === 'income' ? 'bg-emerald-500' : CATEGORY_COLORS[exp.category || 'other']}`} />
                            <span className="truncate text-muted-foreground">
                              {exp.kind === 'trip'
                                ? `${exp.description} (${t('nav.trips')})`
                                : exp.kind === 'income'
                                ? `${exp.description || t('reports.monthlyIncome')} (${t('reports.monthlyIncome')})`
                                : exp.kind === 'subscription'
                                ? `${exp.description} (${t('nav.subscriptions')})`
                                : (exp.description || getCategoryLabel(exp.category || 'other', language))}
                            </span>
                          </div>
                          {exp.kind === 'trip' ? (
                            <span className="shrink-0 ml-2 text-xs font-medium text-sky-600">
                              {t('nav.trips')}
                            </span>
                          ) : exp.kind === 'income' ? (
                            <span className="font-semibold tabular-nums shrink-0 ml-2 text-emerald-600">
                              +{exp.amount.toLocaleString()}
                            </span>
                          ) : (
                            <span className="font-semibold tabular-nums shrink-0 ml-2">
                              {exp.amount.toLocaleString()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-border/60 bg-transparent shadow-none">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CalendarDays className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">{t('calendar.selectDay')}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
