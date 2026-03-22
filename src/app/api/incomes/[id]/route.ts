import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'

type PocketBaseLikeError = {
  status?: number
  message?: string
}

type IncomeInput = {
  amount?: number
  category?: string
  description?: string
  date?: string
}

type IncomeRecord = {
  id: string
  user?: string
  type?: string
}

type IncomeSource = 'incomes' | 'transactions'

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

function normalizeIncomeInput(input: IncomeInput) {
  return {
    amount: input.amount,
    category: input.category,
    description: input.description,
    date: input.date,
  }
}

function stripUndefined(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined))
}

async function resolveIncomeRecord(
  pb: ReturnType<typeof createPbServer>,
  userId: string,
  id: string
): Promise<{ record: IncomeRecord; source: IncomeSource } | null> {
  try {
    const record = (await pb.collection('incomes').getOne(id)) as IncomeRecord
    if (record.user !== userId) return null
    return { record, source: 'incomes' }
  } catch (error: unknown) {
    if (!isNotFoundError(error) && !isMissingCollectionContext(error)) {
      throw error
    }
  }

  try {
    const legacyRecord = (await pb.collection('transactions').getOne(id)) as IncomeRecord
    if (legacyRecord.user !== userId || legacyRecord.type !== 'income') return null
    return { record: legacyRecord, source: 'transactions' }
  } catch (error: unknown) {
    if (isNotFoundError(error) || isMissingCollectionContext(error)) {
      return null
    }
    throw error
  }
}

// GET - Get single income
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
    const resolved = await resolveIncomeRecord(pb, userId, id)
    if (!resolved) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(resolved.record)
  } catch (error: unknown) {
    console.error('Get income error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch income') },
      { status: 500 }
    )
  }
}

// PUT - Update income
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
    const resolved = await resolveIncomeRecord(pb, userId, id)
    if (!resolved) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = (await request.json()) as IncomeInput
    const normalized = normalizeIncomeInput(body)
    const payload = stripUndefined({
      amount: normalized.amount,
      category: normalized.category,
      description: normalized.description,
      date: normalized.date,
      ...(resolved.source === 'transactions' ? { type: 'income' } : {}),
    })

    const updated = await pb.collection(resolved.source).update(id, payload)
    return NextResponse.json(updated)
  } catch (error: unknown) {
    console.error('Update income error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to update income') },
      { status: 500 }
    )
  }
}

// DELETE - Delete income
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
    const resolved = await resolveIncomeRecord(pb, userId, id)
    if (!resolved) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await pb.collection(resolved.source).delete(id)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Delete income error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to delete income') },
      { status: 500 }
    )
  }
}
