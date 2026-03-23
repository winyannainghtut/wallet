import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'

type PocketBaseLikeError = {
  message?: string
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

// GET - List transactions
export async function GET(request: NextRequest) {
  try {
    const authCookie = request.cookies.get('pb_auth')?.value
    const pb = createPbServer(authCookie)

    if (!pb.authStore.isValid || !pb.authStore.model) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('perPage') || '100')
    const category = searchParams.get('category')
    const type = searchParams.get('type')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build filter
    const filters: string[] = [`user = "${pb.authStore.model.id}"`]
    if (category) filters.push(`category = "${category}"`)
    if (type) filters.push(`type = "${type}"`)
    if (startDate) filters.push(`date >= "${startDate}"`)
    if (endDate) filters.push(`date <= "${endDate}"`)

    const result = await pb.collection('transactions').getList(page, perPage, {
      sort: '-date',
      filter: filters.join(' && '),
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('Get transactions error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch transactions') },
      { status: 500 }
    )
  }
}

// POST - Create transaction
export async function POST(request: NextRequest) {
  try {
    const authCookie = request.cookies.get('pb_auth')?.value
    const pb = createPbServer(authCookie)

    if (!pb.authStore.isValid || !pb.authStore.model) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const record = await pb.collection('transactions').create({
      ...body,
      user: pb.authStore.model.id,
    })

    return NextResponse.json(record)
  } catch (error: unknown) {
    console.error('Create transaction error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to create transaction') },
      { status: 500 }
    )
  }
}
