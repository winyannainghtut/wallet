import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'
import { normalizeBudgetRecord, parseBudgetPayload } from '@/lib/budgets'
import { escapeFilterValue } from '@/lib/transaction-payload'

type PocketBaseLikeError = {
  status?: number
  message?: string
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

async function findBudgetConflict(
  pb: ReturnType<typeof createPbServer>,
  userId: string,
  month: string,
  category: string
): Promise<Record<string, unknown> | null> {
  try {
    return await pb.collection('budgets').getFirstListItem(
      `user = "${escapeFilterValue(userId)}" && month = "${escapeFilterValue(month)}" && category = "${escapeFilterValue(category)}"`
    )
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'status' in error && (error as PocketBaseLikeError).status === 404) {
      return null
    }
    throw error
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) return auth.error
    const { pb, userId } = auth

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')?.trim()
    const isActive = searchParams.get('isActive')

    const filters = [`user = "${userId}"`]
    if (month) filters.push(`month = "${month}"`)
    if (isActive === 'true') filters.push('isActive = true')
    if (isActive === 'false') filters.push('isActive = false')

    const result = await pb.collection('budgets').getList(1, 500, {
      sort: '-month,category',
      filter: filters.join(' && '),
    })

    const items = (result.items || [])
      .map((item) => normalizeBudgetRecord(item))
      .filter((item): item is NonNullable<ReturnType<typeof normalizeBudgetRecord>> => item !== null)

    return NextResponse.json({ items, totalItems: items.length })
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Budgets collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Get budgets error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch budgets') },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) return auth.error
    const { pb, userId } = auth

    const body = await request.json()
    const parsed = parseBudgetPayload(body)
    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error || 'Invalid budget payload' }, { status: 400 })
    }

    const month = String(parsed.data.month ?? '')
    const category = String(parsed.data.category ?? '')
    const duplicate = await findBudgetConflict(pb, userId, month, category)
    if (duplicate) {
      return NextResponse.json(
        { error: 'A budget for this month and category already exists.' },
        { status: 409 }
      )
    }

    const record = await pb.collection('budgets').create({
      ...parsed.data,
      user: userId,
    })

    return NextResponse.json(normalizeBudgetRecord(record))
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Budgets collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Create budget error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to create budget') },
      { status: 500 }
    )
  }
}
