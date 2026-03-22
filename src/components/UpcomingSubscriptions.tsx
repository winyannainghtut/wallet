'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Subscription } from '@/types'
import { format, differenceInDays, parseISO } from 'date-fns'
import { Clock } from 'lucide-react'

interface UpcomingSubscriptionsProps {
  subscriptions: Subscription[]
  currency: string
  title?: string
}

export function UpcomingSubscriptions({ subscriptions, currency, title = 'Upcoming Bills' }: UpcomingSubscriptionsProps) {
  const activeSubs = subscriptions.filter(s => s.isActive)
  const today = new Date()
  
  // Find subs due within next 14 days
  const upcoming = activeSubs.map(s => {
    // startDate holds the next due date string in this app logic
    const dueDate = parseISO(s.startDate)
    const daysLeft = differenceInDays(dueDate, today)
    return { ...s, daysLeft, dueDate }
  }).filter(s => s.daysLeft >= 0 && s.daysLeft <= 14)
    .sort((a, b) => a.daysLeft - b.daysLeft)

  if (upcoming.length === 0) return null

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold tracking-tight uppercase text-muted-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {upcoming.map(sub => (
            <div key={sub.id} className="flex flex-col gap-2 p-3.5 rounded-xl border border-border/50 bg-muted/10 hover:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center flex-col shrink-0">
                    <span className="text-xs font-bold text-orange-600 leading-none">{format(sub.dueDate, 'dd')}</span>
                    <span className="text-[9px] text-orange-600/80 font-bold uppercase leading-tight">{format(sub.dueDate, 'MMM')}</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-sm text-foreground line-clamp-1">{sub.name}</span>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {sub.daysLeft === 0 ? 'Due today' : `In ${sub.daysLeft} day${sub.daysLeft > 1 ? 's' : ''}`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end border-t border-border/40 pt-2 mt-1">
                <span className="font-bold tabular-nums text-sm">
                  {sub.amount.toLocaleString()} <span className="text-[11px] text-muted-foreground font-medium">{currency}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
