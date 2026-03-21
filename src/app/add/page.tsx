'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExpenseForm } from '@/components/ExpenseForm'
import { useApp } from '@/contexts/AppContext'
import { Expense } from '@/types'
import { t } from '@/i18n/config'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function AddExpensePage() {
  const router = useRouter()
  const { addExpense } = useApp()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = (data: Omit<Expense, 'id' | 'createdAt'>) => {
    setIsSubmitting(true)
    try {
      addExpense(data)
      router.push('/')
    } catch (error) {
      console.error('Error adding expense:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t('expense.addTitle')}</h1>
          <p className="text-sm text-muted-foreground">Add an expense in under 10 seconds.</p>
        </div>
        <Link href="/">
          <Button variant="outline" className="rounded-xl border-border/60">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common.back')}
          </Button>
        </Link>
      </div>
      <ExpenseForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  )
}
