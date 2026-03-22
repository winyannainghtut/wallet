import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'

// GET - Get single transaction
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCookie = request.cookies.get('pb_auth')?.value
    const pb = createPbServer(authCookie)

    if (!pb.authStore.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const record = await pb.collection('transactions').getOne(id)

    return NextResponse.json(record)
  } catch (error: any) {
    console.error('Get transaction error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch transaction' },
      { status: 500 }
    )
  }
}

// PUT - Update transaction
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCookie = request.cookies.get('pb_auth')?.value
    const pb = createPbServer(authCookie)

    if (!pb.authStore.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const record = await pb.collection('transactions').update(id, body)

    return NextResponse.json(record)
  } catch (error: any) {
    console.error('Update transaction error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update transaction' },
      { status: 500 }
    )
  }
}

// DELETE - Delete transaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authCookie = request.cookies.get('pb_auth')?.value
    const pb = createPbServer(authCookie)

    if (!pb.authStore.isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await pb.collection('transactions').delete(id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete transaction error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete transaction' },
      { status: 500 }
    )
  }
}
