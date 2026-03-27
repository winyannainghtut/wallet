export type HouseholdRecord = {
  id: string
  name: string
  baseCurrency?: string
  note?: string
  createdAt: string
  updatedAt?: string
}

export type HouseholdMemberRecord = {
  id: string
  householdId: string
  email: string
  name: string
  role: 'owner' | 'member' | 'viewer'
  status: 'active' | 'invited'
  userId?: string
  createdAt: string
  updatedAt?: string
}

export type HouseholdSummary = {
  total: number
  active: number
  invited: number
  owners: number
}

type HouseholdPayloadInput = {
  name?: unknown
  baseCurrency?: unknown
  note?: unknown
}

type HouseholdMemberPayloadInput = {
  householdId?: unknown
  email?: unknown
  name?: unknown
  role?: unknown
  status?: unknown
  userId?: unknown
}

const HOUSEHOLD_MEMBER_ROLES = ['owner', 'member', 'viewer'] as const
const HOUSEHOLD_MEMBER_STATUSES = ['active', 'invited'] as const

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function normalizeCurrencyCode(value: unknown): string {
  const normalized = normalizeText(value).toUpperCase()
  return normalized && /^[A-Z]{3}$/.test(normalized) ? normalized : ''
}

function hasOwn<T extends object>(obj: T, key: keyof T): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

export function normalizeHouseholdRecord(record: Record<string, unknown>): HouseholdRecord | null {
  if (
    typeof record.id !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.created !== 'string'
  ) {
    return null
  }

  return {
    id: record.id,
    name: record.name,
    baseCurrency: typeof record.baseCurrency === 'string' && record.baseCurrency.trim().length > 0 ? record.baseCurrency : undefined,
    note: typeof record.note === 'string' && record.note.trim().length > 0 ? record.note : undefined,
    createdAt: record.created,
    updatedAt: typeof record.updated === 'string' ? record.updated : undefined,
  }
}

export function normalizeHouseholdMemberRecord(record: Record<string, unknown>): HouseholdMemberRecord | null {
  if (
    typeof record.id !== 'string' ||
    typeof record.householdId !== 'string' ||
    typeof record.email !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.role !== 'string' ||
    typeof record.status !== 'string' ||
    typeof record.created !== 'string'
  ) {
    return null
  }

  if (
    !HOUSEHOLD_MEMBER_ROLES.includes(record.role as HouseholdMemberRecord['role']) ||
    !HOUSEHOLD_MEMBER_STATUSES.includes(record.status as HouseholdMemberRecord['status'])
  ) {
    return null
  }

  return {
    id: record.id,
    householdId: record.householdId,
    email: record.email,
    name: record.name,
    role: record.role as HouseholdMemberRecord['role'],
    status: record.status as HouseholdMemberRecord['status'],
    userId: typeof record.userId === 'string' && record.userId.trim().length > 0 ? record.userId : undefined,
    createdAt: record.created,
    updatedAt: typeof record.updated === 'string' ? record.updated : undefined,
  }
}

export function parseHouseholdPayload(
  input: unknown,
  options: { partial?: boolean } = {}
): { data?: Record<string, unknown>; error?: string } {
  if (typeof input !== 'object' || input === null) {
    return { error: 'Invalid household payload' }
  }

  const body = input as HouseholdPayloadInput
  const partial = options.partial === true
  const hasName = hasOwn(body, 'name')
  const hasBaseCurrency = hasOwn(body, 'baseCurrency')
  const hasNote = hasOwn(body, 'note')

  const name = hasName ? normalizeText(body.name).slice(0, 120) : ''
  const baseCurrency = hasBaseCurrency ? normalizeCurrencyCode(body.baseCurrency) : ''
  const note = hasNote ? normalizeText(body.note).slice(0, 500) : ''

  if ((!partial || hasName) && !name) {
    return { error: 'name is required' }
  }

  if (hasBaseCurrency && normalizeText(body.baseCurrency).length > 0 && !baseCurrency) {
    return { error: 'baseCurrency must be a valid 3-letter code' }
  }

  const payload: Record<string, unknown> = {}
  if (!partial || hasName) payload.name = name
  if (hasBaseCurrency) payload.baseCurrency = baseCurrency || ''
  if (hasNote) payload.note = note
  return { data: payload }
}

export function parseHouseholdMemberPayload(
  input: unknown,
  options: { partial?: boolean } = {}
): { data?: Record<string, unknown>; error?: string } {
  if (typeof input !== 'object' || input === null) {
    return { error: 'Invalid household member payload' }
  }

  const body = input as HouseholdMemberPayloadInput
  const partial = options.partial === true
  const hasHouseholdId = hasOwn(body, 'householdId')
  const hasEmail = hasOwn(body, 'email')
  const hasName = hasOwn(body, 'name')
  const hasRole = hasOwn(body, 'role')
  const hasStatus = hasOwn(body, 'status')
  const hasUserId = hasOwn(body, 'userId')

  const householdId = hasHouseholdId ? normalizeText(body.householdId) : ''
  const email = hasEmail ? normalizeText(body.email).toLowerCase() : ''
  const name = hasName ? normalizeText(body.name).slice(0, 120) : ''
  const role = hasRole ? normalizeText(body.role) : ''
  const status = hasStatus ? normalizeText(body.status) : ''
  const userId = hasUserId ? normalizeText(body.userId) : ''

  if ((!partial || hasHouseholdId) && !householdId) {
    return { error: 'householdId is required' }
  }

  if ((!partial || hasEmail) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'email must be valid' }
  }

  if ((!partial || hasName) && !name) {
    return { error: 'name is required' }
  }

  if ((!partial || hasRole) && !HOUSEHOLD_MEMBER_ROLES.includes(role as HouseholdMemberRecord['role'])) {
    return { error: 'role is invalid' }
  }

  if ((!partial || hasStatus) && !HOUSEHOLD_MEMBER_STATUSES.includes(status as HouseholdMemberRecord['status'])) {
    return { error: 'status is invalid' }
  }

  const payload: Record<string, unknown> = {}
  if (!partial || hasHouseholdId) payload.householdId = householdId
  if (!partial || hasEmail) payload.email = email
  if (!partial || hasName) payload.name = name
  if (!partial || hasRole) payload.role = role
  if (!partial || hasStatus) payload.status = status
  if (hasUserId) payload.userId = userId
  return { data: payload }
}

export function parseHouseholdMemberInput(
  input: unknown,
  options: { partial?: boolean } = {}
) {
  return parseHouseholdMemberPayload(input, options)
}

export function sortHouseholds(a: HouseholdRecord, b: HouseholdRecord): number {
  return a.name.localeCompare(b.name)
}

export function sortHouseholdMembers(a: HouseholdMemberRecord, b: HouseholdMemberRecord): number {
  if (a.status !== b.status) {
    return a.status.localeCompare(b.status)
  }

  const roleOrder = { owner: 0, member: 1, viewer: 2 }
  const roleDelta = roleOrder[a.role] - roleOrder[b.role]
  if (roleDelta !== 0) {
    return roleDelta
  }

  return a.name.localeCompare(b.name) || a.email.localeCompare(b.email)
}

export function buildHouseholdSummary(members: HouseholdMemberRecord[]): HouseholdSummary {
  return {
    total: members.length,
    active: members.filter((member) => member.status === 'active').length,
    invited: members.filter((member) => member.status === 'invited').length,
    owners: members.filter((member) => member.role === 'owner' && member.status === 'active').length,
  }
}
