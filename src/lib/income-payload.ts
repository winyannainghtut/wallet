import { createPbServer } from '@/lib/pb'
import { parseTransactionPayload } from '@/lib/transaction-payload'

type IncomeLikeRecord = {
  amount?: unknown
  merchantName?: unknown
  tagsJson?: unknown
  reviewStatus?: unknown
  accountId?: unknown
  category?: unknown
  description?: unknown
  date?: unknown
}

type ParseIncomePayloadOptions = {
  pb: ReturnType<typeof createPbServer>
  userId: string
  partial?: boolean
  existing?: IncomeLikeRecord
}

export type ParsedIncomePayload = {
  collectionData: Record<string, unknown>
  legacyData: Record<string, unknown>
}

function pickIncomeCollectionFields(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    amount: payload.amount,
    category: payload.category,
    merchantName: payload.merchantName,
    tagsJson: payload.tagsJson,
    reviewStatus: payload.reviewStatus,
    accountId: payload.accountId,
    description: payload.description,
    date: payload.date,
  }
}

export async function parseIncomePayload(
  input: unknown,
  options: ParseIncomePayloadOptions
): Promise<{ data?: ParsedIncomePayload; error?: string }> {
  const parsed = await parseTransactionPayload(
    { ...(typeof input === 'object' && input !== null ? input as Record<string, unknown> : {}), type: 'income' },
    {
      pb: options.pb,
      userId: options.userId,
      partial: options.partial,
      existing: options.existing ? { ...options.existing, type: 'income' } : undefined,
    }
  )

  if (!parsed.data) {
    return { error: parsed.error }
  }

  return {
    data: {
      collectionData: pickIncomeCollectionFields(parsed.data),
      legacyData: parsed.data,
    },
  }
}
