import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'

type PocketBaseLikeError = {
  status?: number
  message?: string
}

type TripSettlementInput = {
  tripId?: unknown
  fromMemberId?: unknown
  toMemberId?: unknown
  amount?: unknown
  date?: unknown
  status?: unknown
  note?: unknown
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

function parseOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value === 'string' && value.trim().length === 0) return null
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value).trim())
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function parseOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isValidDateOnly(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return false
  }

  const year = Number.parseInt(match[1], 10)
  const month = Number.parseInt(match[2], 10)
  const day = Number.parseInt(match[3], 10)
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function normalizeInput(input: TripSettlementInput) {
  return {
    tripId: parseOptionalString(input.tripId),
    fromMemberId: parseOptionalString(input.fromMemberId),
    toMemberId: parseOptionalString(input.toMemberId),
    amount: parseOptionalNumber(input.amount),
    date: parseOptionalString(input.date),
    status: parseOptionalString(input.status),
    note: parseOptionalString(input.note),
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

async function ensureMemberOwnedByTrip(
  pb: ReturnType<typeof createPbServer>,
  userId: string,
  tripId: string,
  memberId: string
): Promise<boolean> {
  try {
    const member = await pb.collection('trip_members').getOne(memberId)
    return member.user === userId && member.trip === tripId
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

    const result = await pb.collection('trip_settlements').getList(page, perPage, {
      sort: '-date,-created',
      filter: filters.join(' && '),
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Trip settlements collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Get trip settlements error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch trip settlements') },
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
    const body = (await request.json()) as TripSettlementInput
    const normalized = normalizeInput(body)

    if (!normalized.tripId) {
      return NextResponse.json({ error: 'tripId is required' }, { status: 400 })
    }
    if (!normalized.fromMemberId || !normalized.toMemberId) {
      return NextResponse.json({ error: 'fromMemberId and toMemberId are required' }, { status: 400 })
    }
    if (normalized.fromMemberId === normalized.toMemberId) {
      return NextResponse.json({ error: 'fromMemberId and toMemberId must be different' }, { status: 400 })
    }
    if (
      normalized.amount === undefined ||
      normalized.amount === null ||
      !Number.isFinite(normalized.amount) ||
      normalized.amount <= 0
    ) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }
    if (!normalized.date || !isValidDateOnly(normalized.date)) {
      return NextResponse.json({ error: 'date must be a valid YYYY-MM-DD date' }, { status: 400 })
    }

    const status = normalized.status ?? 'paid'
    if (!['planned', 'paid'].includes(status)) {
      return NextResponse.json({ error: 'status must be planned or paid' }, { status: 400 })
    }

    const tripOwned = await ensureTripOwned(pb, userId, normalized.tripId)
    if (!tripOwned) {
      return NextResponse.json({ error: 'tripId must reference your trip' }, { status: 400 })
    }

    const membersValid = await Promise.all([
      ensureMemberOwnedByTrip(pb, userId, normalized.tripId, normalized.fromMemberId),
      ensureMemberOwnedByTrip(pb, userId, normalized.tripId, normalized.toMemberId),
    ])
    if (membersValid.some((value) => !value)) {
      return NextResponse.json({ error: 'Settlement members must belong to the selected trip' }, { status: 400 })
    }

    const record = await pb.collection('trip_settlements').create(stripUndefined({
      user: userId,
      trip: normalized.tripId,
      fromMemberId: normalized.fromMemberId,
      toMemberId: normalized.toMemberId,
      amount: normalized.amount,
      date: normalized.date,
      status,
      note: normalized.note ?? undefined,
    }))

    return NextResponse.json(record)
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Trip settlements collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Create trip settlement error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to create trip settlement') },
      { status: 500 }
    )
  }
}
