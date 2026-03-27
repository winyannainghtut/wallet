import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'
import { escapeFilterValue } from '@/lib/transaction-payload'

type PocketBaseLikeError = {
  status?: number
  message?: string
}

type TripMemberInput = {
  tripId?: unknown
  name?: unknown
  isOwner?: unknown
  sortOrder?: unknown
}

type TripMemberRecord = {
  id: string
  user?: string
  trip?: string
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

function normalizeInput(input: TripMemberInput) {
  const sortOrder =
    input.sortOrder === undefined
      ? undefined
      : typeof input.sortOrder === 'number'
          ? input.sortOrder
          : Number.parseInt(String(input.sortOrder).trim(), 10)

  return {
    tripId: typeof input.tripId === 'string' ? input.tripId.trim() : undefined,
    name: typeof input.name === 'string' ? input.name.trim() : undefined,
    isOwner: typeof input.isOwner === 'boolean' ? input.isOwner : undefined,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : Number.NaN,
  }
}

function stripUndefined(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined))
}

async function getOwnedMember(pb: ReturnType<typeof createPbServer>, userId: string, id: string) {
  const record = await pb.collection('trip_members').getOne(id) as TripMemberRecord
  if (record.user !== userId) {
    return null
  }
  return record
}

async function ensureTripOwned(
  pb: ReturnType<typeof createPbServer>,
  userId: string,
  tripId: string
): Promise<boolean> {
  try {
    const trip = await pb.collection('trips').getOne(tripId)
    return trip.user === userId
  } catch {
    return false
  }
}

async function hasMemberReferences(
  pb: ReturnType<typeof createPbServer>,
  userId: string,
  memberId: string
): Promise<boolean> {
  const transactionRefs = await pb.collection('transactions').getFullList({
    filter: `user = "${escapeFilterValue(userId)}" && paidByMemberId = "${escapeFilterValue(memberId)}"`,
  })
  if (transactionRefs.length > 0) {
    return true
  }

  const settlementRefs = await pb.collection('trip_settlements').getFullList({
    filter: `user = "${escapeFilterValue(userId)}" && (fromMemberId = "${escapeFilterValue(memberId)}" || toMemberId = "${escapeFilterValue(memberId)}")`,
  })
  return settlementRefs.length > 0
}

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
    const record = await getOwnedMember(pb, userId, id)

    if (!record) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(record)
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Trip members collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Get trip member error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch trip member') },
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
    if ('error' in auth) {
      return auth.error
    }
    const { pb, userId } = auth
    const { id } = await params
    const existing = await getOwnedMember(pb, userId, id)

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = (await request.json()) as TripMemberInput
    const normalized = normalizeInput(body)

    if (normalized.name !== undefined && !normalized.name) {
      return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
    }
    if (
      normalized.sortOrder !== undefined &&
      !Number.isNaN(normalized.sortOrder) &&
      normalized.sortOrder < 0
    ) {
      return NextResponse.json({ error: 'sortOrder must be a non-negative integer' }, { status: 400 })
    }
    if (normalized.tripId) {
      const tripOwned = await ensureTripOwned(pb, userId, normalized.tripId)
      if (!tripOwned) {
        return NextResponse.json({ error: 'tripId must reference your trip' }, { status: 400 })
      }
    }

    const record = await pb.collection('trip_members').update(id, stripUndefined({
      trip: normalized.tripId,
      name: normalized.name,
      isOwner: normalized.isOwner,
      sortOrder: Number.isNaN(normalized.sortOrder) ? undefined : normalized.sortOrder,
    }))

    return NextResponse.json(record)
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Trip members collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Update trip member error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to update trip member') },
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
    if ('error' in auth) {
      return auth.error
    }
    const { pb, userId } = auth
    const { id } = await params
    const existing = await getOwnedMember(pb, userId, id)

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const referenced = await hasMemberReferences(pb, userId, id)
    if (referenced) {
      return NextResponse.json(
        { error: 'This member is already used in shared expenses or settlements. Update the member instead of deleting it.' },
        { status: 400 }
      )
    }

    await pb.collection('trip_members').delete(id)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Trip members collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Delete trip member error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to delete trip member') },
      { status: 500 }
    )
  }
}
