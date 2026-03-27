import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'
import { normalizeTransactionRuleRecord, parseTransactionRulePayload } from '@/lib/transaction-rules'

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

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) return auth.error
    const { pb, userId } = auth

    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('isActive')
    const filters = [`user = "${userId}"`]
    if (isActive === 'true') filters.push('isActive = true')
    if (isActive === 'false') filters.push('isActive = false')

    const result = await pb.collection('transaction_rules').getList(1, 500, {
      sort: '-isActive,created',
      filter: filters.join(' && '),
    })

    const items = (result.items || [])
      .map((item) => normalizeTransactionRuleRecord(item))
      .filter((item): item is NonNullable<ReturnType<typeof normalizeTransactionRuleRecord>> => item !== null)

    return NextResponse.json({ items, totalItems: items.length })
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Transaction rules collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Get transaction rules error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch transaction rules') },
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
    const parsed = parseTransactionRulePayload(body)
    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error || 'Invalid transaction rule payload' }, { status: 400 })
    }

    const record = await pb.collection('transaction_rules').create({
      ...parsed.data,
      user: userId,
    })

    return NextResponse.json(normalizeTransactionRuleRecord(record))
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Transaction rules collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Create transaction rule error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to create transaction rule') },
      { status: 500 }
    )
  }
}

