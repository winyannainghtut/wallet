'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CATEGORY_LABELS, Category, DailySummary, WeeklySummary } from '@/types'
import { format, parseISO } from 'date-fns'
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
      name: CATEGORY_LABELS[category as Category][language],
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
}

export function DailyBarChart({ data, title }: DailyBarChartProps) {
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
            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col items-center justify-end h-[200px]">
                  <div
                    className="group w-full max-w-[40px] rounded-t-lg transition-all duration-300 hover:opacity-85 cursor-default"
                    style={{
                      height: `${height}%`,
                      background: 'linear-gradient(to top, var(--chart-1), color-mix(in oklab, var(--chart-1) 70%, var(--chart-2)))'
                    }}
                    title={`${d.total.toLocaleString()} SGD`}
                  />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {format(parseISO(d.date), 'dd')}
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
