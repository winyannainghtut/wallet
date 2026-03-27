import { NextRequest, NextResponse } from 'next/server'
import { createPbServer } from '@/lib/pb'
import {
  escapeFilterValue,
  normalizeHouseholdMemberRecord,
  normalizeHouseholdRecord,
  sortHouseholds,
  type HouseholdMemberRecord,
  type HouseholdRecord,
} from '@/lib/households'

type PocketBaseLikeError = {
  status?: number
  message?: string
}

type AuthModelLike = {
  id: string
  email?: string
  name?: string
}

type PocketBaseCollectionRecord = Record<string, unknown> & { id: string }

export type AuthenticatedHouseholdContext = {
  pb: ReturnType<typeof createPbServer>
  user: AuthModelLike
  userId: string
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function buildUserMembershipFilter(userId: string, userEmail?: string): string {
  const filters = [`userId = "${escapeFilterValue(userId)}"`]
  const normalizedEmail = normalizeEmail(userEmail)
  if (normalizedEmail) {
    filters.push(`email:lower = "${escapeFilterValue(normalizedEmail)}"`)
  }

  return filters.length === 1 ? filters[0] : `(${filters.join(' || ')})`
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as PocketBaseLikeError).message
    if (typeof message === 'string' && message.length > 0) {
      return message
    }
  }
  return fallback
}

export function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && (error as PocketBaseLikeError).status === 404
}

export function isMissingCollectionContext(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const status = 'status' in error ? (error as PocketBaseLikeError).status : undefined
  const message = 'message' in error ? (error as PocketBaseLikeError).message : undefined
  return status === 404 && typeof message === 'string' && message.toLowerCase().includes('collection context')
}

export function getAuthenticatedHouseholdContext(request: NextRequest):
  | AuthenticatedHouseholdContext
  | { error: NextResponse } {
  const authCookie = request.cookies.get('pb_auth')?.value
  const pb = createPbServer(authCookie)

  if (!pb.authStore.isValid || !pb.authStore.model) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const model = pb.authStore.model as unknown
  if (typeof model !== 'object' || model === null || !('id' in model)) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const user = model as AuthModelLike
  return { pb, user, userId: user.id }
}

export async function getHouseholdRecord(
  pb: ReturnType<typeof createPbServer>,
  householdId: string
): Promise<HouseholdRecord | null> {
  const record = await pb.collection('households').getOne(householdId) as PocketBaseCollectionRecord
  return normalizeHouseholdRecord(record)
}

export async function getMembershipsForUser(
  pb: ReturnType<typeof createPbServer>,
  userId: string,
  userEmail?: string
): Promise<HouseholdMemberRecord[]> {
  const records = await pb.collection('household_members').getFullList({
    sort: 'status,role,name',
    filter: buildUserMembershipFilter(userId, userEmail),
  }) as PocketBaseCollectionRecord[]

  return records
    .map((record) => normalizeHouseholdMemberRecord(record))
    .filter((record): record is HouseholdMemberRecord => record !== null)
}

export async function getHouseholdMemberships(
  pb: ReturnType<typeof createPbServer>,
  householdId: string
): Promise<HouseholdMemberRecord[]> {
  const records = await pb.collection('household_members').getFullList({
    sort: 'status,role,name',
    filter: `householdId = "${escapeFilterValue(householdId)}"`,
  }) as PocketBaseCollectionRecord[]

  return records
    .map((record) => normalizeHouseholdMemberRecord(record))
    .filter((record): record is HouseholdMemberRecord => record !== null)
}

export async function getAccessibleHouseholdAccess(
  pb: ReturnType<typeof createPbServer>,
  userId: string,
  householdId: string,
  userEmail?: string
): Promise<{
  membership: HouseholdMemberRecord | null
  canView: boolean
  canManage: boolean
  isOwner: boolean
}> {
  const memberships = await pb.collection('household_members').getFullList({
    sort: 'status,role,name',
    filter: `householdId = "${escapeFilterValue(householdId)}" && ${buildUserMembershipFilter(userId, userEmail)}`,
  }) as PocketBaseCollectionRecord[]

  const normalized = memberships
    .map((record) => normalizeHouseholdMemberRecord(record))
    .filter((record): record is HouseholdMemberRecord => record !== null)

  const membership =
    normalized.find((record) => record.status === 'active') ??
    normalized[0] ??
    null

  const canManage =
    membership?.status === 'active' &&
    membership.role === 'owner'

  return {
    membership,
    canView: membership !== null,
    canManage,
    isOwner: membership?.status === 'active' && membership.role === 'owner',
  }
}

export async function getAccessibleHouseholds(
  pb: ReturnType<typeof createPbServer>,
  userId: string,
  userEmail?: string
): Promise<HouseholdRecord[]> {
  const memberships = await getMembershipsForUser(pb, userId, userEmail)
  const householdIds = Array.from(new Set(memberships.map((membership) => membership.householdId)))

  const households = await Promise.all(
    householdIds.map(async (householdId) => {
      try {
        return await getHouseholdRecord(pb, householdId)
      } catch {
        return null
      }
    })
  )

  return households
    .filter((household): household is HouseholdRecord => household !== null)
    .sort(sortHouseholds)
}

export function buildOwnerMemberSeed(user: AuthModelLike, householdId: string) {
  const normalizedEmail = normalizeEmail(user.email)
  const fallbackName =
    typeof user.name === 'string' && user.name.trim().length > 0
      ? user.name.trim()
      : normalizedEmail
          ? normalizedEmail.split('@')[0]
          : 'Owner'

  return {
    householdId,
    email: normalizedEmail || 'unknown@example.com',
    name: fallbackName,
    role: 'owner' as const,
    status: 'active' as const,
    userId: user.id,
    user: user.id,
  }
}

