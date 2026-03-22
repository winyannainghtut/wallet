import { getPocketBaseClient, getPocketBaseServer } from './pocketbase'
import { TransactionRecord, TransactionWithUser, CreateTransaction } from './pocketbase-types'

const COLLECTION = 'transactions'

/**
 * Client-side transaction operations
 */

export async function createTransaction(data: CreateTransaction): Promise<TransactionRecord> {
  const pb = getPocketBaseClient()

  if (!pb.authStore.isValid) {
    throw new Error('You must be logged in to create a transaction')
  }

  const record = await pb.collection(COLLECTION).create<TransactionRecord>(data)
  return record
}

export async function updateTransaction(id: string, data: Partial<CreateTransaction>): Promise<TransactionRecord> {
  const pb = getPocketBaseClient()

  if (!pb.authStore.isValid) {
    throw new Error('You must be logged in to update a transaction')
  }

  const record = await pb.collection(COLLECTION).update<TransactionRecord>(id, data)
  return record
}

export async function deleteTransaction(id: string): Promise<void> {
  const pb = getPocketBaseClient()

  if (!pb.authStore.isValid) {
    throw new Error('You must be logged in to delete a transaction')
  }

  await pb.collection(COLLECTION).delete(id)
}

export async function getTransactions(options?: {
  page?: number
  perPage?: number
  sort?: string
  filter?: string
}): Promise<{ items: TransactionRecord[]; totalItems: number; page: number; perPage: number }> {
  const pb = getPocketBaseClient()

  if (!pb.authStore.isValid) {
    throw new Error('You must be logged in to view transactions')
  }

  const result = await pb.collection(COLLECTION).getList<TransactionRecord>(
    options?.page || 1,
    options?.perPage || 50,
    {
      sort: options?.sort || '-date',
      filter: options?.filter,
    }
  )

  return result
}

export async function getTransactionById(id: string): Promise<TransactionWithUser> {
  const pb = getPocketBaseClient()

  if (!pb.authStore.isValid) {
    throw new Error('You must be logged in to view this transaction')
  }

  const record = await pb.collection(COLLECTION).getOne<TransactionWithUser>(id, {
    expand: 'user',
  })

  return record
}

/**
 * Real-time subscription for transactions
 */
export function subscribeToTransactions(
  callback: (data: { action: string; record: TransactionRecord }) => void
): () => void {
  const pb = getPocketBaseClient()

  let unsubscribe: (() => void) | undefined

  pb.collection(COLLECTION).subscribe('*', (e) => {
    callback({ action: e.action, record: e.record as TransactionRecord })
  }).then((unsub) => {
    unsubscribe = unsub
  })

  return () => {
    if (unsubscribe) {
      unsubscribe()
    }
  }
}

/**
 * Server-side transaction operations
 * Use these in Server Components and Server Actions
 */

export async function getTransactionsServer(
  authToken: string,
  options?: {
    page?: number
    perPage?: number
    sort?: string
    filter?: string
  }
): Promise<{ items: TransactionRecord[]; totalItems: number; page: number; perPage: number }> {
  const pb = getPocketBaseServer(authToken)

  const result = await pb.collection(COLLECTION).getList<TransactionRecord>(
    options?.page || 1,
    options?.perPage || 50,
    {
      sort: options?.sort || '-date',
      filter: options?.filter,
    }
  )

  return result
}

export async function getTransactionByIdServer(
  authToken: string,
  id: string
): Promise<TransactionWithUser> {
  const pb = getPocketBaseServer(authToken)

  const record = await pb.collection(COLLECTION).getOne<TransactionWithUser>(id, {
    expand: 'user',
  })

  return record
}

/**
 * Aggregation helpers
 */

export async function getTransactionsByCategory(
  startDate?: string,
  endDate?: string
): Promise<Record<string, number>> {
  const pb = getPocketBaseClient()

  if (!pb.authStore.isValid) {
    throw new Error('You must be logged in')
  }

  let filter = 'type = "expense"'
  if (startDate && endDate) {
    filter += ` && date >= "${startDate}" && date <= "${endDate}"`
  }

  const result = await pb.collection(COLLECTION).getFullList<TransactionRecord>({
    filter,
    fields: 'category,amount',
  })

  const byCategory: Record<string, number> = {}
  for (const item of result) {
    byCategory[item.category] = (byCategory[item.category] || 0) + item.amount
  }

  return byCategory
}

export async function getTotalSpent(startDate?: string, endDate?: string): Promise<number> {
  const pb = getPocketBaseClient()

  if (!pb.authStore.isValid) {
    throw new Error('You must be logged in')
  }

  let filter = 'type = "expense"'
  if (startDate && endDate) {
    filter += ` && date >= "${startDate}" && date <= "${endDate}"`
  }

  const result = await pb.collection(COLLECTION).getFullList<TransactionRecord>({
    filter,
    fields: 'amount',
  })

  return result.reduce((sum, item) => sum + item.amount, 0)
}
