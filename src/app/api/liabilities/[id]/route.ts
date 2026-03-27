import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'
import { parseLiabilityInput } from '@/lib/liabilities'

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

async function ensureOwnedAccount(
  pb: ReturnType<typeof createPbServer>,
  userId: string,
  accountId: string
): Promise<string | null> {
  const trimmedAccountId = accountId.trim()
  if (!trimmedAccountId) {
    return null
  }

  try {
    const account = await pb.collection('accounts').getOne(trimmedAccountId)
    if (account.user !== userId) {
      return 'Selected account was not found'
    }
  } catch {
    return 'Selected account was not found'
  }

  return null
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
    const record = await pb.collection('liabilities').getOne(id)
    if (record.user !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(record)
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.error('Get liability error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch liability') },
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
    const existing = await pb.collection('liabilities').getOne(id)
    if (existing.user !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = parseLiabilityInput(body)
    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error || 'Invalid liability payload' }, { status: 400 })
    }

    const accountError = await ensureOwnedAccount(pb, userId, parsed.data.accountId)
    if (accountError) {
      return NextResponse.json({ error: accountError }, { status: 400 })
    }

    const record = await pb.collection('liabilities').update(id, {
      ...parsed.data,
      accountId: parsed.data.accountId || undefined,
      targetPayoffDate: parsed.data.targetPayoffDate || undefined,
      note: parsed.data.note || undefined,
    })

    return NextResponse.json(record)
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.error('Update liability error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to update liability') },
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
    const existing = await pb.collection('liabilities').getOne(id)
    if (existing.user !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await pb.collection('liabilities').delete(id)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.error('Delete liability error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to delete liability') },
      { status: 500 }
    )
  }
}
