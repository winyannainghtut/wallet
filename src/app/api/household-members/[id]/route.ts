import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'
import {
  normalizeHouseholdMemberRecord,
  parseHouseholdMemberInput,
  type HouseholdMemberRecord,
} from '@/lib/households'
import {
  buildMemberUpdatePayload,
  findHouseholdMemberConflict,
  getAccessibleHouseholdAccess,
  getAuthenticatedHouseholdContext,
  getErrorMessage,
  getHouseholdMemberships,
  isMissingCollectionContext,
  isNotFoundError,
  syncHouseholdAccessForUser,
} from '../../households/_shared'

type PocketBaseCollectionRecord = Record<string, unknown> & { id: string }

async function getMember(
  pb: ReturnType<typeof createPbServer>,
  id: string
): Promise<HouseholdMemberRecord | null> {
  const record = await pb.collection('household_members').getOne(id) as PocketBaseCollectionRecord
  return normalizeHouseholdMemberRecord(record)
}

async function getActiveOwnerCount(
  pb: ReturnType<typeof createPbServer>,
  householdId: string,
  excludingId?: string
): Promise<number> {
  const members = await getHouseholdMemberships(pb, householdId)
  return members.filter((member) =>
    member.id !== excludingId &&
    member.role === 'owner' &&
    member.status === 'active'
  ).length
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthenticatedHouseholdContext(request)
    if ('error' in auth) {
      return auth.error
    }

    await syncHouseholdAccessForUser(auth.pb, auth.user)

    const { id } = await params
    const member = await getMember(auth.pb, id)
    if (!member) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const access = await getAccessibleHouseholdAccess(auth.pb, auth.userId, member.householdId, auth.user.email)
    if (!access.canView) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(member)
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Household collections are missing. Apply the latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Get household member error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch household member') },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthenticatedHouseholdContext(request)
    if ('error' in auth) {
      return auth.error
    }

    await syncHouseholdAccessForUser(auth.pb, auth.user)

    const { id } = await params
    const existing = await getMember(auth.pb, id)
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const access = await getAccessibleHouseholdAccess(auth.pb, auth.userId, existing.householdId, auth.user.email)
    if (!access.canView) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (!access.isOwner) {
      return NextResponse.json({ error: 'You do not have permission to manage this household.' }, { status: 403 })
    }

    const body = await request.json() as Record<string, unknown>
    const parsed = parseHouseholdMemberInput(body, { partial: true })
    if (!parsed.data) {
      return NextResponse.json({ error: parsed.error ?? 'Invalid household member payload' }, { status: 400 })
    }

    if (
      typeof parsed.data.householdId === 'string' &&
      parsed.data.householdId.length > 0 &&
      parsed.data.householdId !== existing.householdId
    ) {
      return NextResponse.json(
        { error: 'Moving members between households is not supported.' },
        { status: 400 }
      )
    }

    const memberPayload = buildMemberUpdatePayload(existing, parsed.data, auth.user)
    if (!memberPayload.data) {
      return NextResponse.json({ error: memberPayload.error ?? 'Invalid household member payload' }, { status: 400 })
    }

    const nextEmail = String(memberPayload.data.email ?? existing.email)
    const duplicate = await findHouseholdMemberConflict(
      auth.pb,
      existing.householdId,
      nextEmail,
      { excludeId: existing.id }
    )
    if (duplicate) {
      return NextResponse.json({ error: 'A member with this email already exists in the household.' }, { status: 409 })
    }

    const nextRole = String(memberPayload.data.role ?? existing.role) as HouseholdMemberRecord['role']
    const nextStatus = String(memberPayload.data.status ?? existing.status) as HouseholdMemberRecord['status']
    if (
      existing.role === 'owner' &&
      existing.status === 'active' &&
      (nextRole !== 'owner' || nextStatus !== 'active')
    ) {
      const remainingOwners = await getActiveOwnerCount(auth.pb, existing.householdId, existing.id)
      if (remainingOwners <= 0) {
        return NextResponse.json(
          { error: 'A household must keep at least one active owner.' },
          { status: 400 }
        )
      }
    }

    const updated = await auth.pb.collection('household_members').update(id, memberPayload.data) as PocketBaseCollectionRecord
    return NextResponse.json(normalizeHouseholdMemberRecord(updated) ?? updated)
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Household collections are missing. Apply the latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Update household member error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to update household member') },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthenticatedHouseholdContext(request)
    if ('error' in auth) {
      return auth.error
    }

    await syncHouseholdAccessForUser(auth.pb, auth.user)

    const { id } = await params
    const existing = await getMember(auth.pb, id)
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const access = await getAccessibleHouseholdAccess(auth.pb, auth.userId, existing.householdId, auth.user.email)
    if (!access.canView) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (!access.isOwner) {
      return NextResponse.json({ error: 'You do not have permission to manage this household.' }, { status: 403 })
    }

    if (existing.role === 'owner' && existing.status === 'active') {
      const remainingOwners = await getActiveOwnerCount(auth.pb, existing.householdId, existing.id)
      if (remainingOwners <= 0) {
        return NextResponse.json(
          { error: 'A household must keep at least one active owner.' },
          { status: 400 }
        )
      }
    }

    await auth.pb.collection('household_members').delete(id)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'Household collections are missing. Apply the latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Delete household member error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to delete household member') },
      { status: 500 }
    )
  }
}
