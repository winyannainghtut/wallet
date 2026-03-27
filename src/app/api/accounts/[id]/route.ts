import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'
import { parseAccountInput } from '@/lib/accounts'
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

async function clearAccountReferences(
  pb: ReturnType<typeof createPbServer>,
  userId: string,
  accountId: string
) {
  const filter = `user = "${escapeFilterValue(userId)}" && accountId = "${escapeFilterValue(accountId)}"`

  const clearCollectionReferences = async (collectionName: 'transactions' | 'incomes') => {
    const records = await pb.collection(collectionName).getFullList<{ id: string }>({
      filter,
      sort: 'created',
    })

    for (const record of records) {
      await pb.collection(collectionName).update(record.id, { accountId: null })
    }
  }

  await clearCollectionReferences('transactions')

  try {
    await clearCollectionReferences('incomes')
  } catch (error: unknown) {
    if (!isNotFoundError(error)) {
      throw error
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) return auth.error
    const { pb, userId } = auth

    const { id } = await params
    const record = await pb.collection('accounts').getOne(id)
    if (record.user !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(record)
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.error('Get account error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch account') },
      { status: 500 }
    )
  }
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
    const existing = await pb.collection('accounts').getOne(id)
    if (existing.user !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = parseAccountInput(body)
    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error || 'Invalid account payload' }, { status: 400 })
    }

    const record = await pb.collection('accounts').update(id, {
      ...parsed.data,
      institution: parsed.data.institution || undefined,
      note: parsed.data.note || undefined,
    })

    return NextResponse.json(record)
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.error('Update account error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to update account') },
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
    const existing = await pb.collection('accounts').getOne(id)
    if (existing.user !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await clearAccountReferences(pb, userId, id)
    await pb.collection('accounts').delete(id)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.error('Delete account error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to delete account') },
      { status: 500 }
    )
  }
}
