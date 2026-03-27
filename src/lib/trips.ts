import type { Expense, Trip, TripMember, TripSettlement } from '@/types'

type TripPayloadInput = {
  name?: unknown
  destinations?: unknown
  startDate?: unknown
  endDate?: unknown
  currency?: unknown
  exchangeRate?: unknown
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
  currency: string
  exchangeRate: number | null
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

const CURRENCY_SCALE = 100

function toMoneyUnits(value: number): number {
  return Math.round((value + Number.EPSILON) * CURRENCY_SCALE)
}

function fromMoneyUnits(value: number): number {
  if (value === 0) return 0
  return value / CURRENCY_SCALE
}

function compareMembersForSettlement(a: TripMember, b: TripMember): number {
  if (a.isOwner && !b.isOwner) return -1
  if (!a.isOwner && b.isOwner) return 1
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
}

function getsRemainderUnit(position: number, startIndex: number, remainder: number, participantCount: number): boolean {
  if (remainder <= 0 || participantCount <= 0) return false
  const normalizedPosition = ((position - startIndex) % participantCount + participantCount) % participantCount
  return normalizedPosition < remainder
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeCurrencyCode(value: unknown): string {
  const normalized = normalizeText(value).toUpperCase()
  if (!normalized) return ''
  return /^[A-Z]{3}$/.test(normalized) ? normalized : ''
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
  const currency = normalizeCurrencyCode(input.currency)
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

  const exchangeRate = parseOptionalNumber(input.exchangeRate)
  if (exchangeRate.invalid || (exchangeRate.value !== null && exchangeRate.value <= 0)) {
    return { error: 'exchangeRate must be a positive number' }
  }

  if ((currency && exchangeRate.value === null) || (!currency && exchangeRate.value !== null)) {
    return { error: 'currency and exchangeRate must be provided together' }
  }

  if (normalizeText(input.currency) && !currency) {
    return { error: 'currency must be a valid 3-letter code' }
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
      currency,
      exchangeRate: exchangeRate.value,
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
      currency: input.currency || undefined,
      exchangeRate: input.exchangeRate ?? undefined,
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
    currency: input.currency,
    exchangeRate: input.exchangeRate,
    budget: input.budget,
    groupName: input.groupName,
    groupSize: input.groupSize,
    groupFund: input.groupFund,
  }
}

export function hasTripCurrencyConfig(trip: Pick<Trip, 'currency' | 'exchangeRate'> | null | undefined): boolean {
  return Boolean(
    trip &&
    normalizeCurrencyCode(trip.currency) &&
    typeof trip.exchangeRate === 'number' &&
    Number.isFinite(trip.exchangeRate) &&
    trip.exchangeRate > 0
  )
}

export function getTripDisplayCurrency(
  trip: Pick<Trip, 'currency' | 'exchangeRate'> | null | undefined,
  fallbackCurrency: string
): string {
  return hasTripCurrencyConfig(trip)
    ? normalizeCurrencyCode(trip?.currency) || fallbackCurrency
    : fallbackCurrency
}

export function convertTripAmountToBaseCurrency(
  amount: number,
  trip: Pick<Trip, 'currency' | 'exchangeRate'> | null | undefined
): number {
  if (!hasTripCurrencyConfig(trip)) {
    return amount
  }

  const exchangeRate = trip!.exchangeRate as number
  return amount * exchangeRate
}

export function convertBaseAmountToTripCurrency(
  amount: number,
  trip: Pick<Trip, 'currency' | 'exchangeRate'> | null | undefined
): number {
  if (!hasTripCurrencyConfig(trip)) {
    return amount
  }

  const exchangeRate = trip!.exchangeRate as number
  return amount / exchangeRate
}

export function getExpenseAmountForTripCurrency(
  expense: Pick<Expense, 'amount' | 'sourceAmount' | 'sourceCurrency'>,
  trip: Pick<Trip, 'currency' | 'exchangeRate'> | null | undefined
): number {
  const tripCurrency = normalizeCurrencyCode(trip?.currency)
  if (
    tripCurrency &&
    typeof expense.sourceAmount === 'number' &&
    Number.isFinite(expense.sourceAmount) &&
    expense.sourceAmount > 0 &&
    normalizeCurrencyCode(expense.sourceCurrency) === tripCurrency
  ) {
    return expense.sourceAmount
  }

  return convertBaseAmountToTripCurrency(expense.amount, trip)
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

  const orderedMembers = [...members].sort(compareMembersForSettlement)
  const participantCount =
    typeof trip.groupSize === 'number' && trip.groupSize >= orderedMembers.length
      ? trip.groupSize
      : orderedMembers.length

  const balanceMap = new Map<string, TripMemberBalance>(
    orderedMembers.map((member) => [member.id, {
      memberId: member.id,
      memberName: member.name,
      paidTotal: 0,
      shareOwed: 0,
      settlementsIn: 0,
      settlementsOut: 0,
      netBalance: 0,
    }])
  )
  const ownerMemberId = orderedMembers.find((member) => member.isOwner)?.id ?? orderedMembers[0]?.id

  expenses.forEach((expense, expenseIndex) => {
    if (!expense.sharedGroupExpense) return
    if (expense.amount <= 0) return

    const totalUnits = toMoneyUnits(expense.amount)
    const baseShareUnits = participantCount > 0 ? Math.floor(totalUnits / participantCount) : totalUnits
    const remainderUnits = participantCount > 0 ? totalUnits - baseShareUnits * participantCount : 0
    const remainderStartIndex = participantCount > 0 ? expenseIndex % participantCount : 0

    orderedMembers.forEach((member, memberIndex) => {
      const current = balanceMap.get(member.id)
      if (!current) return

      const shareUnits = baseShareUnits + (getsRemainderUnit(memberIndex, remainderStartIndex, remainderUnits, participantCount) ? 1 : 0)
      current.shareOwed += shareUnits
      current.netBalance -= shareUnits
    })

    const payerId = expense.paidByMemberId || ownerMemberId
    if (payerId && balanceMap.has(payerId)) {
      const payer = balanceMap.get(payerId)
      if (payer) {
        payer.paidTotal += totalUnits
        payer.netBalance += totalUnits
      }
    }
  })

  for (const settlement of settlements) {
    if (settlement.status !== 'paid' || settlement.amount <= 0) continue

    const fromMember = balanceMap.get(settlement.fromMemberId)
    const toMember = balanceMap.get(settlement.toMemberId)
    const amountUnits = toMoneyUnits(settlement.amount)

    if (fromMember) {
      fromMember.settlementsOut += amountUnits
      fromMember.netBalance += amountUnits
    }
    if (toMember) {
      toMember.settlementsIn += amountUnits
      toMember.netBalance -= amountUnits
    }
  }

  return [...balanceMap.values()]
    .map((member) => ({
      ...member,
      paidTotal: fromMoneyUnits(member.paidTotal),
      shareOwed: fromMoneyUnits(member.shareOwed),
      settlementsIn: fromMoneyUnits(member.settlementsIn),
      settlementsOut: fromMoneyUnits(member.settlementsOut),
      netBalance: fromMoneyUnits(member.netBalance),
    }))
    .sort((a, b) => b.netBalance - a.netBalance)
}

export function buildTripSettlementSuggestions(
  balances: TripMemberBalance[]
): TripSettlementSuggestion[] {
  const creditors = balances
    .map((member) => ({ ...member, remainingUnits: toMoneyUnits(member.netBalance) }))
    .filter((member) => member.remainingUnits > 0)
  const debtors = balances
    .map((member) => ({ ...member, remainingUnits: Math.abs(toMoneyUnits(member.netBalance)) }))
    .filter((member) => member.netBalance < 0 && member.remainingUnits > 0)

  const suggestions: TripSettlementSuggestion[] = []
  let creditorIndex = 0
  let debtorIndex = 0

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex]
    const debtor = debtors[debtorIndex]
    const amountUnits = Math.min(creditor.remainingUnits, debtor.remainingUnits)

    suggestions.push({
      fromMemberId: debtor.memberId,
      fromMemberName: debtor.memberName,
      toMemberId: creditor.memberId,
      toMemberName: creditor.memberName,
      amount: fromMoneyUnits(amountUnits),
    })

    creditor.remainingUnits -= amountUnits
    debtor.remainingUnits -= amountUnits

    if (creditor.remainingUnits <= 0) creditorIndex += 1
    if (debtor.remainingUnits <= 0) debtorIndex += 1
  }

  return suggestions
}
