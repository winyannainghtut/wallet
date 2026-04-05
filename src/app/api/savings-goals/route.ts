import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'
import { escapeFilterValue } from '@/lib/transaction-payload'

type PocketBaseLikeError = {
  status?: number
  message?: string
}

type SavingsGoalInput = {
  month?: string
  targetAmount?: number
  note?: string
}

type SavingsGoalRecord = {
  id: string
  user?: string
  month?: string
  targetAmount?: number
  note?: string
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as PocketBaseLikeError).message
    if (typeof message === 'string' && message.length > 0) {
      return message
    }
  }
  return fallback
}

function isMissingCollectionContext(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const status = 'status' in error ? (error as PocketBaseLikeError).status : undefined
  const message = 'message' in error ? (error as PocketBaseLikeError).message : undefined
  return status === 404 && typeof message === 'string' && message.toLowerCase().includes('collection context')
}

function looksLikeDuplicateKey(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return false
  }
  const message = (error as PocketBaseLikeError).message
  if (typeof message !== 'string') return false
  const lower = message.toLowerCase()
  return lower.includes('unique') || lower.includes('duplicate')
}

function getAuthenticatedPb(request: NextRequest):
  | { pb: ReturnType<typeof createPbServer>; userId: string }
  | { error: NextResponse } {
  const authCookie = request.cookies.get('pb_auth')?.value
  const pb = createPbServer(authCookie)

  if (!pb.authStore.isValid || !pb.authStore.model) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  return { pb, userId: pb.authStore.model.id }
}

function normalizeInput(input: SavingsGoalInput) {
  return {
    month: typeof input.month === 'string' ? input.month : undefined,
    targetAmount: typeof input.targetAmount === 'number' ? input.targetAmount : undefined,
    note: typeof input.note === 'string' ? input.note : undefined,
  }
}

function stripUndefined(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined))
}

// GET - List savings goals
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) {
      return auth.error
    }
    const { pb, userId } = auth

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Math.min(parseInt(searchParams.get('page') || '1', 10), 10000))
    const perPage = Math.max(1, Math.min(parseInt(searchParams.get('perPage') || '50', 10), 500))

    const filters = [`user = "${escapeFilterValue(userId)}"`]
    const month = searchParams.get('month')
    if (month) {
      filters.push(`month = "${escapeFilterValue(month)}"`)
    }

    const result = await pb.collection('savings_goals').getList(page, perPage, {
      sort: '-month',
      filter: filters.join(' && '),
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Savings goals collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Get savings goals error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch savings goals') },
      { status: 500 }
    )
  }
}

// POST - Create savings goal (upsert per month)
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) {
      return auth.error
    }
    const { pb, userId } = auth

    const body = (await request.json()) as SavingsGoalInput
    const normalized = normalizeInput(body)

    if (!normalized.month || !/^\d{4}-\d{2}$/.test(normalized.month)) {
      return NextResponse.json({ error: 'month must be in YYYY-MM format' }, { status: 400 })
    }
    if (normalized.targetAmount === undefined || normalized.targetAmount < 0) {
      return NextResponse.json({ error: 'targetAmount must be a non-negative number' }, { status: 400 })
    }

    const payload = stripUndefined({
      user: userId,
      month: normalized.month,
      targetAmount: normalized.targetAmount,
      note: normalized.note,
    })

    try {
      const created = await pb.collection('savings_goals').create(payload)
      return NextResponse.json(created)
    } catch (error: unknown) {
      if (!looksLikeDuplicateKey(error)) {
        throw error
      }
    }

    const existing = await pb.collection('savings_goals').getFirstListItem(
      `user = "${userId}" && month = "${normalized.month}"`
    ) as SavingsGoalRecord
    const updated = await pb.collection('savings_goals').update(existing.id, payload)
    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Savings goals collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Create savings goal error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to create savings goal') },
      { status: 500 }
    )
  }
}
