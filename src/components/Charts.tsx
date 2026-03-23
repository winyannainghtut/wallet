'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Category, DailySummary, WeeklySummary, Expense, Income, getCategoryLabel } from '@/types'
import { format, parseISO, startOfWeek, endOfWeek, subDays, subWeeks, subMonths, isWithinInterval, startOfMonth, endOfMonth, isValid } from 'date-fns'
import { getLanguage, t } from '@/i18n/config'

// Refined color palette — harmonious and modern
const COLORS: Record<string, string> = {
  groceries: '#22c55e',
  breakfast: '#f59e0b',
  lunch: '#ef4444',
  dinner: '#a855f7',
  transportation: '#3b82f6',
  shopping: '#ec4899',
  donations: '#06b6d4',
  insurance: '#64748b',
  utilities: '#78716c',
  entertainment: '#eab308',
  health: '#f43f5e',
  education: '#6366f1',
  other: '#94a3b8'
}

interface CategoryPieChartProps {
  data: Record<Category, number>
  title: string
}

export function CategoryPieChart({ data, title }: CategoryPieChartProps) {
  const language = getLanguage()

  const chartData = Object.entries(data)
    .filter(([, value]) => value > 0)
    .map(([category, amount]) => ({
      name: getCategoryLabel(category, language),
      value: amount,
      color: COLORS[category] || '#94a3b8',
      percentage: 0
    }))

  const total = chartData.reduce((sum, item) => sum + item.value, 0)
  chartData.forEach(item => {
    item.percentage = total > 0 ? (item.value / total) * 100 : 0
  })

  if (chartData.length === 0) {
    return (
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
          <p className="text-sm">{t('common.noData')}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/40">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3.5">
          {chartData.map((item) => (
            <div key={item.name} className="group space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-2.5 w-2.5 rounded-full shadow-sm"
                    style={{ backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}40` }}
                  />
                  <span className="font-medium">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 tabular-nums text-muted-foreground">
                  <span>{item.value.toLocaleString()}</span>
                  <span className="text-xs">({item.percentage.toFixed(1)}%)</span>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted/60">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${item.percentage}%`,
                    background: `linear-gradient(90deg, ${item.color}, ${item.color}cc)`
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface DailyBarChartProps {
  data: DailySummary[]
  title: string
  currency?: string
  detailsByDate?: Record<string, { expense: number; subscription: number; income?: number; count: number }>
}

export function DailyBarChart({ data, title, currency = 'SGD', detailsByDate }: DailyBarChartProps) {
  const maxValue = Math.max(...data.map(d => d.total), 1)

  if (data.every(d => d.total === 0)) {
    return (
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
          <p className="text-sm">{t('common.noData')}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/40">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 h-[250px]">
          {data.map((d, index) => {
            const height = (d.total / maxValue) * 100
            const details = detailsByDate?.[d.date]
            const expenseAmount = details?.expense ?? d.total
            const subscriptionAmount = details?.subscription ?? 0
            const incomeAmount = details?.income ?? 0
            const netAmount = incomeAmount - d.total
            const itemCount = details?.count ?? d.count
            const tooltip = [
              `${d.total.toLocaleString()} ${currency}`,
              `Expense: ${expenseAmount.toLocaleString()} ${currency}`,
              `Subscription: ${subscriptionAmount.toLocaleString()} ${currency}`,
              `Income: ${incomeAmount.toLocaleString()} ${currency}`,
              `Net: ${netAmount.toLocaleString()} ${currency}`,
              `Items: ${itemCount}`,
            ].join('\n')
            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div className="text-[11px] tabular-nums font-medium text-muted-foreground min-h-[14px]">
                  {d.total > 0 ? d.total.toLocaleString() : ''}
                </div>
                <div className="w-full flex flex-col items-center justify-end h-[200px]">
                  <div
                    className="group w-full max-w-[40px] rounded-t-lg transition-all duration-300 hover:opacity-85 cursor-default"
                    style={{
                      height: `${height}%`,
                      background: 'linear-gradient(to top, var(--chart-1), color-mix(in oklab, var(--chart-1) 70%, var(--chart-2)))'
                    }}
                    title={tooltip}
                  />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground text-center leading-tight">
                  {format(parseISO(d.date), 'EEE')}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

interface WeeklyTrendChartProps {
  data: WeeklySummary[]
  title: string
}

export function WeeklyTrendChart({ data, title }: WeeklyTrendChartProps) {
  const maxValue = Math.max(...data.map(d => d.total), 1)

  if (data.every(d => d.total === 0)) {
    return (
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
          <p className="text-sm">{t('common.noData')}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/40">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-4 h-[250px]">
          {data.map((d, index) => {
            const height = (d.total / maxValue) * 100
            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div className="text-xs tabular-nums font-medium text-muted-foreground">
                  {d.total > 0 ? d.total.toLocaleString() : ''}
                </div>
                <div className="w-full flex flex-col items-center justify-end h-[180px]">
                  <div
                    className="w-full max-w-[60px] rounded-t-lg transition-all duration-300 hover:opacity-85 cursor-default"
                    style={{
                      height: `${height}%`,
                      background: 'linear-gradient(to top, var(--chart-4), color-mix(in oklab, var(--chart-4) 65%, var(--chart-2)))'
                    }}
                    title={`${d.total.toLocaleString()} SGD`}
                  />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground text-center">
                  {format(parseISO(d.weekStart), 'MMM dd')}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

interface IncomeExpenseBarChartProps {
  expenses: Expense[]
  incomes: Income[]
  title: string
  currency?: string
}

export function IncomeExpenseBarChart({ expenses, incomes, title, currency = 'SGD' }: IncomeExpenseBarChartProps) {
  const [tab, setTab] = useState<'7d' | '1m' | '1y'>('7d')

  const chartData = useMemo(() => {
    const now = new Date()
    let data: { label: string; dateGroup: string; income: number; expense: number; weekStart?: Date; weekEnd?: Date; monthStart?: Date; monthEnd?: Date }[] = []

    if (tab === '7d') {
      data = [...Array(7)].map((_, i) => {
        const d = subDays(now, 6 - i)
        const dateStr = format(d, 'yyyy-MM-dd')
        return {
          label: format(d, 'EEE'),
          dateGroup: dateStr,
          income: 0,
          expense: 0
        }
      })
      expenses.forEach(e => {
        const item = data.find(d => d.dateGroup === e.date)
        if (item) item.expense += e.amount
      })
      incomes.forEach(inc => {
        const item = data.find(d => d.dateGroup === inc.date)
        if (item) item.income += inc.amount
      })
    } else if (tab === '1m') {
      data = [...Array(4)].map((_, i) => {
        const ws = startOfWeek(subWeeks(now, 3 - i))
        const we = endOfWeek(subWeeks(now, 3 - i))
        return {
          label: format(ws, 'MMM dd'),
          dateGroup: format(ws, 'yyyy-MM-dd'),
          income: 0,
          expense: 0,
          weekStart: ws,
          weekEnd: we
        }
      })

      expenses.forEach(e => {
        try {
          const d = parseISO(e.date)
          if (!isValid(d)) return
          const bin = data.find(b => b.weekStart && b.weekEnd && isWithinInterval(d, { start: b.weekStart, end: b.weekEnd }))
          if (bin) bin.expense += e.amount
        } catch {}
      })
      incomes.forEach(inc => {
        try {
          const d = parseISO(inc.date)
          if (!isValid(d)) return
          const bin = data.find(b => b.weekStart && b.weekEnd && isWithinInterval(d, { start: b.weekStart, end: b.weekEnd }))
          if (bin) bin.income += inc.amount
        } catch {}
      })
    } else if (tab === '1y') {
      data = [...Array(6)].map((_, i) => {
        const ms = startOfMonth(subMonths(now, 5 - i))
        const me = endOfMonth(subMonths(now, 5 - i))
        return {
          label: format(ms, 'MMM'),
          dateGroup: format(ms, 'yyyy-MM'),
          income: 0,
          expense: 0,
          monthStart: ms,
          monthEnd: me
        }
      })

      expenses.forEach(e => {
        try {
          const d = parseISO(e.date)
          if (!isValid(d)) return
          const bin = data.find(b => b.monthStart && b.monthEnd && isWithinInterval(d, { start: b.monthStart, end: b.monthEnd }))
          if (bin) bin.expense += e.amount
        } catch {}
      })
      incomes.forEach(inc => {
        try {
          const d = parseISO(inc.date)
          if (!isValid(d)) return
          const bin = data.find(b => b.monthStart && b.monthEnd && isWithinInterval(d, { start: b.monthStart, end: b.monthEnd }))
          if (bin) bin.income += inc.amount
        } catch {}
      })
    }

    return data
  }, [tab, expenses, incomes])

  const maxValue = Math.max(...chartData.flatMap(d => [d.income || 0, d.expense || 0]), 1)

  const formatShort = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toLocaleString()
  }

  return (
    <Card className="border-border/40 flex flex-col h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs mt-1">Income vs Expense trends ({currency})</CardDescription>
          </div>
          
          <div className="flex bg-muted/50 rounded-lg p-1">
            {(['7d', '1m', '1y'] as const).map((tOpt) => (
              <button
                key={tOpt}
                disabled={tab === tOpt}
                onClick={() => setTab(tOpt)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  tab === tOpt 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tOpt === '7d' ? '7D' : tOpt === '1m' ? '1M' : '1Y'}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col justify-end">
        <div className="flex items-end justify-between h-[230px] mt-4">
          {chartData.map((d, index) => {
            const incHeight = (d.income / maxValue) * 100
            const expHeight = (d.expense / maxValue) * 100
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full h-[180px] flex items-end justify-center gap-1 sm:gap-2 group pb-1">
                    {/* Income Bar */}
                    <div className="relative group w-full max-w-[28px] h-full flex justify-center items-end">
                      <div
                        className="w-full rounded-t-md transition-all duration-300 hover:opacity-85 bg-emerald-500/90 shadow-sm"
                        style={{ height: `${incHeight}%`, minHeight: incHeight > 0 ? '4px' : '0' }}
                      >
                         {d.income > 0 && (
                           <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                             {formatShort(d.income)}
                           </div>
                         )}
                      </div>
                    </div>
                    {/* Expense Bar */}
                    <div className="relative group w-full max-w-[28px] h-full flex justify-center items-end">
                      <div
                        className="w-full rounded-t-md transition-all duration-300 hover:opacity-85 bg-rose-500/90 shadow-sm"
                        style={{ height: `${expHeight}%`, minHeight: expHeight > 0 ? '4px' : '0' }}
                      >
                         {d.expense > 0 && (
                           <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-rose-600 dark:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                             {formatShort(d.expense)}
                           </div>
                         )}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-medium text-muted-foreground text-center leading-tight">
                    {d.label}
                  </span>
                </div>
              )
            })}
          </div>
        
        <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-border/40">
           <div className="flex items-center gap-2 text-xs font-medium">
             <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
             <span className="text-muted-foreground">Income</span>
           </div>
           <div className="flex items-center gap-2 text-xs font-medium">
             <div className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
             <span className="text-muted-foreground">Expense</span>
           </div>
        </div>
      </CardContent>
    </Card>
  )
}
