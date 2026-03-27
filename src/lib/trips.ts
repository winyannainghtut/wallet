import type { Expense, Trip, TripMember, TripSettlement } from '@/types'

type TripPayloadInput = {
  name?: unknown
  destinations?: unknown
  startDate?: unknown
  endDate?: unknown
  budget?: unknown
  groupName?: unknown
  groupSize?: unknown
  groupFund?: unknown
}

export type NormalizedTripInput = {
  name: string
  destinations: string
  startDate: string
  endDate: string
  budget: number | null
  groupName: string
  groupSize: number | null
  groupFund: number | null
}

export type TripFinancialSummary = {
  hasBudget: boolean
  budgetProgress: number
  isOverBudget: boolean
  remainingBudget?: number
  hasGroupSetup: boolean
  hasGroupFund: boolean
  sharedGroupSpend: number
  groupFundProgress?: number
  isOverGroupFund: boolean
  remainingGroupFund?: number
  perPersonSharedSpend?: number
  perPersonFundTarget?: number
}

export type TripMemberBalance = {
  memberId: string
  memberName: string
  paidTotal: number
  shareOwed: number
  settlementsIn: number
  settlementsOut: number
  netBalance: number
}

export type TripSettlementSuggestion = {
  fromMemberId: string
  fromMemberName: string
  toMemberId: string
  toMemberName: string
  amount: number
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function parseOptionalNumber(
  value: unknown,
  { integer = false }: { integer?: boolean } = {}
): { value: number | null; invalid: boolean } {
  if (value === null || value === undefined) {
    return { value: null, invalid: false }
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    return { value: null, invalid: false }
  }

  const parsed =
    typeof value === 'number'
      ? value
      : Number.parseFloat(String(value).trim())

  if (!Number.isFinite(parsed)) {
    return { value: null, invalid: true }
  }

  if (integer && !Number.isInteger(parsed)) {
    return { value: null, invalid: true }
  }

  return { value: parsed, invalid: false }
}

function isValidDateOnly(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return false
  }

  const year = Number.parseInt(match[1], 10)
  const month = Number.parseInt(match[2], 10)
  const day = Number.parseInt(match[3], 10)
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function parseTripInput(input: TripPayloadInput): {
  data?: NormalizedTripInput
  error?: string
} {
  const name = normalizeText(input.name)
  const destinations = normalizeText(input.destinations)
  const startDate = normalizeText(input.startDate)
  const endDate = normalizeText(input.endDate)
  const groupName = normalizeText(input.groupName)

  if (!name) {
    return { error: 'name is required' }
  }

  if (!startDate || !isValidDateOnly(startDate)) {
    return { error: 'startDate must be a valid YYYY-MM-DD date' }
  }

  if (!endDate || !isValidDateOnly(endDate)) {
    return { error: 'endDate must be a valid YYYY-MM-DD date' }
  }

  if (new Date(`${endDate}T00:00:00`) < new Date(`${startDate}T00:00:00`)) {
    return { error: 'endDate must be on or after startDate' }
  }

  const budget = parseOptionalNumber(input.budget)
  if (budget.invalid || (budget.value !== null && budget.value < 0)) {
    return { error: 'budget must be a non-negative number' }
  }

  const groupSize = parseOptionalNumber(input.groupSize, { integer: true })
  if (groupSize.invalid || (groupSize.value !== null && groupSize.value < 2)) {
    return { error: 'groupSize must be an integer of at least 2' }
  }

  const groupFund = parseOptionalNumber(input.groupFund)
  if (groupFund.invalid || (groupFund.value !== null && groupFund.value < 0)) {
    return { error: 'groupFund must be a non-negative number' }
  }

  return {
    data: {
      name,
      destinations,
      startDate,
      endDate,
      budget: budget.value,
      groupName,
      groupSize: groupSize.value,
      groupFund: groupFund.value,
    },
  }
}

export function buildTripCreatePayload(input: NormalizedTripInput): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      destinations: input.destinations || undefined,
      budget: input.budget ?? undefined,
      groupName: input.groupName || undefined,
      groupSize: input.groupSize ?? undefined,
      groupFund: input.groupFund ?? undefined,
    }).filter(([, value]) => value !== undefined)
  )
}

export function buildTripUpdatePayload(input: NormalizedTripInput): Record<string, unknown> {
  return {
    name: input.name,
    destinations: input.destinations,
    startDate: input.startDate,
    endDate: input.endDate,
    budget: input.budget,
    groupName: input.groupName,
    groupSize: input.groupSize,
    groupFund: input.groupFund,
  }
}

