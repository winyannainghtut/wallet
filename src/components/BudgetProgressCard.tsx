'use client'

import React from 'react'
import { Target } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { t } from '@/i18n/config'

interface BudgetProgressCardProps {
  currentSpend: number
  budget: number
}

export function BudgetProgressCard({ currentSpend, budget }: BudgetProgressCardProps) {
  const percentage = Math.min((currentSpend / budget) * 100, 100)
  const isOver = currentSpend > budget
  const remaining = Math.max(budget - currentSpend, 0)

  return (
    <Card className={`border-border/40 mb-6 ${isOver ? 'border-destructive/30 bg-destructive/5' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className={`h-4 w-4 ${isOver ? 'text-destructive' : 'text-primary'}`} />
              {t('budget.title')}
            </CardTitle>
            <CardDescription>
              {isOver 
                ? <span className="text-destructive font-medium">{t('budget.overBudget')}</span>
                : `${remaining.toLocaleString()} SGD ${t('budget.left')}`}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold tabular-nums ${isOver ? 'text-destructive' : ''}`}>
              {currentSpend.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              {t('budget.of')} {budget.toLocaleString()} SGD
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted/60">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              isOver 
                ? 'bg-destructive' 
                : percentage > 85 
                  ? 'bg-amber-500' 
                  : 'bg-gradient-to-r from-primary to-primary/80'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </CardContent>
    </Card>
  )
}
