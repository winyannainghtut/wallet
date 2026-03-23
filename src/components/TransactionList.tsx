'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Expense, Income, getCategoryLabel, getIncomeCategoryLabel } from '@/types'
import { format } from 'date-fns'
import { ArrowDownRight, ArrowUpRight, Edit, Trash2 } from 'lucide-react'
import { getLanguage } from '@/i18n/config'

export type TransactionItem = (Expense & { type: 'expense' }) | (Income & { type: 'income' })

interface TransactionListProps {
  transactions: TransactionItem[]
  showDate?: boolean
  currency: string
  onEdit?: (item: TransactionItem) => void
  onDelete?: (item: TransactionItem) => void
}

export function TransactionList({ 
  transactions, 
  showDate = true, 
  currency,
  onEdit,
  onDelete
}: TransactionListProps) {
  const language = getLanguage()

  if (transactions.length === 0) {
    return (
      <Card className="border-border/40">
        <CardContent className="py-12 text-center text-muted-foreground">
          <p className="text-sm">No recent transactions</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2.5">
      {transactions.map((tx, index) => {
        const isIncome = tx.type === 'income'
        let label: string = tx.category
        if (isIncome) {
           label = getIncomeCategoryLabel(tx.category, language)
        } else {
           label = getCategoryLabel(tx.category, language)
        }

        return (
          <Card
            key={`${tx.type}-${tx.id}`}
            className="group border-border/40 transition-all duration-200 hover:-translate-y-0.5 hover:border-border/70 hover:shadow-md hover:shadow-primary/5"
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full ${isIncome ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'}`}>
                      {isIncome ? <ArrowDownRight className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                    </span>
                    <Badge variant="secondary" className="rounded-lg font-medium">
                      {label}
                    </Badge>
                    {showDate && (
                      <span className="text-xs text-muted-foreground/80">
                        {format(new Date(tx.date), 'MMM dd, yyyy')}
                      </span>
                    )}
                  </div>
                  {tx.description && (
                    <p className="mt-1.5 ml-8 line-clamp-2 text-sm text-muted-foreground">
                      {tx.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <span className={`text-base font-bold tabular-nums sm:text-lg ${isIncome ? 'text-emerald-600' : 'text-foreground'}`}>
                    {isIncome ? '+' : '-'}{tx.amount.toLocaleString()} <span className="text-xs font-medium text-muted-foreground">{currency}</span>
                  </span>
                  {(onEdit || onDelete) && (
                    <div className="flex gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(tx)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(tx)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
