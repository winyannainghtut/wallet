import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'
import { parseTransactionPayload } from '@/lib/transaction-payload'

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

function isNotFoundError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    return (error as PocketBaseLikeError).status === 404
  }
  return false
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

// GET - Get single transaction
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) {
      return auth.error
    }
    const { pb, userId } = auth

    const { id } = await params
    const record = await pb.collection('transactions').getOne(id)
    if (record.user !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(record)
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.error('Get transaction error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch transaction') },
      { status: 500 }
    )
  }
}

// PUT - Update transaction
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) {
      return auth.error
    }
    const { pb, userId } = auth

    const { id } = await params
    const existing = await pb.collection('transactions').getOne(id)
    if (existing.user !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = await parseTransactionPayload(body, {
      pb,
      userId,
      partial: true,
      existing: {
        type: existing.type,
        amount: existing.amount,
        sourceAmount: existing.sourceAmount,
        sourceCurrency: existing.sourceCurrency,
        sourceExchangeRate: existing.sourceExchangeRate,
        accountId: existing.accountId,
        tripId: existing.tripId,
        trip: existing.trip,
        sharedGroupExpense: existing.sharedGroupExpense,
        paidByMemberId: existing.paidByMemberId,
      },
    })

    if (!parsed.data) {
      return NextResponse.json(
        { error: parsed.error || 'Invalid transaction payload' },
        { status: 400 }
      )
    }

    const record = await pb.collection('transactions').update(id, parsed.data)

    return NextResponse.json(record)
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.error('Update transaction error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to update transaction') },
      { status: 500 }
    )
  }
}

// DELETE - Delete transaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) {
      return auth.error
    }
    const { pb, userId } = auth

    const { id } = await params
    const existing = await pb.collection('transactions').getOne(id)
    if (existing.user !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await pb.collection('transactions').delete(id)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.error('Delete transaction error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to delete transaction') },
      { status: 500 }
    )
  }
}
