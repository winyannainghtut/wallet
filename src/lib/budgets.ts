export type BudgetRecord = {
  id: string
  month: string
  category: string
  limitAmount: number
  rolloverAmount?: number | null
  note?: string
  isActive?: boolean
  created?: string
  updated?: string
}

type BudgetPayloadInput = {
  month?: unknown
  category?: unknown
  limitAmount?: unknown
  rolloverAmount?: unknown
  note?: unknown
  isActive?: unknown
}

function hasOwn<T extends object>(obj: T, key: keyof T): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function parseOptionalNumber(value: unknown): number | null | 'invalid' {
  if (value === null || value === undefined || normalizeText(value).length === 0) {
    return null
  }

  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value).trim())
  if (!Number.isFinite(parsed)) {
    return 'invalid'
  }

  return parsed
}

export function isValidMonthKey(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})$/)
  if (!match) {
    return false
  }

  const year = Number.parseInt(match[1], 10)
  const month = Number.parseInt(match[2], 10)
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12
}

export function normalizeBudgetRecord(record: Record<string, unknown>): BudgetRecord | null {
  if (!record.id || typeof record.id !== 'string') {
    return null
  }

  const month = normalizeText(record.month)
  const category = normalizeText(record.category)
  const limitAmount = typeof record.limitAmount === 'number'
    ? record.limitAmount
    : Number.parseFloat(String(record.limitAmount ?? '').trim())
  const rolloverAmount = typeof record.rolloverAmount === 'number'
    ? record.rolloverAmount
    : Number.parseFloat(String(record.rolloverAmount ?? '').trim())

  if (!isValidMonthKey(month) || !category || !Number.isFinite(limitAmount)) {
    return null
  }

  return {
    id: record.id,
    month,
    category,
    limitAmount,
    rolloverAmount: Number.isFinite(rolloverAmount) ? rolloverAmount : undefined,
    note: normalizeText(record.note) || undefined,
    isActive: record.isActive !== false,
    created: typeof record.created === 'string' ? record.created : undefined,
    updated: typeof record.updated === 'string' ? record.updated : undefined,
  }
}

export function parseBudgetPayload(
  input: unknown,
  options: { partial?: boolean } = {}
): { data?: Record<string, unknown>; error?: string } {
  if (typeof input !== 'object' || input === null) {
    return { error: 'Invalid budget payload' }
  }

  const body = input as BudgetPayloadInput
  const partial = options.partial === true

  const hasMonth = hasOwn(body, 'month')
  const hasCategory = hasOwn(body, 'category')
  const hasLimitAmount = hasOwn(body, 'limitAmount')
  const hasRolloverAmount = hasOwn(body, 'rolloverAmount')
  const hasNote = hasOwn(body, 'note')
  const hasIsActive = hasOwn(body, 'isActive')

  const month = hasMonth ? normalizeText(body.month) : ''
  if ((!partial || hasMonth) && !isValidMonthKey(month)) {
    return { error: 'month must be a valid YYYY-MM value' }
  }

  const category = hasCategory ? normalizeText(body.category) : ''
  if ((!partial || hasCategory) && !category) {
    return { error: 'category is required' }
  }

  const limitAmount = hasLimitAmount ? parseOptionalNumber(body.limitAmount) : null
  if ((!partial || hasLimitAmount) && (limitAmount === 'invalid' || limitAmount === null || limitAmount < 0)) {
    return { error: 'limitAmount must be a non-negative number' }
  }

  const rolloverAmount = hasRolloverAmount ? parseOptionalNumber(body.rolloverAmount) : null
  if (hasRolloverAmount && (rolloverAmount === 'invalid' || (rolloverAmount !== null && rolloverAmount < 0))) {
    return { error: 'rolloverAmount must be a non-negative number' }
  }

  const note = hasNote ? normalizeText(body.note).slice(0, 500) : ''
  const isActive = hasIsActive ? body.isActive !== false : true

  const payload: Record<string, unknown> = {}
  if (!partial || hasMonth) payload.month = month
  if (!partial || hasCategory) payload.category = category
  if (!partial || hasLimitAmount) payload.limitAmount = limitAmount
  if (hasRolloverAmount) payload.rolloverAmount = rolloverAmount
  if (hasNote) payload.note = note || ''
  if (!partial || hasIsActive) payload.isActive = isActive
  return { data: payload }
}

