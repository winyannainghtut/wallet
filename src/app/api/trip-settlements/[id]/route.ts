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

type TripSettlementRecord = {
  id: string
  user?: string
  trip?: string
  fromMemberId?: string
  toMemberId?: string
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

async function getOwnedSettlement(pb: ReturnType<typeof createPbServer>, userId: string, id: string) {
  const record = await pb.collection('trip_settlements').getOne(id) as TripSettlementRecord
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
    const record = await getOwnedSettlement(pb, userId, id)

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
        { error: 'Trip settlements collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Get trip settlement error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch trip settlement') },
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
    const existing = await getOwnedSettlement(pb, userId, id)

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = (await request.json()) as TripSettlementInput
    const normalized = normalizeInput(body)
    const effectiveTripId = normalized.tripId ?? existing.trip
    const effectiveFromMemberId = normalized.fromMemberId ?? existing.fromMemberId
    const effectiveToMemberId = normalized.toMemberId ?? existing.toMemberId

    if (effectiveTripId && normalized.tripId) {
      const tripOwned = await ensureTripOwned(pb, userId, effectiveTripId)
      if (!tripOwned) {
        return NextResponse.json({ error: 'tripId must reference your trip' }, { status: 400 })
      }
    }
    if (
      normalized.amount !== undefined &&
      normalized.amount !== null &&
      (!Number.isFinite(normalized.amount) || normalized.amount <= 0)
    ) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }
    if (normalized.date !== undefined && normalized.date !== null && !isValidDateOnly(normalized.date)) {
      return NextResponse.json({ error: 'date must be a valid YYYY-MM-DD date' }, { status: 400 })
    }
    if (
      normalized.status !== undefined &&
      normalized.status !== null &&
      !['planned', 'paid'].includes(normalized.status)
    ) {
      return NextResponse.json({ error: 'status must be planned or paid' }, { status: 400 })
    }
    if (
      effectiveTripId &&
      effectiveFromMemberId &&
      effectiveToMemberId &&
      effectiveFromMemberId === effectiveToMemberId
    ) {
      return NextResponse.json({ error: 'fromMemberId and toMemberId must be different' }, { status: 400 })
    }
    if (effectiveTripId && effectiveFromMemberId && effectiveToMemberId) {
      const membersValid = await Promise.all([
        ensureMemberOwnedByTrip(pb, userId, effectiveTripId, effectiveFromMemberId),
        ensureMemberOwnedByTrip(pb, userId, effectiveTripId, effectiveToMemberId),
      ])
      if (membersValid.some((value) => !value)) {
        return NextResponse.json({ error: 'Settlement members must belong to the selected trip' }, { status: 400 })
      }
    }

    const record = await pb.collection('trip_settlements').update(id, stripUndefined({
      trip: normalized.tripId,
      fromMemberId: normalized.fromMemberId,
      toMemberId: normalized.toMemberId,
      amount: normalized.amount ?? undefined,
      date: normalized.date ?? undefined,
      status: normalized.status ?? undefined,
      note: normalized.note ?? null,
    }))

    return NextResponse.json(record)
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Trip settlements collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Update trip settlement error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to update trip settlement') },
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
    const existing = await getOwnedSettlement(pb, userId, id)

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await pb.collection('trip_settlements').delete(id)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Trip settlements collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Delete trip settlement error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to delete trip settlement') },
      { status: 500 }
    )
  }
}
