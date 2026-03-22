'use client'

import { useState, useEffect, useCallback } from 'react'
import { Category } from '@/types'

export interface Transaction {
  id: string
  user: string
  type: 'income' | 'expense'
  category: Category
  amount: number
  description: string
  date: string
  created: string
  updated: string
}

export interface TransactionInput {
  type: 'income' | 'expense'
  category: Category
  amount: number
  description: string
  date: string
}

interface UseTransactionsOptions {
  category?: Category
  type?: 'income' | 'expense'
  startDate?: string
  endDate?: string
  autoFetch?: boolean
}

export function useTransactions(options: UseTransactionsOptions = {}) {
  const { category, type, startDate, endDate, autoFetch = true } = options

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(autoFetch)
  const [error, setError] = useState<string | null>(null)

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (type) params.set('type', type)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    return params.toString()
  }, [category, type, startDate, endDate])

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const query = buildQueryParams()
      const url = query ? `/api/transactions?${query}` : '/api/transactions'

      const res = await fetch(url)

      if (!res.ok) {
        if (res.status === 401) {
          setTransactions([])
          return
        }
        throw new Error('Failed to fetch transactions')
      }

      const data = await res.json()
      setTransactions(data.items || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [buildQueryParams])

  useEffect(() => {
    if (autoFetch) {
      fetchTransactions()
    }
  }, [autoFetch, fetchTransactions])

  const create = async (data: TransactionInput): Promise<Transaction> => {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || 'Failed to create transaction')
    }

    const newTransaction = await res.json()
    await fetchTransactions() // Refresh list
    return newTransaction
  }

  const update = async (id: string, data: Partial<TransactionInput>): Promise<Transaction> => {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || 'Failed to update transaction')
    }

    const updatedTransaction = await res.json()
    await fetchTransactions() // Refresh list
    return updatedTransaction
  }

  const remove = async (id: string): Promise<void> => {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'DELETE',
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || 'Failed to delete transaction')
    }

    await fetchTransactions() // Refresh list
  }

  // Computed values
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const balance = totalIncome - totalExpense

  const byCategory = transactions.reduce((acc, t) => {
    if (t.type === 'expense') {
      acc[t.category] = (acc[t.category] || 0) + t.amount
    }
    return acc
  }, {} as Record<Category, number>)

  return {
    transactions,
    isLoading,
    error,
    create,
    update,
    remove,
    refresh: fetchTransactions,
    // Computed
    totalExpense,
    totalIncome,
    balance,
    byCategory,
  }
}