export function getTripFinancialSummary(
  trip: Pick<Trip, 'budget' | 'groupFund' | 'groupSize' | 'groupName'>,
  totalSpend: number,
  sharedGroupSpend = totalSpend
): TripFinancialSummary {
  const budget = typeof trip.budget === 'number' ? trip.budget : null
  const groupFund = typeof trip.groupFund === 'number' ? trip.groupFund : null
  const groupSize = typeof trip.groupSize === 'number' ? trip.groupSize : null
  const hasBudget = budget !== null
  const hasGroupFund = groupFund !== null
  const hasGroupSetup = Boolean(
    trip.groupName ||
    groupSize !== null ||
    hasGroupFund ||
    sharedGroupSpend > 0
  )
  const remainingBudget = hasBudget ? budget - totalSpend : undefined
  const remainingGroupFund = hasGroupFund ? groupFund - sharedGroupSpend : undefined
  const hasGroupSize = groupSize !== null && groupSize > 0

  return {
    hasBudget,
    budgetProgress:
      hasBudget && budget > 0
        ? Math.min((totalSpend / budget) * 100, 100)
        : 0,
    isOverBudget: hasBudget ? totalSpend > budget : false,
    remainingBudget,
    hasGroupSetup,
    hasGroupFund,
    sharedGroupSpend,
    groupFundProgress:
      hasGroupFund && groupFund > 0
        ? Math.min((sharedGroupSpend / groupFund) * 100, 100)
        : undefined,
    isOverGroupFund: hasGroupFund ? sharedGroupSpend > groupFund : false,
    remainingGroupFund,
    perPersonSharedSpend: hasGroupSize ? sharedGroupSpend / groupSize : undefined,
    perPersonFundTarget:
      hasGroupFund && hasGroupSize
        ? groupFund / groupSize
        : undefined,
  }
}

export function calculateTripMemberBalances(
  trip: Pick<Trip, 'groupSize'>,
  members: TripMember[],
  expenses: Array<Pick<Expense, 'amount' | 'sharedGroupExpense' | 'paidByMemberId'>>,
  settlements: Array<Pick<TripSettlement, 'fromMemberId' | 'toMemberId' | 'amount' | 'status'>>
): TripMemberBalance[] {
  if (members.length === 0) {
    return []
  }

  const participantCount =
    typeof trip.groupSize === 'number' && trip.groupSize >= members.length
      ? trip.groupSize
      : members.length

  const balanceMap = new Map<string, TripMemberBalance>(
    members.map((member) => [member.id, {
      memberId: member.id,
      memberName: member.name,
      paidTotal: 0,
      shareOwed: 0,
      settlementsIn: 0,
      settlementsOut: 0,
      netBalance: 0,
    }])
  )
  const ownerMemberId = members.find((member) => member.isOwner)?.id ?? members[0]?.id

  for (const expense of expenses) {
    if (!expense.sharedGroupExpense) continue
    if (expense.amount <= 0) continue

    const share = participantCount > 0 ? expense.amount / participantCount : expense.amount
    for (const member of balanceMap.values()) {
      member.shareOwed += share
      member.netBalance -= share
    }

    const payerId = expense.paidByMemberId || ownerMemberId
    if (payerId && balanceMap.has(payerId)) {
      const payer = balanceMap.get(payerId)
      if (payer) {
        payer.paidTotal += expense.amount
        payer.netBalance += expense.amount
      }
    }
  }

  for (const settlement of settlements) {
    if (settlement.status !== 'paid' || settlement.amount <= 0) continue

    const fromMember = balanceMap.get(settlement.fromMemberId)
    const toMember = balanceMap.get(settlement.toMemberId)

    if (fromMember) {
      fromMember.settlementsOut += settlement.amount
      fromMember.netBalance += settlement.amount
    }
    if (toMember) {
      toMember.settlementsIn += settlement.amount
      toMember.netBalance -= settlement.amount
    }
  }

  return [...balanceMap.values()].sort((a, b) => b.netBalance - a.netBalance)
}

export function buildTripSettlementSuggestions(
  balances: TripMemberBalance[]
): TripSettlementSuggestion[] {
  const creditors = balances
    .filter((member) => member.netBalance > 0.009)
    .map((member) => ({ ...member, remaining: member.netBalance }))
  const debtors = balances
    .filter((member) => member.netBalance < -0.009)
    .map((member) => ({ ...member, remaining: Math.abs(member.netBalance) }))

  const suggestions: TripSettlementSuggestion[] = []
  let creditorIndex = 0
  let debtorIndex = 0

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex]
    const debtor = debtors[debtorIndex]
    const amount = Math.min(creditor.remaining, debtor.remaining)

    suggestions.push({
      fromMemberId: debtor.memberId,
      fromMemberName: debtor.memberName,
      toMemberId: creditor.memberId,
      toMemberName: creditor.memberName,
      amount,
    })

    creditor.remaining -= amount
    debtor.remaining -= amount

    if (creditor.remaining <= 0.009) creditorIndex += 1
    if (debtor.remaining <= 0.009) debtorIndex += 1
  }

  return suggestions
}
