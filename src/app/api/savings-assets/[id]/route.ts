import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'
import { SavingsAssetType } from '@/types'
import { isSavingsAssetType } from '@/lib/savings-assets'

type PocketBaseLikeError = {
  status?: number
  message?: string
}

type SavingsAssetInput = {
  type?: string
  name?: string
  amount?: number | string | null
  symbol?: string
  note?: string
  recurringMonthlyAmount?: number | string | null
  recurringStartDate?: string | null
}

type SavingsAssetRecord = {
  id: string
  user?: string
  type?: SavingsAssetType
  amount?: number
  symbol?: string
  recurringMonthlyAmount?: number | null
  recurringStartDate?: string | null
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

function normalizeInput(input: SavingsAssetInput) {
  const parseNumber = (value: unknown): number | null | undefined => {
    if (value === undefined) return undefined
    if (value === null) return null
    if (typeof value === 'string' && value.trim().length === 0) return null
    const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value).trim())
    return Number.isFinite(parsed) ? parsed : Number.NaN
  }

  return {
    type: typeof input.type === 'string' ? input.type.trim().toLowerCase() : undefined,
    name: typeof input.name === 'string' ? input.name.trim() : undefined,
    amount: parseNumber(input.amount),
    symbol: typeof input.symbol === 'string' ? input.symbol.trim().toUpperCase() : undefined,
    note: typeof input.note === 'string' ? input.note.trim() : undefined,
    recurringMonthlyAmount: parseNumber(input.recurringMonthlyAmount),
    recurringStartDate:
      typeof input.recurringStartDate === 'string'
        ? input.recurringStartDate.trim() || null
        : input.recurringStartDate === null
          ? null
          : undefined,
  }
}

function isValidAssetSymbol(value: string): boolean {
  return /^[A-Z0-9-]{2,20}$/.test(value)
}

function stripUndefined(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined))
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

async function getOwnedAsset(
  pb: ReturnType<typeof createPbServer>,
  userId: string,
  id: string
) {
  const record = (await pb.collection('savings_assets').getOne(id)) as SavingsAssetRecord
  if (record.user !== userId) {
    return null
  }
  return record
}

// GET - Get single savings asset
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
    const record = await getOwnedAsset(pb, userId, id)
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
        { error: 'Savings assets collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Get savings asset error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch savings asset') },
      { status: 500 }
    )
  }
}

// PUT - Update savings asset
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
    const existing = await getOwnedAsset(pb, userId, id)
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = (await request.json()) as SavingsAssetInput
    const normalized = normalizeInput(body)

    if (normalized.type && !isSavingsAssetType(normalized.type)) {
      return NextResponse.json(
        { error: 'type must be one of insurance, crypto, stocks, personal_funds' },
        { status: 400 }
      )
    }

    if (normalized.name !== undefined && normalized.name.length === 0) {
      return NextResponse.json(
        { error: 'name cannot be empty' },
        { status: 400 }
      )
    }

    if (
      normalized.amount !== undefined &&
      normalized.amount !== null &&
      (!Number.isFinite(normalized.amount) || normalized.amount < 0)
    ) {
      return NextResponse.json(
        { error: 'amount must be a non-negative number' },
        { status: 400 }
      )
    }

    if (normalized.symbol !== undefined && normalized.symbol.length > 0 && !isValidAssetSymbol(normalized.symbol)) {
      return NextResponse.json(
        { error: 'symbol must contain only A-Z, 0-9, or hyphen (2-20 chars)' },
        { status: 400 }
      )
    }

    const effectiveType = normalized.type ?? existing.type
    const effectiveSymbol = normalized.symbol !== undefined ? normalized.symbol : existing.symbol
    if (effectiveType === 'crypto' && (!effectiveSymbol || effectiveSymbol.length === 0)) {
      return NextResponse.json(
        { error: 'symbol is required for crypto assets' },
        { status: 400 }
      )
    }

    const effectiveRecurringMonthlyAmount =
      normalized.recurringMonthlyAmount !== undefined
        ? normalized.recurringMonthlyAmount
        : existing.recurringMonthlyAmount
    const effectiveRecurringStartDate =
      normalized.recurringStartDate !== undefined
        ? normalized.recurringStartDate
        : existing.recurringStartDate
    const recurringEnabled =
      effectiveType === 'insurance' &&
      typeof effectiveRecurringMonthlyAmount === 'number' &&
      Number.isFinite(effectiveRecurringMonthlyAmount) &&
      effectiveRecurringMonthlyAmount > 0

    if (
      normalized.recurringMonthlyAmount !== undefined &&
      normalized.recurringMonthlyAmount !== null &&
      (!Number.isFinite(normalized.recurringMonthlyAmount) || normalized.recurringMonthlyAmount < 0)
    ) {
      return NextResponse.json(
        { error: 'recurringMonthlyAmount must be a non-negative number' },
        { status: 400 }
      )
    }

    if (effectiveRecurringStartDate && !isValidDateOnly(effectiveRecurringStartDate)) {
      return NextResponse.json(
        { error: 'recurringStartDate must be a valid YYYY-MM-DD date' },
        { status: 400 }
      )
    }

    if (effectiveRecurringStartDate && !recurringEnabled) {
      return NextResponse.json(
        { error: 'recurringStartDate requires a recurringMonthlyAmount greater than 0 for insurance assets' },
        { status: 400 }
      )
    }

    if (recurringEnabled && !effectiveRecurringStartDate) {
      return NextResponse.json(
        { error: 'recurringStartDate is required when recurringMonthlyAmount is enabled for insurance assets' },
        { status: 400 }
      )
    }

    const updated = await pb.collection('savings_assets').update(id, stripUndefined({
      type: normalized.type,
      name: normalized.name,
      amount: normalized.amount,
      symbol: normalized.symbol,
      note: normalized.note,
      recurringMonthlyAmount:
        normalized.type !== undefined && normalized.type !== 'insurance'
          ? null
          : recurringEnabled
            ? effectiveRecurringMonthlyAmount
            : normalized.recurringMonthlyAmount !== undefined || normalized.recurringStartDate !== undefined
              ? null
              : undefined,
      recurringStartDate:
        normalized.type !== undefined && normalized.type !== 'insurance'
          ? null
          : recurringEnabled
            ? effectiveRecurringStartDate
            : normalized.recurringMonthlyAmount !== undefined || normalized.recurringStartDate !== undefined
              ? null
              : undefined,
    }))

    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Savings assets collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Update savings asset error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to update savings asset') },
      { status: 500 }
    )
  }
}

// DELETE - Delete savings asset
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
    const existing = await getOwnedAsset(pb, userId, id)
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await pb.collection('savings_assets').delete(id)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Savings assets collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Delete savings asset error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to delete savings asset') },
      { status: 500 }
    )
  }
}
