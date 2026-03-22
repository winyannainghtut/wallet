import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'

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

// GET - List trips
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) {
      return auth.error
    }
    const { pb, userId } = auth

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('perPage') || '100')

    const result = await pb.collection('trips').getList(page, perPage, {
      sort: '-created',
      filter: `user = "${userId}"`,
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('Get trips error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch trips') },
      { status: 500 }
    )
  }
}

// POST - Create trip
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) {
      return auth.error
    }
    const { pb, userId } = auth

    const body = await request.json()

    const record = await pb.collection('trips').create({
      ...body,
      user: userId,
    })

    return NextResponse.json(record)
  } catch (error: unknown) {
    console.error('Create trip error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to create trip') },
      { status: 500 }
    )
  }
}
