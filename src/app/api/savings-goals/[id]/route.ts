import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'

type PocketBaseLikeError = {
  status?: number
  message?: string
}

type SavingsGoalInput = {
  month?: string
  targetAmount?: number
  note?: string
}

type SavingsGoalRecord = {
  id: string
  user?: string
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

function normalizeInput(input: SavingsGoalInput) {
  return {
    month: typeof input.month === 'string' ? input.month : undefined,
    targetAmount: typeof input.targetAmount === 'number' ? input.targetAmount : undefined,
    note: typeof input.note === 'string' ? input.note : undefined,
  }
}

function stripUndefined(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined))
}

async function getOwnedGoal(
  pb: ReturnType<typeof createPbServer>,
  userId: string,
  id: string
) {
  const record = (await pb.collection('savings_goals').getOne(id)) as SavingsGoalRecord
  if (record.user !== userId) {
    return null
  }
  return record
}

// GET - Get single savings goal
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
    const record = await getOwnedGoal(pb, userId, id)
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
        { error: 'Savings goals collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Get savings goal error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch savings goal') },
      { status: 500 }
    )
  }
}

// PUT - Update savings goal
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
    const existing = await getOwnedGoal(pb, userId, id)
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = (await request.json()) as SavingsGoalInput
    const normalized = normalizeInput(body)

    if (normalized.month && !/^\d{4}-\d{2}$/.test(normalized.month)) {
      return NextResponse.json({ error: 'month must be in YYYY-MM format' }, { status: 400 })
    }
    if (normalized.targetAmount !== undefined && normalized.targetAmount < 0) {
      return NextResponse.json({ error: 'targetAmount must be a non-negative number' }, { status: 400 })
    }

    const updated = await pb.collection('savings_goals').update(id, stripUndefined({
      month: normalized.month,
      targetAmount: normalized.targetAmount,
      note: normalized.note,
    }))

    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Savings goals collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Update savings goal error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to update savings goal') },
      { status: 500 }
    )
  }
}

// DELETE - Delete savings goal
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
    const existing = await getOwnedGoal(pb, userId, id)
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await pb.collection('savings_goals').delete(id)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Savings goals collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Delete savings goal error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to delete savings goal') },
      { status: 500 }
    )
  }
}
