import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'
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
    symbol: typeof input.symbol === 'string' ? input.symbol.trim().toUpperCase() || undefined : undefined,
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

// GET - List savings assets
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) {
      return auth.error
    }
    const { pb, userId } = auth

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const perPage = Math.max(1, parseInt(searchParams.get('perPage') || '100', 10))
    const rawType = searchParams.get('type')
    const type = rawType ? rawType.trim().toLowerCase() : ''

    if (type && !isSavingsAssetType(type)) {
      return NextResponse.json(
        { error: 'type must be one of insurance, crypto, stocks, personal_funds' },
        { status: 400 }
      )
    }

    const filters = [`user = "${userId}"`]
    if (type) {
      filters.push(`type = "${type}"`)
    }

    const result = await pb.collection('savings_assets').getList(page, perPage, {
      sort: '-updated',
      filter: filters.join(' && '),
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Savings assets collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Get savings assets error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch savings assets') },
      { status: 500 }
    )
  }
}

// POST - Create savings asset
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) {
      return auth.error
    }
    const { pb, userId } = auth

    const body = (await request.json()) as SavingsAssetInput
    const normalized = normalizeInput(body)

    if (!normalized.type || !isSavingsAssetType(normalized.type)) {
      return NextResponse.json(
        { error: 'type must be one of insurance, crypto, stocks, personal_funds' },
        { status: 400 }
      )
    }

    if (!normalized.name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      )
    }

    if (
      normalized.amount === undefined ||
      normalized.amount === null ||
      !Number.isFinite(normalized.amount) ||
      normalized.amount < 0
    ) {
      return NextResponse.json(
        { error: 'amount must be a non-negative number' },
        { status: 400 }
      )
    }

    if (normalized.type === 'crypto' && !normalized.symbol) {
      return NextResponse.json(
        { error: 'symbol is required for crypto assets' },
        { status: 400 }
      )
    }

    if (normalized.symbol && !isValidAssetSymbol(normalized.symbol)) {
      return NextResponse.json(
        { error: 'symbol must contain only A-Z, 0-9, or hyphen (2-20 chars)' },
        { status: 400 }
      )
    }

    const recurringEnabled =
      normalized.type === 'insurance' &&
      normalized.recurringMonthlyAmount !== undefined &&
      normalized.recurringMonthlyAmount !== null &&
      normalized.recurringMonthlyAmount > 0

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

    if (normalized.recurringStartDate && !isValidDateOnly(normalized.recurringStartDate)) {
      return NextResponse.json(
        { error: 'recurringStartDate must be a valid YYYY-MM-DD date' },
        { status: 400 }
      )
    }

    if (normalized.recurringStartDate && !recurringEnabled) {
      return NextResponse.json(
        { error: 'recurringStartDate requires a recurringMonthlyAmount greater than 0 for insurance assets' },
        { status: 400 }
      )
    }

    if (recurringEnabled && !normalized.recurringStartDate) {
      return NextResponse.json(
        { error: 'recurringStartDate is required when recurringMonthlyAmount is enabled for insurance assets' },
        { status: 400 }
      )
    }

    const created = await pb.collection('savings_assets').create(stripUndefined({
      user: userId,
      type: normalized.type,
      name: normalized.name,
      amount: normalized.amount,
      symbol: normalized.symbol,
      note: normalized.note,
      recurringMonthlyAmount: recurringEnabled ? normalized.recurringMonthlyAmount : undefined,
      recurringStartDate: recurringEnabled ? normalized.recurringStartDate : undefined,
    }))

    return NextResponse.json(created)
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Savings assets collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Create savings asset error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to create savings asset') },
      { status: 500 }
    )
  }
}
