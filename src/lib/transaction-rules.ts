export type TransactionReviewStatus = 'pending' | 'reviewed' | 'ignored'

export type TransactionRuleRecord = {
  id: string
  name: string
  matchText: string
  renameTo?: string
  category?: string
  tags: string[]
  markReviewed?: boolean
  isActive?: boolean
  created?: string
  updated?: string
}

type TransactionRulePayloadInput = {
  name?: unknown
  matchText?: unknown
  renameTo?: unknown
  category?: unknown
  tagsJson?: unknown
  markReviewed?: unknown
  isActive?: unknown
}

type TransactionReviewPatchInput = {
  merchantName?: unknown
  tagsJson?: unknown
  reviewStatus?: unknown
  accountId?: unknown
  category?: unknown
}

function hasOwn<T extends object>(obj: T, key: keyof T): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function parseTags(value: unknown): string[] {
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

function normalizeReviewStatus(value: unknown): TransactionReviewStatus | null {
  if (value === 'pending' || value === 'reviewed' || value === 'ignored') {
    return value
  }

  return null
}

export function normalizeTransactionRuleRecord(record: Record<string, unknown>): TransactionRuleRecord | null {
  if (!record.id || typeof record.id !== 'string') {
    return null
  }

  const name = normalizeText(record.name)
  const matchText = normalizeText(record.matchText)
  if (!name || !matchText) {
    return null
  }

  return {
    id: record.id,
    name,
    matchText,
    renameTo: normalizeText(record.renameTo) || undefined,
    category: normalizeText(record.category) || undefined,
    tags: parseTags(record.tagsJson),
    markReviewed: record.markReviewed === true,
    isActive: record.isActive !== false,
    created: typeof record.created === 'string' ? record.created : undefined,
    updated: typeof record.updated === 'string' ? record.updated : undefined,
  }
}

export function parseTransactionRulePayload(
  input: unknown,
  options: { partial?: boolean } = {}
): { data?: Record<string, unknown>; error?: string } {
  if (typeof input !== 'object' || input === null) {
    return { error: 'Invalid transaction rule payload' }
  }

  const body = input as TransactionRulePayloadInput
  const partial = options.partial === true

  const hasName = hasOwn(body, 'name')
  const hasMatchText = hasOwn(body, 'matchText')
  const hasRenameTo = hasOwn(body, 'renameTo')
  const hasCategory = hasOwn(body, 'category')
  const hasTagsJson = hasOwn(body, 'tagsJson')
  const hasMarkReviewed = hasOwn(body, 'markReviewed')
  const hasIsActive = hasOwn(body, 'isActive')

  const name = hasName ? normalizeText(body.name).slice(0, 120) : ''
  const matchText = hasMatchText ? normalizeText(body.matchText).slice(0, 160) : ''
  const renameTo = hasRenameTo ? normalizeText(body.renameTo).slice(0, 160) : ''
  const category = hasCategory ? normalizeText(body.category).slice(0, 80) : ''
  const tags = hasTagsJson ? parseTags(body.tagsJson) : []
  const markReviewed = hasMarkReviewed ? body.markReviewed === true : false
  const isActive = hasIsActive ? body.isActive !== false : true

  if ((!partial || hasName) && !name) {
    return { error: 'name is required' }
  }

  if ((!partial || hasMatchText) && !matchText) {
    return { error: 'matchText is required' }
  }

  const payload: Record<string, unknown> = {}
  if (!partial || hasName) payload.name = name
  if (!partial || hasMatchText) payload.matchText = matchText
  if (hasRenameTo) payload.renameTo = renameTo
  if (hasCategory) payload.category = category
  if (hasTagsJson) payload.tagsJson = JSON.stringify(tags)
  if (!partial || hasMarkReviewed) payload.markReviewed = markReviewed
  if (!partial || hasIsActive) payload.isActive = isActive
  return { data: payload }
}

export function parseTransactionReviewPatch(
  input: unknown
): { data?: Record<string, unknown>; error?: string } {
  if (typeof input !== 'object' || input === null) {
    return { error: 'Invalid transaction review payload' }
  }

  const body = input as TransactionReviewPatchInput
  const payload: Record<string, unknown> = {}

  if (hasOwn(body, 'merchantName')) {
    payload.merchantName = normalizeText(body.merchantName).slice(0, 160)
  }

  if (hasOwn(body, 'tagsJson')) {
    payload.tagsJson = JSON.stringify(parseTags(body.tagsJson))
  }

  if (hasOwn(body, 'reviewStatus')) {
    const reviewStatus = normalizeReviewStatus(body.reviewStatus)
    if (!reviewStatus) {
      return { error: 'reviewStatus must be pending, reviewed, or ignored' }
    }
    payload.reviewStatus = reviewStatus
  }

  if (hasOwn(body, 'accountId')) {
    payload.accountId = normalizeText(body.accountId) || null
  }

  if (hasOwn(body, 'category')) {
    const category = normalizeText(body.category)
    if (!category) {
      return { error: 'category cannot be empty' }
    }
    payload.category = category
  }

  return { data: payload }
}

export function ruleMatchesTransaction(
  rule: Pick<TransactionRuleRecord, 'matchText'>,
  transaction: { description?: string; merchantName?: string; category?: string }
): boolean {
  const needle = rule.matchText.trim().toLowerCase()
  if (!needle) {
    return false
  }

  return [transaction.description, transaction.merchantName, transaction.category]
    .map((value) => normalizeText(value).toLowerCase())
    .some((value) => value.includes(needle))
}