async function ensureOwnerMembershipForHousehold(
  pb: ReturnType<typeof createPbServer>,
  user: AuthModelLike,
  householdId: string
) {
  const seed = buildOwnerMemberSeed(user, householdId)
  const existingRecords = await pb.collection('household_members').getFullList({
    sort: 'created',
    filter: `householdId = "${escapeFilterValue(householdId)}" && ${buildUserMembershipFilter(user.id, seed.email)}`,
  }) as PocketBaseCollectionRecord[]

  const normalized = existingRecords
    .map((record) => normalizeHouseholdMemberRecord(record))
    .filter((record): record is HouseholdMemberRecord => record !== null)

  const existing = normalized.find((record) => record.userId === user.id) ?? normalized[0] ?? null
  if (!existing) {
    await pb.collection('household_members').create(seed)
    return
  }

  const updates: Record<string, unknown> = {}
  if (existing.email !== seed.email) updates.email = seed.email
  if (existing.name !== seed.name) updates.name = seed.name
  if (existing.role !== 'owner') updates.role = 'owner'
  if (existing.status !== 'active') updates.status = 'active'
  if (existing.userId !== user.id) updates.userId = user.id
  updates.user = user.id

  if (Object.keys(updates).length > 0) {
    await pb.collection('household_members').update(existing.id, updates)
  }
}

async function bindInvitationsByEmail(
  pb: ReturnType<typeof createPbServer>,
  user: AuthModelLike
) {
  const normalizedEmail = normalizeEmail(user.email)
  if (!normalizedEmail) {
    return
  }

  const records = await pb.collection('household_members').getFullList({
    sort: 'created',
    filter: `email:lower = "${escapeFilterValue(normalizedEmail)}"`,
  }) as PocketBaseCollectionRecord[]

  for (const rawRecord of records) {
    const record = normalizeHouseholdMemberRecord(rawRecord)
    if (!record) continue
    if (record.userId && record.userId !== user.id) continue

    const updates: Record<string, unknown> = {}
    if (record.userId !== user.id) updates.userId = user.id
    if (record.status !== 'active') updates.status = 'active'
    updates.user = user.id

    if (Object.keys(updates).length > 0) {
      await pb.collection('household_members').update(record.id, updates)
    }
  }
}

export async function syncHouseholdAccessForUser(
  pb: ReturnType<typeof createPbServer>,
  user: AuthModelLike
) {
  const ownedHouseholds = await pb.collection('households').getFullList({
    sort: 'created',
    filter: `user = "${escapeFilterValue(user.id)}"`,
  }) as PocketBaseCollectionRecord[]

  for (const rawHousehold of ownedHouseholds) {
    const household = normalizeHouseholdRecord(rawHousehold)
    if (!household) continue
    await ensureOwnerMembershipForHousehold(pb, user, household.id)
  }

  await bindInvitationsByEmail(pb, user)
}

export async function findHouseholdMemberConflict(
  pb: ReturnType<typeof createPbServer>,
  householdId: string,
  email: string,
  options: { excludeId?: string } = {}
): Promise<HouseholdMemberRecord | null> {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) {
    return null
  }

  const records = await pb.collection('household_members').getFullList({
    sort: 'created',
    filter: `householdId = "${escapeFilterValue(householdId)}" && email:lower = "${escapeFilterValue(normalizedEmail)}"`,
  }) as PocketBaseCollectionRecord[]

  const normalized = records
    .map((record) => normalizeHouseholdMemberRecord(record))
    .filter((record): record is HouseholdMemberRecord => record !== null)

  return normalized.find((record) => record.id !== options.excludeId) ?? null
}

export function buildMemberUpdatePayload(
  member: HouseholdMemberRecord,
  partial: Record<string, unknown>,
  authUser: AuthModelLike
): { data?: Record<string, unknown>; error?: string } {
  const nextEmail = normalizeEmail(partial.email ?? member.email)
  const nextRole = (typeof partial.role === 'string' ? partial.role : member.role) as HouseholdMemberRecord['role']
  let nextStatus = (typeof partial.status === 'string' ? partial.status : member.status) as HouseholdMemberRecord['status']
  const nextName =
    typeof partial.name === 'string' && partial.name.trim().length > 0
      ? partial.name.trim()
      : member.name

  const authEmail = normalizeEmail(authUser.email)
  const emailChanged = Object.prototype.hasOwnProperty.call(partial, 'email') && nextEmail !== normalizeEmail(member.email)
  const payload: Record<string, unknown> = {
    ...partial,
    email: nextEmail,
    name: nextName,
    role: nextRole,
  }

  if (!nextEmail) {
    return { error: 'email must be valid' }
  }

  if (emailChanged) {
    if (nextEmail === authEmail) {
      nextStatus = 'active'
      payload.userId = authUser.id
      payload.user = authUser.id
    } else {
      if (nextStatus === 'active') {
        return { error: 'Active members must sign in with the invited email first.' }
      }
      nextStatus = 'invited'
      payload.userId = ''
      payload.user = null
    }
  } else if (member.userId) {
    payload.userId = member.userId
  } else if (nextEmail === authEmail) {
    payload.userId = authUser.id
    payload.user = authUser.id
    nextStatus = 'active'
  } else if (nextStatus === 'active') {
    return { error: 'Active members must sign in with the invited email first.' }
  }

  payload.status = nextStatus
  return { data: payload }
}
