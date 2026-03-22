'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  createTransaction as apiCreate,
  updateTransaction as apiUpdate,
  deleteTransaction as apiDelete,
  getTransactions as apiGetTransactions,
  subscribeToTransactions,
} from '@/lib/transactions'
import { TransactionRecord, CreateTransaction } from '@/lib/pocketbase-types'

interface UseTransactionsOptions {
  autoFetch?: boolean
  filter?: string
  sort?: string
  perPage?: number
}

interface UseTransactionsReturn {
  transactions: TransactionRecord[]
  isLoading: boolean
  error: Error | null
  total: number
  page: number
  createTransaction: (data: CreateTransaction) => Promise<TransactionRecord>
  updateTransaction: (id: string, data: Partial<CreateTransaction>) => Promise<TransactionRecord>
  deleteTransaction: (id: string) => Promise<void>
  refresh: () => Promise<void>
  nextPage: () => Promise<void>
  prevPage: () => Promise<void>
  goToPage: (page: number) => Promise<void>
}

export function useTransactions(options: UseTransactionsOptions = {}): UseTransactionsReturn {
  const { autoFetch = true, filter, sort = '-date', perPage = 50 } = options
  const { isAuthenticated } = useAuth()

  const [transactions, setTransactions] = useState<TransactionRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  const fetchTransactions = useCallback(async (pageNum: number = 1) => {
    if (!isAuthenticated) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await apiGetTransactions({
        page: pageNum,
        perPage,
        sort,
        filter,
      })

      setTransactions(result.items)
      setTotal(result.totalItems)
      setPage(result.page)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch transactions'))
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, perPage, sort, filter])

  // Initial fetch
  useEffect(() => {
    if (autoFetch && isAuthenticated) {
      fetchTransactions(1)
    }
  }, [autoFetch, isAuthenticated, fetchTransactions])

  // Real-time subscription
  useEffect(() => {
    if (!isAuthenticated) return

    const unsubscribe = subscribeToTransactions(({ action, record }) => {
      setTransactions((prev) => {
        switch (action) {
          case 'create':
            return [record, ...prev]
          case 'update':
            return prev.map((t) => (t.id === record.id ? record : t))
          case 'delete':
            return prev.filter((t) => t.id !== record.id)
          default:
            return prev
        }
      })
    })

    return () => {
      unsubscribe()
    }
  }, [isAuthenticated])

  const createTransaction = useCallback(async (data: CreateTransaction) => {
    const record = await apiCreate(data)
    // Real-time subscription will update the list automatically
    return record
  }, [])

  const updateTransaction = useCallback(async (id: string, data: Partial<CreateTransaction>) => {
    const record = await apiUpdate(id, data)
    // Real-time subscription will update the list automatically
    return record
  }, [])

  const deleteTransaction = useCallback(async (id: string) => {
    await apiDelete(id)
    // Real-time subscription will update the list automatically
  }, [])

  const refresh = useCallback(() => fetchTransactions(page), [fetchTransactions, page])

  const nextPage = useCallback(async () => {
    const maxPage = Math.ceil(total / perPage)
    if (page < maxPage) {
      await fetchTransactions(page + 1)
    }
  }, [fetchTransactions, page, total, perPage])

  const prevPage = useCallback(async () => {
    if (page > 1) {
      await fetchTransactions(page - 1)
    }
  }, [fetchTransactions, page])

  const goToPage = useCallback(async (pageNum: number) => {
    await fetchTransactions(pageNum)
  }, [fetchTransactions])

  return {
    transactions,
    isLoading,
    error,
    total,
    page,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    refresh,
    nextPage,
    prevPage,
    goToPage,
  }
}
