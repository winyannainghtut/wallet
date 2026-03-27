import { createPbServer } from '@/lib/pb'

type PocketBaseLikeError = {
  status?: number
}

type TransactionType = 'income' | 'expense'

type TransactionPayloadInput = {
  type?: unknown
  category?: unknown
  amount?: unknown
  description?: unknown
  date?: unknown
  tripId?: unknown
  trip?: unknown
  sharedGroupExpense?: unknown
  paidByMemberId?: unknown
}

type ExistingTransaction = {
  type?: unknown
  tripId?: unknown
  trip?: unknown
  sharedGroupExpense?: unknown
  paidByMemberId?: unknown
}

type ParseOptions = {
  partial?: boolean
  userId: string
  pb: ReturnType<typeof createPbServer>
  existing?: ExistingTransaction
}

function hasOwn<T extends object>(obj: T, key: keyof T): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && (error as PocketBaseLikeError).status === 404
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeTripId(value: unknown): string {
  if (Array.isArray(value)) {
    const first = value.find((item): item is string => typeof item === 'string' && item.trim().length > 0)
    return first ? first.trim() : ''
  }

  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

function normalizeType(value: unknown): TransactionType | null {
  if (value === 'income' || value === 'expense') {
    return value
  }

  return null
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

async function ensureTripExistsForUser(
  pb: ReturnType<typeof createPbServer>,
  userId: string,
  tripId: string
): Promise<boolean> {
  try {
    const trip = await pb.collection('trips').getOne(tripId)
    return trip.user === userId
  } catch (error) {
    if (isNotFoundError(error)) {
      return false
    }

    throw error
  }
}

async function ensureTripMemberExistsForTrip(
  pb: ReturnType<typeof createPbServer>,
  userId: string,
  tripId: string,
  memberId: string
): Promise<boolean> {
  try {
    const member = await pb.collection('trip_members').getOne(memberId)
    return member.user === userId && member.trip === tripId
  } catch (error) {
    if (isNotFoundError(error)) {
      return false
    }

    throw error
  }
}

export function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export async function parseTransactionPayload(
  input: unknown,
  options: ParseOptions
): Promise<{ data?: Record<string, unknown>; error?: string }> {
  if (typeof input !== 'object' || input === null) {
    return { error: 'Invalid transaction payload' }
  }

  const body = input as TransactionPayloadInput
  const partial = options.partial === true

  const hasType = hasOwn(body, 'type')
  const hasCategory = hasOwn(body, 'category')
  const hasAmount = hasOwn(body, 'amount')
  const hasDescription = hasOwn(body, 'description')
  const hasDate = hasOwn(body, 'date')
  const hasTripId = hasOwn(body, 'tripId')
  const hasSharedGroupExpense = hasOwn(body, 'sharedGroupExpense')
  const hasPaidByMemberId = hasOwn(body, 'paidByMemberId')

  const nextType = hasType ? normalizeType(body.type) : null
  if ((!partial || hasType) && !nextType) {
    return { error: 'type must be either "income" or "expense"' }
  }

  const category = hasCategory ? normalizeText(body.category) : ''
  if ((!partial || hasCategory) && !category) {
    return { error: 'category is required' }
  }

  const amount = hasAmount
    ? typeof body.amount === 'number'
      ? body.amount
      : Number.parseFloat(String(body.amount).trim())
    : null
  if ((!partial || hasAmount) && (!Number.isFinite(amount) || amount === null || amount <= 0)) {
    return { error: 'amount must be a positive number' }
  }

  const date = hasDate ? normalizeText(body.date) : ''
  if ((!partial || hasDate) && !isValidDateOnly(date)) {
    return { error: 'date must be a valid YYYY-MM-DD value' }
  }

  const description = hasDescription ? normalizeText(body.description).slice(0, 500) : ''

  const existingType = normalizeType(options.existing?.type)
  const existingTripId = normalizeTripId(options.existing?.tripId ?? options.existing?.trip)
  const existingSharedGroupExpense = options.existing?.sharedGroupExpense === true
  const existingPaidByMemberId = normalizeTripId(options.existing?.paidByMemberId)

  const effectiveType = nextType ?? existingType
  if (!effectiveType) {
    return { error: 'type is required' }
  }

  const requestedTripId = hasTripId ? normalizeTripId(body.tripId) : undefined
  const requestedSharedGroupExpense = hasSharedGroupExpense ? body.sharedGroupExpense === true : undefined
  const requestedPaidByMemberId = hasPaidByMemberId ? normalizeTripId(body.paidByMemberId) : undefined

  const effectiveTripId = effectiveType === 'income'
    ? ''
    : requestedTripId !== undefined
      ? requestedTripId
      : existingTripId

  const effectiveSharedGroupExpense = effectiveType === 'income'
    ? false
    : effectiveTripId
      ? requestedSharedGroupExpense ?? existingSharedGroupExpense
      : false
  const effectivePaidByMemberId = effectiveType === 'income'
    ? ''
    : effectiveSharedGroupExpense
      ? requestedPaidByMemberId ?? existingPaidByMemberId
      : ''

  if (effectiveType === 'expense' && effectiveSharedGroupExpense && !effectiveTripId) {
    return { error: 'sharedGroupExpense requires a tripId' }
  }

  if (effectiveType === 'expense' && effectiveTripId) {
    const tripExists = await ensureTripExistsForUser(options.pb, options.userId, effectiveTripId)
    if (!tripExists) {
      return { error: 'tripId must reference an existing trip for this user' }
    }
  }

  if (effectiveType === 'expense' && effectiveSharedGroupExpense && !effectivePaidByMemberId) {
    return { error: 'paidByMemberId is required for shared group expenses' }
  }

  if (effectiveType === 'expense' && effectiveSharedGroupExpense && effectiveTripId && effectivePaidByMemberId) {
    const memberExists = await ensureTripMemberExistsForTrip(
      options.pb,
      options.userId,
      effectiveTripId,
      effectivePaidByMemberId
    )
    if (!memberExists) {
      return { error: 'paidByMemberId must reference a member of the selected trip' }
    }
  }

  const payload: Record<string, unknown> = {}
  if (!partial || hasType) payload.type = effectiveType
  if (!partial || hasCategory) payload.category = category
  if (!partial || hasAmount) payload.amount = amount
  if (!partial || hasDescription) payload.description = description
  if (!partial || hasDate) payload.date = date

  const shouldIncludeTripState =
    !partial ||
    hasTripId ||
    hasSharedGroupExpense ||
    hasPaidByMemberId ||
    (hasType && effectiveType !== existingType)

  if (shouldIncludeTripState) {
    payload.tripId = effectiveTripId
    payload.sharedGroupExpense = effectiveSharedGroupExpense
    payload.paidByMemberId = effectivePaidByMemberId
  }

  return { data: payload }
}
