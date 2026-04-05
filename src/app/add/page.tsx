'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExpenseForm } from '@/components/ExpenseForm'
import { useApp } from '@/contexts/AppContext'
import { Expense } from '@/types'
import { t } from '@/i18n/config'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react'

export default function AddExpensePage() {
  const router = useRouter()
  const { addExpense } = useApp()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleSubmit = async (data: Omit<Expense, 'id' | 'createdAt'>) => {
    setIsSubmitting(true)
    setError(null)
    try {
      await addExpense(data)
      setShowSuccess(true)
      setTimeout(() => {
        router.push('/')
      }, 800)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.error')
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('expense.addTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('expense.addSubtitle')}</p>
        </div>
        <Link href="/">
          <Button variant="outline" className="rounded-xl border-border/60">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common.back')}
          </Button>
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {showSuccess && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {t('expense.addSuccess')}
        </div>
      )}

      <ExpenseForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  )
}
