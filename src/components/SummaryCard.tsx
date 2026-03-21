'use client'

import React from 'react'
import { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SummaryCardProps {
  title: string
  amount: number
  icon?: LucideIcon
  subtitle?: string
  currency?: string
}

export function SummaryCard({ title, amount, icon: Icon, subtitle, currency = 'SGD' }: SummaryCardProps) {
  return (
    <Card className="group border-border/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/20 text-primary transition-transform duration-300 group-hover:scale-110">
            <Icon className="h-4 w-4" />
          </span>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight tabular-nums">
          {amount.toLocaleString()} <span className="text-base font-semibold text-muted-foreground">{currency}</span>
        </div>
        {subtitle && (
          <p className="mt-1.5 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}
