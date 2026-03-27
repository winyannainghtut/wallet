import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'
import { parseLiabilityInput } from '@/lib/liabilities'

type PocketBaseLikeError = {
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

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) return auth.error
    const { pb, userId } = auth

    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get('page') || '1', 10)
    const perPage = Number.parseInt(searchParams.get('perPage') || '100', 10)

    const result = await pb.collection('liabilities').getList(page, perPage, {
      sort: '-created',
      filter: `user = "${userId}"`,
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('Get liabilities error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch liabilities') },
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
    const parsed = parseLiabilityInput(body)
    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error || 'Invalid liability payload' }, { status: 400 })
    }

    const accountError = await ensureOwnedAccount(pb, userId, parsed.data.accountId)
    if (accountError) {
      return NextResponse.json({ error: accountError }, { status: 400 })
    }

    const record = await pb.collection('liabilities').create({
      ...parsed.data,
      accountId: parsed.data.accountId || undefined,
      targetPayoffDate: parsed.data.targetPayoffDate || undefined,
      note: parsed.data.note || undefined,
      user: userId,
    })

    return NextResponse.json(record)
  } catch (error: unknown) {
    console.error('Create liability error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to create liability') },
      { status: 500 }
    )
  }
}
