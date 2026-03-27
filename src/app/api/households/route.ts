import { NextRequest, NextResponse } from 'next/server'
import { normalizeHouseholdRecord, parseHouseholdPayload } from '@/lib/households'
import {
  buildOwnerMemberSeed,
  getAccessibleHouseholds,
  getAuthenticatedHouseholdContext,
  getErrorMessage,
  isMissingCollectionContext,
  syncHouseholdAccessForUser,
} from './_shared'

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthenticatedHouseholdContext(request)
    if ('error' in auth) return auth.error
    const { pb, user } = auth

    await syncHouseholdAccessForUser(pb, user)
    const items = await getAccessibleHouseholds(pb, user.id, user.email)

    return NextResponse.json({ items, totalItems: items.length })
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Households collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Get households error:', error)
    return NextResponse.json({ error: getErrorMessage(error, 'Failed to fetch households') }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthenticatedHouseholdContext(request)
    if ('error' in auth) return auth.error
    const { pb, userId, user } = auth

    const body = await request.json()
    const parsed = parseHouseholdPayload(body)
    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error || 'Invalid household payload' }, { status: 400 })
    }

    const householdRecord = await pb.collection('households').create({
      ...parsed.data,
      user: userId,
    })

    try {
      await pb.collection('household_members').create(buildOwnerMemberSeed(user, householdRecord.id))
    } catch (membershipError) {
      console.error('Create owner membership error:', membershipError)
      try {
        await pb.collection('households').delete(householdRecord.id)
      } catch (rollbackError) {
        console.error('Rollback household create error:', rollbackError)
      }
      throw membershipError
    }

    return NextResponse.json(normalizeHouseholdRecord(householdRecord))
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Households collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Create household error:', error)
    return NextResponse.json({ error: getErrorMessage(error, 'Failed to create household') }, { status: 500 })
  }
}
