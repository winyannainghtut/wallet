import { cookies } from 'next/headers'
import { getPocketBaseServer } from './pocketbase'
import { TransactionRecord } from './pocketbase-types'

/**
 * Server Component helper for fetching transactions
 *
 * Usage in a Server Component:
 *
 * ```tsx
 * // app/reports/page.tsx
 * import { getTransactionsForServerComponent } from '@/lib/server-transactions'
 *
 * export default async function ReportsPage() {
 *   const transactions = await getTransactionsForServerComponent()
 *
 *   return (
 *     <div>
 *       {transactions.map(t => (
 *         <div key={t.id}>{t.description}: {t.amount}</div>
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */

const POCKETBASE_AUTH_COOKIE = 'pb_auth'

/**
 * Get auth token from cookies (server-side)
 */
export async function getAuthTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies()
  const authCookie = cookieStore.get(POCKETBASE_AUTH_COOKIE)

  if (!authCookie?.value) {
    return null
  }

  try {
    const parsed = JSON.parse(authCookie.value)
    return parsed.token || null
  } catch {
    return null
  }
}

/**
 * Check if user is authenticated (server-side)
 */
export async function isAuthenticatedServer(): Promise<boolean> {
  const token = await getAuthTokenFromCookies()
  if (!token) return false

  try {
    const pb = getPocketBaseServer(token)
    await pb.collection('users').authRefresh()
    return true
  } catch {
    return false
  }
}

/**
 * Get current user (server-side)
 */
export async function getCurrentUserServer() {
  const token = await getAuthTokenFromCookies()
  if (!token) return null

  try {
    const pb = getPocketBaseServer(token)
    const result = await pb.collection('users').authRefresh()
    return result.record
  } catch {
    return null
  }
}

/**
 * Fetch transactions for Server Components
 */
export async function getTransactionsForServerComponent(options?: {
  page?: number
  perPage?: number
  sort?: string
  filter?: string
}) {
  const token = await getAuthTokenFromCookies()
  if (!token) {
    throw new Error('Unauthorized')
  }

  const pb = getPocketBaseServer(token)

  const result = await pb.collection('transactions').getList<TransactionRecord>(
    options?.page || 1,
    options?.perPage || 50,
    {
      sort: options?.sort || '-date',
      filter: options?.filter,
    }
  )

  return result
}

/**
 * Fetch all transactions (use with caution - may be slow for large datasets)
 */
export async function getAllTransactionsForServerComponent(filter?: string) {
  const token = await getAuthTokenFromCookies()
  if (!token) {
    throw new Error('Unauthorized')
  }

  const pb = getPocketBaseServer(token)

  const result = await pb.collection('transactions').getFullList<TransactionRecord>({
    sort: '-date',
    filter,
  })

  return result
}
