import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'

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

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) {
      return auth.error
    }
    const { pb, userId } = auth

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const perPage = Math.max(1, parseInt(searchParams.get('perPage') || '200', 10))
    const tripId = searchParams.get('tripId')?.trim()

    const filters = [`user = "${userId}"`]
    if (tripId) {
      filters.push(`trip = "${tripId}"`)
    }

    const result = await pb.collection('trip_members').getList(page, perPage, {
      sort: 'trip,sortOrder,name',
      filter: filters.join(' && '),
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Trip members collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Get trip members error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch trip members') },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) {
      return auth.error
    }
    const { pb, userId } = auth
    const body = (await request.json()) as TripMemberInput
    const normalized = normalizeInput(body)

    if (!normalized.tripId) {
      return NextResponse.json({ error: 'tripId is required' }, { status: 400 })
    }
    if (!normalized.name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (
      normalized.sortOrder !== undefined &&
      !Number.isNaN(normalized.sortOrder) &&
      normalized.sortOrder < 0
    ) {
      return NextResponse.json({ error: 'sortOrder must be a non-negative integer' }, { status: 400 })
    }

    const tripOwned = await ensureTripOwned(pb, userId, normalized.tripId)
    if (!tripOwned) {
      return NextResponse.json({ error: 'tripId must reference your trip' }, { status: 400 })
    }

    const record = await pb.collection('trip_members').create(stripUndefined({
      user: userId,
      trip: normalized.tripId,
      name: normalized.name,
      isOwner: normalized.isOwner ?? false,
      sortOrder: Number.isNaN(normalized.sortOrder) ? undefined : normalized.sortOrder,
    }))

    return NextResponse.json(record)
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Trip members collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Create trip member error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to create trip member') },
      { status: 500 }
    )
  }
}
