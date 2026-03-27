import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'
import {
  buildHouseholdSummary,
  normalizeHouseholdMemberRecord,
  parseHouseholdMemberInput,
  sortHouseholdMembers,
  type HouseholdMemberRecord,
} from '@/lib/households'
import {
  findHouseholdMemberConflict,
  getAccessibleHouseholdAccess,
  getAuthenticatedHouseholdContext,
  getErrorMessage,
  getHouseholdMemberships,
  getMembershipsForUser,
  isMissingCollectionContext,
  syncHouseholdAccessForUser,
} from '../households/_shared'

type PocketBaseCollectionRecord = Record<string, unknown> & { id: string }

async function getOwnedMemberCount(
  pb: ReturnType<typeof createPbServer>,
  householdId: string
): Promise<number> {
  const members = await getHouseholdMemberships(pb, householdId)
  return members.filter((member) => member.role === 'owner' && member.status === 'active').length
}

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthenticatedHouseholdContext(request)
    if ('error' in auth) {
      return auth.error
    }

    await syncHouseholdAccessForUser(auth.pb, auth.user)

    const { searchParams } = new URL(request.url)
    const householdId = searchParams.get('householdId')?.trim()

    let items: HouseholdMemberRecord[] = []
    if (householdId) {
      const access = await getAccessibleHouseholdAccess(auth.pb, auth.userId, householdId, auth.user.email)
      if (!access.canView) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      items = await getHouseholdMemberships(auth.pb, householdId)
    } else {
      const ownMemberships = await getMembershipsForUser(auth.pb, auth.userId, auth.user.email)
      const accessibleHouseholdIds = Array.from(
        new Set(ownMemberships.map((record) => record.householdId))
      )

      const grouped = await Promise.all(
        accessibleHouseholdIds.map((id) => getHouseholdMemberships(auth.pb, id))
      )
      items = grouped.flat()
    }

    return NextResponse.json({
      items: items.sort(sortHouseholdMembers),
      summary: buildHouseholdSummary(items),
    })
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Household collections are missing. Apply the latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Get household members error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch household members') },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthenticatedHouseholdContext(request)
    if ('error' in auth) {
      return auth.error
    }

    await syncHouseholdAccessForUser(auth.pb, auth.user)

    const body = await request.json() as Record<string, unknown>
    const parsed = parseHouseholdMemberInput(body)
    const householdId = typeof parsed.data?.householdId === 'string' ? parsed.data.householdId : ''
    if (!householdId) {
      return NextResponse.json({ error: parsed.error ?? 'Invalid household member payload' }, { status: 400 })
    }
    const parsedData = parsed.data
    if (!parsedData) {
      return NextResponse.json({ error: parsed.error ?? 'Invalid household member payload' }, { status: 400 })
    }

    const access = await getAccessibleHouseholdAccess(auth.pb, auth.userId, householdId, auth.user.email)
    if (!access.canView) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (!access.isOwner) {
      return NextResponse.json({ error: 'You do not have permission to manage this household.' }, { status: 403 })
    }

    const duplicate = await findHouseholdMemberConflict(
      auth.pb,
      householdId,
      String(parsedData.email ?? '')
    )
    if (duplicate) {
      return NextResponse.json({ error: 'A member with this email already exists in the household.' }, { status: 409 })
    }

    const normalizedEmail = String(parsedData.email ?? '').trim().toLowerCase()
    const authEmail = typeof auth.user.email === 'string' ? auth.user.email.trim().toLowerCase() : ''
    const isSelfMembership = normalizedEmail === authEmail
    if (!isSelfMembership && parsedData.status === 'active') {
      return NextResponse.json(
        { error: 'Active members must sign in with the invited email first.' },
        { status: 400 }
      )
    }

    const ownerCount = await getOwnedMemberCount(auth.pb, householdId)
    if (parsedData.role === 'owner' && parsedData.status === 'active' && ownerCount >= 1) {
      // Multiple owners are allowed, so this branch intentionally does nothing.
    }

    const created = await auth.pb.collection('household_members').create({
      ...parsedData,
      status: isSelfMembership ? 'active' : 'invited',
      userId: isSelfMembership ? auth.userId : '',
      user: isSelfMembership ? auth.userId : undefined,
    }) as PocketBaseCollectionRecord

    return NextResponse.json(normalizeHouseholdMemberRecord(created) ?? created)
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Household collections are missing. Apply the latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Create household member error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to add household member') },
      { status: 500 }
    )
  }
}
