import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'
import { escapeFilterValue } from '@/lib/transaction-payload'
import { parseIncomePayload } from '@/lib/income-payload'

type PocketBaseLikeError = {
  status?: number
  message?: string
}

type IncomeRecord = {
  id: string
  user?: string
  type?: string
  date?: string
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

function compareByDateDesc(a: IncomeRecord, b: IncomeRecord): number {
  const dateA = typeof a.date === 'string' ? a.date : ''
  const dateB = typeof b.date === 'string' ? b.date : ''
  return dateB.localeCompare(dateA)
}

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) {
      return auth.error
    }
    const { pb, userId } = auth

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const perPage = Math.max(1, parseInt(searchParams.get('perPage') || '100', 10))
    let incomesItems: IncomeRecord[] = []
    try {
      incomesItems = await pb.collection('incomes').getFullList<IncomeRecord>({
        sort: '-date',
        filter: `user = "${escapeFilterValue(userId)}"`,
      })
    } catch (error: unknown) {
      if (!isMissingCollectionContext(error)) {
        throw error
      }
    }

    let legacyItems: IncomeRecord[] = []
    try {
      legacyItems = await pb.collection('transactions').getFullList<IncomeRecord>({
        sort: '-date',
        filter: `user = "${escapeFilterValue(userId)}" && type = "income"`,
      })
    } catch (error: unknown) {
      if (!isMissingCollectionContext(error)) {
        throw error
      }
    }

    const mergedMap = new Map<string, IncomeRecord>()
    for (const item of incomesItems) mergedMap.set(item.id, item)
    for (const item of legacyItems) {
      if (!mergedMap.has(item.id)) mergedMap.set(item.id, item)
    }

    const mergedItems = Array.from(mergedMap.values()).sort(compareByDateDesc)
    const totalItems = mergedItems.length
    const totalPages = Math.max(1, Math.ceil(totalItems / perPage))
    const offset = (page - 1) * perPage
    const items = mergedItems.slice(offset, offset + perPage)

    return NextResponse.json({
      page,
      perPage,
      totalItems,
      totalPages,
      items,
    })
  } catch (error: unknown) {
    console.error('Get incomes error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch incomes') },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) {
      return auth.error
    }
    const { pb, userId } = auth

    const body = await request.json()
    const parsed = await parseIncomePayload(body, { pb, userId })
    if (!parsed.data) {
      return NextResponse.json(
        { error: parsed.error || 'Invalid income payload' },
        { status: 400 }
      )
    }

    try {
      const record = await pb.collection('incomes').create({
        ...parsed.data.collectionData,
        user: userId,
      })
      return NextResponse.json(record)
    } catch (error: unknown) {
      if (!isMissingCollectionContext(error)) {
        throw error
      }
    }

    const fallbackRecord = await pb.collection('transactions').create({
      ...parsed.data.legacyData,
      user: userId,
    })

    return NextResponse.json(fallbackRecord)
  } catch (error: unknown) {
    console.error('Create income error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to create income') },
      { status: 500 }
    )
  }
}
