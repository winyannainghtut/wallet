import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'
import {
  normalizeTransactionRuleRecord,
  parseTags,
  ruleMatchesTransaction,
} from '@/lib/transaction-rules'
import { escapeFilterValue } from '@/lib/transaction-payload'

type PocketBaseLikeError = {
  status?: number
  message?: string
}

type ReviewTransactionRecord = {
  id: string
  user?: string
  type?: string
  amount?: number
  category?: string
  description?: string
  date?: string
  merchantName?: string
  tagsJson?: string
  reviewStatus?: string
  accountId?: string
}

type ReviewRecordWithSource = ReviewTransactionRecord & {
  source: 'transactions' | 'incomes'
}

type ReviewStatus = 'pending' | 'reviewed' | 'ignored'

type ReviewSummary = {
  pending: number
  reviewed: number
  ignored: number
  total: number
}

type NormalizedReviewRecord = {
  id: string
  type: 'income' | 'expense'
  amount: number
  category: string
  description: string
  date: string
  merchantName: string
  tags: string[]
  reviewStatus: ReviewStatus
  accountId: string
}

type PocketBaseListResult<T> = {
  items: T[]
  totalItems: number
  totalPages: number
  page: number
  perPage: number
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

function normalizeReviewRecord(record: ReviewTransactionRecord): NormalizedReviewRecord {
  return {
    id: record.id,
    type: record.type === 'income' ? 'income' : 'expense',
    amount: typeof record.amount === 'number' ? record.amount : 0,
    category: typeof record.category === 'string' ? record.category : 'other',
    description: typeof record.description === 'string' ? record.description : '',
    date: typeof record.date === 'string' ? record.date : '',
    merchantName: typeof record.merchantName === 'string' ? record.merchantName : '',
    tags: parseTags(record.tagsJson),
    reviewStatus:
      record.reviewStatus === 'reviewed' || record.reviewStatus === 'ignored'
        ? record.reviewStatus
        : 'pending',
    accountId: typeof record.accountId === 'string' ? record.accountId : '',
  }
}

function buildUserFilter(userId: string): string {
  return `user = "${escapeFilterValue(userId)}"`
}

function buildPendingFilter(): string {
  return '(reviewStatus = "" || reviewStatus = "pending")'
}

function buildSearchFilter(query: string): string {
  const escaped = escapeFilterValue(query)
  return `(
    description ~ "${escaped}" ||
    merchantName ~ "${escaped}" ||
    category ~ "${escaped}" ||
    tagsJson ~ "${escaped}"
  )`.replace(/\s+/g, ' ')
}

function buildReviewFilter(userId: string, reviewStatus: string, query: string): string {
  const filters = [buildUserFilter(userId)]

  if (reviewStatus === 'pending') {
    filters.push(buildPendingFilter())
  } else if (reviewStatus === 'reviewed' || reviewStatus === 'ignored') {
    filters.push(`reviewStatus = "${escapeFilterValue(reviewStatus)}"`)
  }

  if (query) {
    filters.push(buildSearchFilter(query))
  }

  return filters.join(' && ')
}

async function getCollectionPage<T extends ReviewTransactionRecord>(
  pb: ReturnType<typeof createPbServer>,
  collectionName: 'transactions' | 'incomes',
  page: number,
  perPage: number,
  filter: string
): Promise<PocketBaseListResult<T>> {
  try {
    return await pb.collection(collectionName).getList<T>(page, perPage, {
      sort: '-date',
      filter,
    })
  } catch (error: unknown) {
    if (collectionName === 'incomes' && isMissingCollectionContext(error)) {
      return {
        items: [],
        totalItems: 0,
        totalPages: 1,
        page,
        perPage,
      }
    }
    throw error
  }
}

async function countCollectionItems(
  pb: ReturnType<typeof createPbServer>,
  collectionName: 'transactions' | 'incomes',
  filter: string
): Promise<number> {
  const result = await getCollectionPage(pb, collectionName, 1, 1, filter)
  return result.totalItems
}

async function getReviewSummary(
  pb: ReturnType<typeof createPbServer>,
  userId: string
): Promise<ReviewSummary> {
  const baseFilter = buildUserFilter(userId)

  const [
    transactionTotal,
    transactionReviewed,
    transactionIgnored,
    incomeTotal,
    incomeReviewed,
    incomeIgnored,
  ] = await Promise.all([
    countCollectionItems(pb, 'transactions', baseFilter),
    countCollectionItems(pb, 'transactions', `${baseFilter} && reviewStatus = "reviewed"`),
    countCollectionItems(pb, 'transactions', `${baseFilter} && reviewStatus = "ignored"`),
    countCollectionItems(pb, 'incomes', baseFilter),
    countCollectionItems(pb, 'incomes', `${baseFilter} && reviewStatus = "reviewed"`),
    countCollectionItems(pb, 'incomes', `${baseFilter} && reviewStatus = "ignored"`),
  ])

  const total = transactionTotal + incomeTotal
  const reviewed = transactionReviewed + incomeReviewed
  const ignored = transactionIgnored + incomeIgnored

  return {
    pending: Math.max(0, total - reviewed - ignored),
    reviewed,
    ignored,
    total,
  }
}

async function getMergedReviewPage(
  pb: ReturnType<typeof createPbServer>,
  userId: string,
  page: number,
  perPage: number,
  reviewStatus: string,
  query: string
) {
  const requestedPage = Math.max(1, page)
  const requestedPerPage = Math.max(1, perPage)
  const fetchLimit = requestedPage * requestedPerPage
  const filter = buildReviewFilter(userId, reviewStatus, query)

  const [transactionResult, incomeResult] = await Promise.all([
    getCollectionPage<ReviewTransactionRecord>(pb, 'transactions', 1, fetchLimit, filter),
    getCollectionPage<ReviewTransactionRecord>(pb, 'incomes', 1, fetchLimit, filter),
  ])

  const mergedItems = [
    ...transactionResult.items.map((item) => ({
      ...normalizeReviewRecord(item),
      source: 'transactions' as const,
    })),
    ...incomeResult.items.map((item) => ({
      ...normalizeReviewRecord({ ...item, type: 'income' }),
      source: 'incomes' as const,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  const totalItems = transactionResult.totalItems + incomeResult.totalItems
  const totalPages = Math.max(1, Math.ceil(totalItems / requestedPerPage))
  const safePage = Math.min(requestedPage, totalPages)
  const offset = (safePage - 1) * requestedPerPage

  return {
    items: mergedItems.slice(offset, offset + requestedPerPage),
    totalItems,
    totalPages,
    page: safePage,
    perPage: requestedPerPage,
  }
}

async function applyRulesToCollection(
  pb: ReturnType<typeof createPbServer>,
  collectionName: 'transactions' | 'incomes',
  userId: string,
  rules: ReturnType<typeof normalizeTransactionRuleRecord>[],
): Promise<number> {
  const filter = buildUserFilter(userId)
  const perPage = 200
  let page = 1
  let updatedCount = 0

  while (true) {
    const result = await getCollectionPage<ReviewTransactionRecord>(pb, collectionName, page, perPage, filter)
    if (result.items.length === 0) {
      break
    }

    for (const rawRecord of result.items) {
      const record: ReviewRecordWithSource = {
        ...rawRecord,
        type: collectionName === 'incomes' ? 'income' : rawRecord.type,
        source: collectionName,
      }
      const normalized = normalizeReviewRecord(record)
      if (normalized.reviewStatus === 'reviewed' || normalized.reviewStatus === 'ignored') {
        continue
      }

      let nextMerchantName = normalized.merchantName
      let nextCategory = normalized.category
      const nextTags = [...normalized.tags]
      let nextReviewStatus: ReviewStatus = normalized.reviewStatus
      let didChange = false

      for (const rule of rules) {
        if (!rule || !ruleMatchesTransaction(rule, normalized)) {
          continue
        }

        if (rule.renameTo && nextMerchantName !== rule.renameTo) {
          nextMerchantName = rule.renameTo
          didChange = true
        }

        if (rule.category && nextCategory !== rule.category) {
          nextCategory = rule.category
          didChange = true
        }

        for (const tag of rule.tags) {
          if (!nextTags.includes(tag)) {
            nextTags.push(tag)
            didChange = true
          }
        }

        if (rule.markReviewed && nextReviewStatus !== 'reviewed') {
          nextReviewStatus = 'reviewed'
          didChange = true
        }
      }

      if (!didChange) {
        continue
      }

      await pb.collection(collectionName).update(record.id, {
        merchantName: nextMerchantName,
        category: nextCategory,
        tagsJson: JSON.stringify(nextTags),
        reviewStatus: nextReviewStatus,
      })
      updatedCount += 1
    }

    if (page >= result.totalPages) {
      break
    }
    page += 1
  }

  return updatedCount
}

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) return auth.error
    const { pb, userId } = auth

    const { searchParams } = new URL(request.url)
    const reviewStatus = searchParams.get('reviewStatus') || 'all'
    const query = (searchParams.get('q') || '').trim().toLowerCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const perPage = Math.max(1, parseInt(searchParams.get('perPage') || '50', 10))

    const [queuePage, summary] = await Promise.all([
      getMergedReviewPage(pb, userId, page, perPage, reviewStatus, query),
      getReviewSummary(pb, userId),
    ])

    return NextResponse.json({
      ...queuePage,
      summary,
    })
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Transactions review metadata is unavailable. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Get transaction review queue error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch review queue') },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) return auth.error
    const { pb, userId } = auth

    const rules = (await pb.collection('transaction_rules').getFullList({
      filter: `user = "${escapeFilterValue(userId)}" && isActive = true`,
      sort: 'created',
    }))
      .map((item) => normalizeTransactionRuleRecord(item))
      .filter((item): item is NonNullable<ReturnType<typeof normalizeTransactionRuleRecord>> => item !== null)

    const [transactionUpdates, incomeUpdates] = await Promise.all([
      applyRulesToCollection(pb, 'transactions', userId, rules),
      applyRulesToCollection(pb, 'incomes', userId, rules),
    ])

    return NextResponse.json({ updatedCount: transactionUpdates + incomeUpdates, rulesApplied: rules.length })
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Transaction rules or review metadata is unavailable. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Apply transaction rules error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to apply transaction rules') },
      { status: 500 }
    )
  }
}
