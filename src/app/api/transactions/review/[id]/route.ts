import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'
import { parseTransactionReviewPatch } from '@/lib/transaction-rules'
import { ensureAccountExistsForUser } from '@/lib/transaction-payload'

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

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && (error as PocketBaseLikeError).status === 404
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

async function resolveReviewRecord(
  pb: ReturnType<typeof createPbServer>,
  userId: string,
  id: string
): Promise<{ source: 'transactions' | 'incomes' } | null> {
  try {
    const transaction = await pb.collection('transactions').getOne(id)
    if (transaction.user === userId) {
      return { source: 'transactions' }
    }
  } catch (error: unknown) {
    if (!isNotFoundError(error)) {
      throw error
    }
  }

  try {
    const income = await pb.collection('incomes').getOne(id)
    if (income.user === userId) {
      return { source: 'incomes' }
    }
  } catch (error: unknown) {
    if (!isNotFoundError(error) && !isMissingCollectionContext(error)) {
      throw error
    }
  }

  return null
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) return auth.error
    const { pb, userId } = auth
    const { id } = await params

    const existing = await resolveReviewRecord(pb, userId, id)
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = parseTransactionReviewPatch(body)
    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error || 'Invalid review payload' }, { status: 400 })
    }

    if (typeof parsed.data.accountId === 'string' && parsed.data.accountId.length > 0) {
      const accountExists = await ensureAccountExistsForUser(pb, userId, parsed.data.accountId)
      if (!accountExists) {
        return NextResponse.json(
          { error: 'accountId must reference an existing account for this user' },
          { status: 400 }
        )
      }
    }

    const record = await pb.collection(existing.source).update(id, parsed.data)
    return NextResponse.json(record)
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Transactions review metadata is unavailable. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.error('Update transaction review error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to update transaction review state') },
      { status: 500 }
    )
  }
}
