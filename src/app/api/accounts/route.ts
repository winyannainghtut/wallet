import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'
import { parseAccountInput } from '@/lib/accounts'
import { escapeFilterValue } from '@/lib/transaction-payload'

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

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) return auth.error
    const { pb, userId } = auth

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Math.min(Number.parseInt(searchParams.get('page') || '1', 10), 10000))
    const perPage = Math.max(1, Math.min(Number.parseInt(searchParams.get('perPage') || '100', 10), 500))

    const result = await pb.collection('accounts').getList(page, perPage, {
      sort: '-created',
      filter: `user = "${escapeFilterValue(userId)}"`,
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('Get accounts error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch accounts') },
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
    const parsed = parseAccountInput(body)
    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error || 'Invalid account payload' }, { status: 400 })
    }

    const record = await pb.collection('accounts').create({
      ...parsed.data,
      institution: parsed.data.institution || undefined,
      note: parsed.data.note || undefined,
      user: userId,
    })

    return NextResponse.json(record)
  } catch (error: unknown) {
    console.error('Create account error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to create account') },
      { status: 500 }
    )
  }
}
