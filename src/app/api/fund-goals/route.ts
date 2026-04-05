import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'
import { escapeFilterValue } from '@/lib/transaction-payload'

type PocketBaseLikeError = {
  status?: number
  message?: string
}

type FundGoalInput = {
  name?: unknown
  targetAmount?: unknown
  targetDate?: unknown
  monthlyContribution?: unknown
  includeMonthlySavings?: unknown
  linkedTripId?: unknown
  linkedAssets?: unknown
  note?: unknown
  status?: unknown
  color?: unknown
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

function parseRelationArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
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

function normalizeInput(input: FundGoalInput) {
  return {
    name: parseOptionalString(input.name),
    targetAmount: parseOptionalNumber(input.targetAmount),
    targetDate: parseOptionalString(input.targetDate),
    monthlyContribution: parseOptionalNumber(input.monthlyContribution),
    includeMonthlySavings:
      typeof input.includeMonthlySavings === 'boolean'
        ? input.includeMonthlySavings
        : undefined,
    linkedTripId: parseOptionalString(input.linkedTripId),
    linkedAssets: parseRelationArray(input.linkedAssets),
    note: parseOptionalString(input.note),
    status: parseOptionalString(input.status),
    color: parseOptionalString(input.color),
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

async function ensureAssetIdsOwned(
  pb: ReturnType<typeof createPbServer>,
  userId: string,
  assetIds: string[]
): Promise<boolean> {
  if (assetIds.length === 0) return true

  for (const assetId of assetIds) {
    try {
      const asset = await pb.collection('savings_assets').getOne(assetId)
      if (asset.user !== userId) {
        return false
      }
    } catch {
      return false
    }
  }

  return true
}

// GET - List fund goals
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) {
      return auth.error
    }
    const { pb, userId } = auth

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Math.min(parseInt(searchParams.get('page') || '1', 10), 10000))
    const perPage = Math.max(1, Math.min(parseInt(searchParams.get('perPage') || '100', 10), 500))
    const status = searchParams.get('status')?.trim()

    const filters = [`user = "${escapeFilterValue(userId)}"`]
    if (status) {
      filters.push(`status = "${escapeFilterValue(status)}"`)
    }

    const result = await pb.collection('fund_goals').getList(page, perPage, {
      sort: 'targetDate,name',
      filter: filters.join(' && '),
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Fund goals collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Get fund goals error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch fund goals') },
      { status: 500 }
    )
  }
}

// POST - Create fund goal
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) {
      return auth.error
    }
    const { pb, userId } = auth

    const body = (await request.json()) as FundGoalInput
    const normalized = normalizeInput(body)

    if (!normalized.name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (
      normalized.targetAmount === undefined ||
      normalized.targetAmount === null ||
      !Number.isFinite(normalized.targetAmount) ||
      normalized.targetAmount < 0
    ) {
      return NextResponse.json({ error: 'targetAmount must be a non-negative number' }, { status: 400 })
    }
    if (
      normalized.targetDate !== undefined &&
      normalized.targetDate !== null &&
      !isValidDateOnly(normalized.targetDate)
    ) {
      return NextResponse.json({ error: 'targetDate must be a valid YYYY-MM-DD date' }, { status: 400 })
    }
    if (
      normalized.monthlyContribution !== undefined &&
      normalized.monthlyContribution !== null &&
      (!Number.isFinite(normalized.monthlyContribution) || normalized.monthlyContribution < 0)
    ) {
      return NextResponse.json({ error: 'monthlyContribution must be a non-negative number' }, { status: 400 })
    }

    const status = normalized.status ?? 'active'
    if (!['active', 'completed', 'archived'].includes(status)) {
      return NextResponse.json({ error: 'status must be active, completed, or archived' }, { status: 400 })
    }

    if (normalized.linkedTripId) {
      const tripOwned = await ensureTripOwned(pb, userId, normalized.linkedTripId)
      if (!tripOwned) {
        return NextResponse.json({ error: 'linkedTripId must reference your trip' }, { status: 400 })
      }
    }

    const linkedAssets = normalized.linkedAssets ?? []
    const assetsOwned = await ensureAssetIdsOwned(pb, userId, linkedAssets)
    if (!assetsOwned) {
      return NextResponse.json({ error: 'linkedAssets must reference your savings assets' }, { status: 400 })
    }

    const record = await pb.collection('fund_goals').create(stripUndefined({
      user: userId,
      name: normalized.name,
      targetAmount: normalized.targetAmount,
      targetDate: normalized.targetDate ?? undefined,
      monthlyContribution: normalized.monthlyContribution ?? undefined,
      includeMonthlySavings: normalized.includeMonthlySavings ?? false,
      linkedTripId: normalized.linkedTripId ?? undefined,
      linkedAssets,
      note: normalized.note ?? undefined,
      status,
      color: normalized.color ?? undefined,
    }))

    return NextResponse.json(record)
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Fund goals collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Create fund goal error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to create fund goal') },
      { status: 500 }
    )
  }
}
