import { createPbServer } from '@/lib/pb'

type PocketBaseLikeError = {
  status?: number
}

type TransactionType = 'income' | 'expense'

type TransactionPayloadInput = {
  type?: unknown
  category?: unknown
  amount?: unknown
  sourceAmount?: unknown
  sourceCurrency?: unknown
  sourceExchangeRate?: unknown
  merchantName?: unknown
  tagsJson?: unknown
  reviewStatus?: unknown
  accountId?: unknown
  description?: unknown
  date?: unknown
  tripId?: unknown
  trip?: unknown
  sharedGroupExpense?: unknown
  paidByMemberId?: unknown
}

type ExistingTransaction = {
  type?: unknown
  amount?: unknown
  sourceAmount?: unknown
  sourceCurrency?: unknown
  sourceExchangeRate?: unknown
  merchantName?: unknown
  tagsJson?: unknown
  reviewStatus?: unknown
  accountId?: unknown
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

function normalizeCurrencyCode(value: unknown): string {
  const normalized = normalizeText(value).toUpperCase()
  if (!normalized) {
    return ''
  }

  return /^[A-Z]{3}$/.test(normalized) ? normalized : ''
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

function numbersAlmostEqual(a: number, b: number, tolerance = 1e-9): boolean {
  return Math.abs(a - b) <= tolerance
}

function normalizeType(value: unknown): TransactionType | null {
  if (value === 'income' || value === 'expense') {
    return value
  }

  return null
}

function normalizeReviewStatus(value: unknown): 'pending' | 'reviewed' | 'ignored' | null {
  if (value === 'pending' || value === 'reviewed' || value === 'ignored') {
    return value
  }

  return null
}

function normalizeTags(value: unknown): string[] {
  const raw = typeof value === 'string'
    ? (() => {
        try {
          return JSON.parse(value)
        } catch {
          return value.split(',').map((item) => item.trim()).filter(Boolean)
        }
      })()
    : value

  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .map((item) => item.slice(0, 40))
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, 12)
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
): Promise<Record<string, unknown> | null> {
  try {
    const trip = await pb.collection('trips').getOne(tripId)
    return trip.user === userId ? trip : null
  } catch (error) {
    if (isNotFoundError(error)) {
      return null
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

export async function ensureAccountExistsForUser(
  pb: ReturnType<typeof createPbServer>,
  userId: string,
  accountId: string
): Promise<boolean> {
  try {
    const account = await pb.collection('accounts').getOne(accountId)
    return account.user === userId
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
  const hasSourceAmount = hasOwn(body, 'sourceAmount')
  const hasSourceCurrency = hasOwn(body, 'sourceCurrency')
  const hasSourceExchangeRate = hasOwn(body, 'sourceExchangeRate')
  const hasMerchantName = hasOwn(body, 'merchantName')
  const hasTagsJson = hasOwn(body, 'tagsJson')
  const hasReviewStatus = hasOwn(body, 'reviewStatus')
  const hasAccountId = hasOwn(body, 'accountId')
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
  const merchantName = hasMerchantName ? normalizeText(body.merchantName).slice(0, 160) : ''
  const tags = hasTagsJson ? normalizeTags(body.tagsJson) : []
  const reviewStatus = hasReviewStatus ? normalizeReviewStatus(body.reviewStatus) : null
  const accountId = hasAccountId ? normalizeTripId(body.accountId) : ''
  if (hasReviewStatus && !reviewStatus) {
    return { error: 'reviewStatus must be pending, reviewed, or ignored' }
  }

  const existingType = normalizeType(options.existing?.type)
  const existingAmount =
    typeof options.existing?.amount === 'number'
      ? options.existing.amount
      : Number.parseFloat(String(options.existing?.amount ?? '').trim())
  const existingSourceAmount =
    typeof options.existing?.sourceAmount === 'number'
      ? options.existing.sourceAmount
      : Number.parseFloat(String(options.existing?.sourceAmount ?? '').trim())
  const existingSourceCurrency = normalizeCurrencyCode(options.existing?.sourceCurrency)
  const existingSourceExchangeRate =
    typeof options.existing?.sourceExchangeRate === 'number'
      ? options.existing.sourceExchangeRate
      : Number.parseFloat(String(options.existing?.sourceExchangeRate ?? '').trim())
  const existingTripId = normalizeTripId(options.existing?.tripId ?? options.existing?.trip)
  const existingSharedGroupExpense = options.existing?.sharedGroupExpense === true
  const existingPaidByMemberId = normalizeTripId(options.existing?.paidByMemberId)
  const existingMerchantName = normalizeText(options.existing?.merchantName).slice(0, 160)
  const existingTags = normalizeTags(options.existing?.tagsJson)
  const existingReviewStatus = normalizeReviewStatus(options.existing?.reviewStatus)
  const existingAccountId = normalizeTripId(options.existing?.accountId)

  const effectiveType = nextType ?? existingType
  if (!effectiveType) {
    return { error: 'type is required' }
  }

  const requestedTripId = hasTripId ? normalizeTripId(body.tripId) : undefined
  const requestedSourceAmount = hasSourceAmount
    ? typeof body.sourceAmount === 'number'
      ? body.sourceAmount
      : body.sourceAmount === null || normalizeText(body.sourceAmount).length === 0
        ? null
        : Number.parseFloat(String(body.sourceAmount).trim())
    : undefined
  const requestedSourceCurrency = hasSourceCurrency
    ? normalizeCurrencyCode(body.sourceCurrency)
    : undefined
  const requestedSourceExchangeRate = hasSourceExchangeRate
    ? typeof body.sourceExchangeRate === 'number'
      ? body.sourceExchangeRate
      : body.sourceExchangeRate === null || normalizeText(body.sourceExchangeRate).length === 0
        ? null
        : Number.parseFloat(String(body.sourceExchangeRate).trim())
    : undefined
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
  const effectiveMerchantName = hasMerchantName ? merchantName : existingMerchantName
  const effectiveTags = hasTagsJson ? tags : existingTags
  const effectiveReviewStatus = hasReviewStatus ? reviewStatus : existingReviewStatus
  const effectiveAccountId = hasAccountId ? accountId : existingAccountId
  let effectiveSourceAmount = effectiveType === 'expense' && effectiveTripId
    ? requestedSourceAmount !== undefined
      ? requestedSourceAmount
      : Number.isFinite(existingSourceAmount)
        ? existingSourceAmount
        : null
    : null
  let effectiveSourceCurrency = effectiveType === 'expense' && effectiveTripId
    ? requestedSourceCurrency !== undefined
      ? requestedSourceCurrency
      : existingSourceCurrency
    : ''
  let effectiveSourceExchangeRate = effectiveType === 'expense' && effectiveTripId
    ? requestedSourceExchangeRate !== undefined
      ? requestedSourceExchangeRate
      : Number.isFinite(existingSourceExchangeRate)
        ? existingSourceExchangeRate
        : null
    : null

  if (effectiveType === 'expense' && effectiveSharedGroupExpense && !effectiveTripId) {
    return { error: 'sharedGroupExpense requires a tripId' }
  }

  let effectiveTripRecord: Record<string, unknown> | null = null
  if (effectiveType === 'expense' && effectiveTripId) {
    effectiveTripRecord = await ensureTripExistsForUser(options.pb, options.userId, effectiveTripId)
    if (!effectiveTripRecord) {
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

  const tripCurrency = normalizeCurrencyCode(effectiveTripRecord?.currency)
  const tripExchangeRate =
    typeof effectiveTripRecord?.exchangeRate === 'number' && Number.isFinite(effectiveTripRecord.exchangeRate)
      ? effectiveTripRecord.exchangeRate
      : null
  const tripRequiresCurrencyMetadata = Boolean(tripCurrency && tripExchangeRate && tripExchangeRate > 0)
  const hasAnySourceFields = [
    effectiveSourceAmount !== null && effectiveSourceAmount !== undefined,
    Boolean(effectiveSourceCurrency),
    effectiveSourceExchangeRate !== null && effectiveSourceExchangeRate !== undefined,
  ].some(Boolean)
  const hasRequestedSourceMetadata = [
    requestedSourceAmount !== undefined && requestedSourceAmount !== null,
    Boolean(requestedSourceCurrency),
    requestedSourceExchangeRate !== undefined && requestedSourceExchangeRate !== null,
  ].some(Boolean)

  if (
    effectiveType === 'expense' &&
    !effectiveTripId &&
    (hasSourceAmount || hasSourceCurrency || hasSourceExchangeRate || hasAnySourceFields)
  ) {
    return { error: 'source currency metadata requires a tripId' }
  }

  if (
    hasSourceAmount &&
    requestedSourceAmount != null &&
    (!Number.isFinite(requestedSourceAmount) || requestedSourceAmount <= 0)
  ) {
    return { error: 'sourceAmount must be a positive number' }
  }

  if (
    hasSourceExchangeRate &&
    requestedSourceExchangeRate != null &&
    (!Number.isFinite(requestedSourceExchangeRate) || requestedSourceExchangeRate <= 0)
  ) {
    return { error: 'sourceExchangeRate must be a positive number' }
  }

  if (hasSourceCurrency && normalizeText(body.sourceCurrency).length > 0 && !requestedSourceCurrency) {
    return { error: 'sourceCurrency must be a valid 3-letter code' }
  }

  if (effectiveAccountId) {
    const accountExists = await ensureAccountExistsForUser(options.pb, options.userId, effectiveAccountId)
    if (!accountExists) {
      return { error: 'accountId must reference an existing account for this user' }
    }
  }

  if (tripRequiresCurrencyMetadata) {
    const requiredTripExchangeRate = tripExchangeRate as number
    const canReuseHistoricalExchangeRate =
      existingTripId === effectiveTripId &&
      existingSourceCurrency === tripCurrency &&
      Number.isFinite(existingSourceExchangeRate) &&
      existingSourceExchangeRate > 0

    if (
      (effectiveSourceAmount === null || effectiveSourceExchangeRate === null || !effectiveSourceCurrency) &&
      Number.isFinite(existingAmount)
    ) {
      const fallbackExchangeRate = canReuseHistoricalExchangeRate
        ? existingSourceExchangeRate
        : requiredTripExchangeRate
      effectiveSourceAmount = existingAmount / fallbackExchangeRate
      effectiveSourceCurrency = tripCurrency
      effectiveSourceExchangeRate = fallbackExchangeRate
    }

    if (
      effectiveSourceAmount === null ||
      !effectiveSourceCurrency ||
      effectiveSourceExchangeRate === null ||
      !Number.isFinite(effectiveSourceAmount) ||
      effectiveSourceAmount <= 0 ||
      !Number.isFinite(effectiveSourceExchangeRate) ||
      effectiveSourceExchangeRate <= 0
    ) {
      return { error: 'Trip expenses for this trip require source amount, currency, and exchange rate metadata' }
    }

    const validatedSourceExchangeRate = effectiveSourceExchangeRate

    if (effectiveSourceCurrency !== tripCurrency) {
      return { error: `sourceCurrency must match trip currency (${tripCurrency})` }
    }

    const allowedExchangeRates = [
      requiredTripExchangeRate,
      canReuseHistoricalExchangeRate ? existingSourceExchangeRate : null,
    ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0)

    if (!allowedExchangeRates.some((value) => numbersAlmostEqual(validatedSourceExchangeRate, value))) {
      if (canReuseHistoricalExchangeRate && !numbersAlmostEqual(existingSourceExchangeRate, requiredTripExchangeRate)) {
        return {
          error: `sourceExchangeRate must match the current trip exchange rate (${requiredTripExchangeRate}) or the saved historical rate (${existingSourceExchangeRate})`,
        }
      }
      return { error: `sourceExchangeRate must match trip exchange rate (${requiredTripExchangeRate})` }
    }
  } else if (hasRequestedSourceMetadata) {
    return { error: 'Selected trip does not have a destination currency configured' }
  }

  const payload: Record<string, unknown> = {}
  if (!partial || hasType) payload.type = effectiveType
  if (!partial || hasCategory) payload.category = category
  if (!partial || hasAmount) payload.amount = amount
  if (!partial || hasMerchantName) payload.merchantName = effectiveMerchantName
  if (!partial || hasTagsJson) payload.tagsJson = JSON.stringify(effectiveTags)
  if (!partial || hasReviewStatus) payload.reviewStatus = effectiveReviewStatus ?? 'pending'
  if (!partial || hasAccountId) payload.accountId = effectiveAccountId || null
  if (!partial || hasDescription) payload.description = description
  if (!partial || hasDate) payload.date = date

  const shouldIncludeTripState =
    !partial ||
    hasTripId ||
    hasSharedGroupExpense ||
    hasPaidByMemberId ||
    hasSourceAmount ||
    hasSourceCurrency ||
    hasSourceExchangeRate ||
    (hasType && effectiveType !== existingType)

  if (shouldIncludeTripState) {
    payload.tripId = effectiveTripId
    payload.sharedGroupExpense = effectiveSharedGroupExpense
    payload.paidByMemberId = effectivePaidByMemberId
    payload.sourceAmount = tripRequiresCurrencyMetadata ? effectiveSourceAmount : null
    payload.sourceCurrency = tripRequiresCurrencyMetadata ? effectiveSourceCurrency : ''
    payload.sourceExchangeRate = tripRequiresCurrencyMetadata ? effectiveSourceExchangeRate : null
  }

  return { data: payload }
}
