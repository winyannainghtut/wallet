'use client'

import React, { useState, useMemo } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isToday,
  isSameMonth,
  startOfWeek,
  endOfWeek
} from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useApp } from '@/contexts/AppContext'
import { t, getLanguage } from '@/i18n/config'
import { CATEGORY_LABELS, Expense, Category } from '@/types'

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

export default function CalendarPage() {
  const { expenses, settings } = useApp()
  const language = getLanguage()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Build a map of date -> expenses
  const expensesByDate = useMemo(() => {
    const map: Record<string, Expense[]> = {}
    for (const exp of expenses) {
      if (!map[exp.date]) map[exp.date] = []
      map[exp.date].push(exp)
    }
    return map
  }, [expenses])

  // Get days for the calendar grid (including padding days from prev/next month)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const gridStart = startOfWeek(monthStart)
    const gridEnd = endOfWeek(monthEnd)
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [currentMonth])

  // Monthly total
  const monthlyTotal = useMemo(() => {
    const monthStr = format(currentMonth, 'yyyy-MM')
    return expenses
      .filter(e => e.date.startsWith(monthStr))
      .reduce((sum, e) => sum + e.amount, 0)
  }, [expenses, currentMonth])

  // Selected day expenses
  const selectedExpenses = selectedDate ? (expensesByDate[selectedDate] || []) : []
  const selectedTotal = selectedExpenses.reduce((sum, e) => sum + e.amount, 0)

  // Category breakdown for selected day
  const selectedByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const exp of selectedExpenses) {
      map[exp.category] = (map[exp.category] || 0) + exp.amount
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [selectedExpenses])

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
                  const dayExpenses = expensesByDate[dateStr] || []
                  const dayTotal = dayExpenses.reduce((s, e) => s + e.amount, 0)
                  const inMonth = isSameMonth(day, currentMonth)
                  const today = isToday(day)
                  const isSelected = selectedDate === dateStr
                  // Get unique categories for the day (max 3 dots)
                  const uniqueCategories = [...new Set(dayExpenses.map(e => e.category))].slice(0, 4)

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                      className={[
                        'relative flex flex-col items-center rounded-lg p-1 min-h-[72px] transition-all duration-150 text-sm',
                        inMonth ? 'hover:bg-accent/60' : 'opacity-30',
                        today ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : '',
                        isSelected ? 'bg-primary/15 shadow-sm' : '',
                        getIntensityClass(inMonth ? dayTotal : 0),
                      ].join(' ')}
                    >
                      <span className={[
                        'text-xs font-medium mb-0.5',
                        today ? 'text-primary font-bold' : '',
                        !inMonth ? 'text-muted-foreground/50' : '',
                      ].join(' ')}>
                        {format(day, 'd')}
                      </span>

                      {dayTotal > 0 && inMonth && (
                        <>
                          <span className="text-[10px] font-bold tabular-nums text-foreground/80 leading-tight">
                            {dayTotal.toLocaleString()}
                          </span>
                          {/* Category dots */}
                          <div className="flex gap-0.5 mt-auto pt-0.5">
                            {uniqueCategories.map(cat => (
                              <span
                                key={cat}
                                className={`h-1.5 w-1.5 rounded-full ${CATEGORY_COLORS[cat]}`}
                                title={CATEGORY_LABELS[cat][language]}
                              />
                            ))}
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
            <CardContent>
              <div className="text-3xl font-bold tabular-nums">
                {monthlyTotal.toLocaleString()} <span className="text-lg font-semibold text-muted-foreground">{settings.currency}</span>
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
                {selectedExpenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">{t('calendar.noExpenses')}</p>
                ) : (
                  <div className="space-y-3">
                    {/* Day Total */}
                    <div className="flex items-center justify-between pb-2 border-b border-border/40">
                      <span className="text-sm font-medium text-muted-foreground">{t('common.total')}</span>
                      <span className="text-lg font-bold tabular-nums">
                        {selectedTotal.toLocaleString()} {settings.currency}
                      </span>
                    </div>

                    {/* Category Breakdown */}
                    <div className="space-y-2">
                      {selectedByCategory.map(([cat, amount]) => (
                        <div key={cat} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_COLORS[cat as Category]}`} />
                            <span className="text-sm capitalize">
                              {CATEGORY_LABELS[cat as Category][language]}
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
                      {selectedExpenses.map(exp => (
                        <div key={exp.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg hover:bg-accent/40 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${CATEGORY_COLORS[exp.category]}`} />
                            <span className="truncate text-muted-foreground">
                              {exp.description || CATEGORY_LABELS[exp.category][language]}
                            </span>
                          </div>
                          <span className="font-semibold tabular-nums shrink-0 ml-2">
                            {exp.amount.toLocaleString()}
                          </span>
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
