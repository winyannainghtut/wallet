import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'
import { escapeFilterValue } from '@/lib/transaction-payload'

type PocketBaseLikeError = {
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
    isActive: input.isActive ?? true,
    billingCycle: input.billingCycle ?? input.frequency,
    startDate: input.startDate ?? input.nextDueDate,
  }
}

async function createSubscription(
  pb: ReturnType<typeof createPbServer>,
  userId: string,
  input: SubscriptionInput
) {
  const normalized = getNormalizedSubscriptionValues(input)

  const primaryPayload = stripUndefined({
    user: userId,
    name: normalized.name,
    amount: normalized.amount,
    category: normalized.category,
    billingCycle: normalized.billingCycle,
    startDate: normalized.startDate,
    isActive: normalized.isActive,
  })

  try {
    return await pb.collection('subscriptions').create(primaryPayload)
  } catch (primaryError) {
    const fallbackPayload = stripUndefined({
      user: userId,
      name: normalized.name,
      amount: normalized.amount,
      category: normalized.category,
      frequency: normalized.billingCycle,
      nextDueDate: normalized.startDate,
      isActive: normalized.isActive,
    })

    try {
      return await pb.collection('subscriptions').create(fallbackPayload)
    } catch {
      throw primaryError
    }
  }
}

// GET - List subscriptions
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) {
      return auth.error
    }
    const { pb, userId } = auth

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Math.min(parseInt(searchParams.get('page') || '1'), 10000))
    const perPage = Math.max(1, Math.min(parseInt(searchParams.get('perPage') || '100'), 500))

    const result = await pb.collection('subscriptions').getList(page, perPage, {
      sort: '-created',
      filter: `user = "${escapeFilterValue(userId)}"`,
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('Get subscriptions error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch subscriptions') },
      { status: 500 }
    )
  }
}

// POST - Create subscription
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) {
      return auth.error
    }
    const { pb, userId } = auth

    const body = (await request.json()) as SubscriptionInput

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
    }
    if (!body.startDate && !body.nextDueDate) {
      return NextResponse.json({ error: 'startDate or nextDueDate is required' }, { status: 400 })
    }

    const record = await createSubscription(pb, userId, body)

    return NextResponse.json(record)
  } catch (error: unknown) {
    console.error('Create subscription error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to create subscription') },
      { status: 500 }
    )
  }
}
