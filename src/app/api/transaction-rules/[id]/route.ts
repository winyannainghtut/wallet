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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) return auth.error
    const { pb, userId } = auth
    const { id } = await params

    const existing = await pb.collection('transaction_rules').getOne(id)
    if (existing.user !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = parseTransactionRulePayload(body, { partial: true })
    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error || 'Invalid transaction rule payload' }, { status: 400 })
    }

    const record = await pb.collection('transaction_rules').update(id, parsed.data)
    return NextResponse.json(normalizeTransactionRuleRecord(record))
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Transaction rules collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.error('Update transaction rule error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to update transaction rule') },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) return auth.error
    const { pb, userId } = auth
    const { id } = await params

    const existing = await pb.collection('transaction_rules').getOne(id)
    if (existing.user !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await pb.collection('transaction_rules').delete(id)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Transaction rules collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.error('Delete transaction rule error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to delete transaction rule') },
      { status: 500 }
    )
  }
}

