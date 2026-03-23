'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { SavingsGoal } from '@/types'
import { format } from 'date-fns'
import { Target } from 'lucide-react'

interface SavingsGoalWidgetProps {
  currentSavings: number
  currency: string
  title?: string
}

type SavingsGoalsApiResponse = {
  items?: unknown[]
}

function isSavingsGoal(value: unknown): value is SavingsGoal {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Partial<SavingsGoal>
  return (
    typeof record.id === 'string' &&
    typeof record.month === 'string' &&
    typeof record.targetAmount === 'number' &&
    typeof record.createdAt === 'string'
  )
}

export function SavingsGoalWidget({ currentSavings, currency, title = 'Savings Goal' }: SavingsGoalWidgetProps) {
  const [goal, setGoal] = useState<SavingsGoal | null>(null)
  
  useEffect(() => {
    const fetchGoal = async () => {
      try {
        const res = await fetch('/api/savings-goals')
        if (res.ok) {
          const data = (await res.json()) as SavingsGoalsApiResponse
          const currentMonth = format(new Date(), 'yyyy-MM')
          const found = (data.items || []).find(
            (item): item is SavingsGoal => isSavingsGoal(item) && item.month === currentMonth
          )
          if (found) {
            setGoal(found)
          }
        }
      } catch {
        // silently ignore
      }
    }
    fetchGoal()
  }, [])

  if (!goal) return null

  const target = goal.targetAmount
  const current = Math.max(0, currentSavings)
  const percentage = target > 0 ? Math.min(100, (current / target) * 100) : 0
  
  return (
    <Card className="border-border/40 bg-gradient-to-br from-card to-card/50">
      <CardContent className="p-4 sm:p-5">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-tight uppercase text-muted-foreground flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-500" />
              {title}
            </h3>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              {percentage.toFixed(0)}%
            </span>
          </div>
          
          <div className="space-y-1.5">
            <div className="flex justify-between items-end">
              <span className="text-xl font-bold tabular-nums sm:text-2xl">
                {current.toLocaleString()} <span className="text-sm text-muted-foreground font-medium">{currency}</span>
              </span>
              <span className="text-sm text-muted-foreground font-medium tabular-nums">
                / {target.toLocaleString()} {currency}
              </span>
            </div>
            
            <div className="h-2.5 w-full bg-muted/60 rounded-full overflow-hidden shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-1000 ease-out rounded-full"
                style={{ width: `${percentage}%` }}
              />
            </div>
            {current >= target && (
              <p className="text-xs font-medium text-emerald-600 mt-1">Goal achieved! \uD83C\uDF89</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
