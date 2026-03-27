import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'
import {
  normalizeTransactionRuleRecord,
  parseTags,
  ruleMatchesTransaction,
} from '@/lib/transaction-rules'

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

function normalizeReviewRecord(record: ReviewTransactionRecord) {
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

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) return auth.error
    const { pb, userId } = auth

    const { searchParams } = new URL(request.url)
    const reviewStatus = searchParams.get('reviewStatus')
    const query = (searchParams.get('q') || '').trim().toLowerCase()

    const transactionItems = await pb.collection('transactions').getFullList<ReviewTransactionRecord>({
      filter: `user = "${userId}"`,
      sort: '-date',
    })
    let incomeItems: ReviewTransactionRecord[] = []
    try {
      incomeItems = await pb.collection('incomes').getFullList<ReviewTransactionRecord>({
        filter: `user = "${userId}"`,
        sort: '-date',
      })
    } catch (error: unknown) {
      if (!isMissingCollectionContext(error)) {
        throw error
      }
    }

    const normalized = [
      ...transactionItems.map((item) => ({ ...item, source: 'transactions' as const })),
      ...incomeItems.map((item) => ({ ...item, type: 'income', source: 'incomes' as const })),
    ]
      .map(normalizeReviewRecord)
      .filter((item) => {
        if (reviewStatus && item.reviewStatus !== reviewStatus) {
          return false
        }
        if (!query) {
          return true
        }
        return [item.description, item.merchantName, item.category, item.tags.join(' ')]
          .some((value) => value.toLowerCase().includes(query))
      })
      .sort((a, b) => b.date.localeCompare(a.date))

    return NextResponse.json({ items: normalized, totalItems: normalized.length })
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
      filter: `user = "${userId}" && isActive = true`,
      sort: 'created',
    }))
      .map((item) => normalizeTransactionRuleRecord(item))
      .filter((item): item is NonNullable<ReturnType<typeof normalizeTransactionRuleRecord>> => item !== null)

    const transactions = await pb.collection('transactions').getFullList<ReviewRecordWithSource>({
      filter: `user = "${userId}"`,
      sort: '-date',
    })
    let incomes: ReviewRecordWithSource[] = []
    try {
      incomes = await pb.collection('incomes').getFullList<ReviewRecordWithSource>({
        filter: `user = "${userId}"`,
        sort: '-date',
      })
    } catch (error: unknown) {
      if (!isMissingCollectionContext(error)) {
        throw error
      }
    }

    let updatedCount = 0

    for (const record of [
      ...transactions.map((item) => ({ ...item, source: 'transactions' as const })),
      ...incomes.map((item) => ({ ...item, type: 'income', source: 'incomes' as const })),
    ]) {
      const normalized = normalizeReviewRecord(record)
      if (normalized.reviewStatus === 'reviewed' || normalized.reviewStatus === 'ignored') {
        continue
      }

      let nextMerchantName = normalized.merchantName
      let nextCategory = normalized.category
      const nextTags = [...normalized.tags]
      let nextReviewStatus = normalized.reviewStatus
      let didChange = false

      for (const rule of rules) {
        if (!ruleMatchesTransaction(rule, normalized)) {
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

      await pb.collection(record.source).update(record.id, {
        merchantName: nextMerchantName,
        category: nextCategory,
        tagsJson: JSON.stringify(nextTags),
        reviewStatus: nextReviewStatus,
      })
      updatedCount += 1
    }

    return NextResponse.json({ updatedCount, rulesApplied: rules.length })
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
