'use client'

import React from 'react'
import { Trash2, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Expense, getCategoryLabel } from '@/types'
import { format } from 'date-fns'
import { t, getLanguage } from '@/i18n/config'

interface ExpenseListProps {
  expenses: Expense[]
  onEdit?: (expense: Expense) => void
  onDelete?: (id: string) => void
  showDate?: boolean
}

export function ExpenseList({ expenses, onEdit, onDelete, showDate = true }: ExpenseListProps) {
  const language = getLanguage()

  if (expenses.length === 0) {
    return (
      <Card className="border-border/40">
        <CardContent className="py-12 text-center text-muted-foreground">
          <p className="text-sm">{t('history.noExpenses')}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2.5">
      {expenses.map((expense, index) => (
        <Card
          key={expense.id}
          className="group border-border/40 transition-all duration-200 hover:-translate-y-0.5 hover:border-border/70 hover:shadow-md hover:shadow-primary/5"
          style={{ animationDelay: `${index * 30}ms` }}
        >
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="rounded-lg font-medium">
                    {getCategoryLabel(expense.category, language)}
                  </Badge>
                  {showDate && (
                    <span className="text-xs text-muted-foreground/80">
                      {format(new Date(expense.date), 'MMM dd, yyyy')}
                    </span>
                  )}
                </div>
                {expense.description && (
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                    {expense.description}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-base font-bold tabular-nums sm:text-lg">
                  {expense.amount.toLocaleString()} <span className="text-xs font-medium text-muted-foreground">SGD</span>
                </span>
                {(onEdit || onDelete) && (
                  <div className="flex gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(expense)}
                        className="h-8 w-8 rounded-lg"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(t('expense.deleteConfirm'))) {
                            onDelete(expense.id)
                          }
                        }}
                        className="h-8 w-8 rounded-lg text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
