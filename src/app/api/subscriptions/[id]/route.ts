import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'

type PocketBaseLikeError = {
  status?: number
  message?: string
}

type SubscriptionInput = {
  name?: string
  amount?: number
  category?: string
  billingCycle?: string
  startDate?: string
  frequency?: string
  nextDueDate?: string
  isActive?: boolean
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
  if (typeof error === 'object' && error !== null && 'status' in error) {
    return (error as PocketBaseLikeError).status === 404
  }
  return false
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

function stripUndefined(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined))
}

function getNormalizedSubscriptionValues(input: SubscriptionInput) {
  return {
    name: input.name,
    amount: input.amount,
    category: input.category,
    isActive: input.isActive,
    billingCycle: input.billingCycle ?? input.frequency,
    startDate: input.startDate ?? input.nextDueDate,
  }
}

async function updateSubscription(
  pb: ReturnType<typeof createPbServer>,
  id: string,
  input: SubscriptionInput
) {
  const normalized = getNormalizedSubscriptionValues(input)

  const primaryPayload = stripUndefined({
    name: normalized.name,
    amount: normalized.amount,
    category: normalized.category,
    billingCycle: normalized.billingCycle,
    startDate: normalized.startDate,
    isActive: normalized.isActive,
  })

  try {
    return await pb.collection('subscriptions').update(id, primaryPayload)
  } catch (primaryError) {
    const fallbackPayload = stripUndefined({
      name: normalized.name,
      amount: normalized.amount,
      category: normalized.category,
      frequency: normalized.billingCycle,
      nextDueDate: normalized.startDate,
      isActive: normalized.isActive,
    })

    try {
      return await pb.collection('subscriptions').update(id, fallbackPayload)
    } catch {
      throw primaryError
    }
  }
}

// GET - Get single subscription
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
    const record = await pb.collection('subscriptions').getOne(id)
    if (record.user !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(record)
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.error('Get subscription error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch subscription') },
      { status: 500 }
    )
  }
}

// PUT - Update subscription
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
    const existing = await pb.collection('subscriptions').getOne(id)
    if (existing.user !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = (await request.json()) as SubscriptionInput

    if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length === 0)) {
      return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 })
    }
    if (body.amount !== undefined && (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount < 0)) {
      return NextResponse.json({ error: 'amount must be a non-negative number' }, { status: 400 })
    }

    const record = await updateSubscription(pb, id, body)

    return NextResponse.json(record)
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.error('Update subscription error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to update subscription') },
      { status: 500 }
    )
  }
}

// DELETE - Delete subscription
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
    const existing = await pb.collection('subscriptions').getOne(id)
    if (existing.user !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await pb.collection('subscriptions').delete(id)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.error('Delete subscription error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to delete subscription') },
      { status: 500 }
    )
  }
}
