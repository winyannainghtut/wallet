import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'

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

async function clearTripFromTransactions(pb: ReturnType<typeof createPbServer>, userId: string, tripId: string) {
  try {
    const records = await pb.collection('transactions').getFullList({
      filter: `user = "${userId}" && tripId = "${tripId}"`,
    })

    await Promise.all(
      records.map(async (record: { id: string }) => {
        try {
          await pb.collection('transactions').update(record.id, { tripId: null })
        } catch {
          await pb.collection('transactions').update(record.id, { tripId: '' })
        }
      })
    )
  } catch (error) {
    // Ignore if the transactions collection doesn't have tripId yet.
    console.warn('Skipping trip transaction unlink:', getErrorMessage(error, 'Unknown error'))
  }
}

// GET - Get single trip
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
    const record = await pb.collection('trips').getOne(id)
    if (record.user !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(record)
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.error('Get trip error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch trip') },
      { status: 500 }
    )
  }
}

// PUT - Update trip
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
    const existing = await pb.collection('trips').getOne(id)
    if (existing.user !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json()
    const record = await pb.collection('trips').update(id, body)

    return NextResponse.json(record)
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.error('Update trip error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to update trip') },
      { status: 500 }
    )
  }
}

// DELETE - Delete trip
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
    const existing = await pb.collection('trips').getOne(id)
    if (existing.user !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await clearTripFromTransactions(pb, userId, id)
    await pb.collection('trips').delete(id)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.error('Delete trip error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to delete trip') },
      { status: 500 }
    )
  }
}
