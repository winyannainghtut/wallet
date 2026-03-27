import { NextRequest, NextResponse } from 'next/server'
import { normalizeHouseholdRecord, parseHouseholdPayload } from '@/lib/households'
import {
  getAccessibleHouseholdAccess,
  getAuthenticatedHouseholdContext,
  getErrorMessage,
  isMissingCollectionContext,
  isNotFoundError,
  syncHouseholdAccessForUser,
} from '../_shared'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthenticatedHouseholdContext(request)
    if ('error' in auth) return auth.error
    const { pb, user } = auth
    const { id } = await params

    await syncHouseholdAccessForUser(pb, user)
    const access = await getAccessibleHouseholdAccess(pb, user.id, id, user.email)
    if (!access.canView) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (!access.isOwner) {
      return NextResponse.json({ error: 'You do not have permission to manage this household.' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = parseHouseholdPayload(body, { partial: true })
    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error || 'Invalid household payload' }, { status: 400 })
    }

    const record = await pb.collection('households').update(id, parsed.data)
    return NextResponse.json(normalizeHouseholdRecord(record))
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Households collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.error('Update household error:', error)
    return NextResponse.json({ error: getErrorMessage(error, 'Failed to update household') }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthenticatedHouseholdContext(request)
    if ('error' in auth) return auth.error
    const { pb, user } = auth
    const { id } = await params

    await syncHouseholdAccessForUser(pb, user)
    const access = await getAccessibleHouseholdAccess(pb, user.id, id, user.email)
    if (!access.canView) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (!access.isOwner) {
      return NextResponse.json({ error: 'You do not have permission to manage this household.' }, { status: 403 })
    }

    await pb.collection('households').delete(id)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Households collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.error('Delete household error:', error)
    return NextResponse.json({ error: getErrorMessage(error, 'Failed to delete household') }, { status: 500 })
  }
}
