import { addMonths, endOfMonth, format, isBefore, isValid, parseISO, setDate, startOfToday } from 'date-fns'

export type LiabilityType = 'credit_card' | 'personal_loan' | 'mortgage' | 'bnpl' | 'other'

export type LiabilityRecord = {
  id: string
  name: string
  type: LiabilityType
  accountId?: string
  balance: number
  interestRate: number
  minimumPayment: number
  dueDay: number
  extraPayment: number
  startDate: string
  targetPayoffDate?: string
  note?: string
  isActive: boolean
  createdAt: string
  updatedAt?: string
}

type LiabilityPayloadInput = {
  name?: unknown
  type?: unknown
  accountId?: unknown
  balance?: unknown
  interestRate?: unknown
  minimumPayment?: unknown
  dueDay?: unknown
  extraPayment?: unknown
  startDate?: unknown
  targetPayoffDate?: unknown
  note?: unknown
  isActive?: unknown
}

export type NormalizedLiabilityInput = {
  name: string
  type: LiabilityType
  accountId: string
  balance: number
  interestRate: number
  minimumPayment: number
  dueDay: number
  extraPayment: number
  startDate: string
  targetPayoffDate: string
  note: string
  isActive: boolean
}

export type LiabilityPayoffProjection = {
  months: number | null
  totalInterest: number
  totalPaid: number
  payoffDate?: string
  isNegativeAmortization: boolean
}

const LIABILITY_TYPES: LiabilityType[] = ['credit_card', 'personal_loan', 'mortgage', 'bnpl', 'other']

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeLiabilityType(value: unknown): LiabilityType | null {
  switch (normalizeText(value)) {
    case 'credit_card':
    case 'personal_loan':
    case 'mortgage':
    case 'bnpl':
    case 'other':
      return normalizeText(value) as LiabilityType
    case 'loan':
      return 'personal_loan'
    case 'tax':
      return 'other'
    default:
      return null
  }
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const parsed = parseISO(value)
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === value
}

export function parseLiabilityInput(input: unknown): { data?: NormalizedLiabilityInput; error?: string } {
  if (typeof input !== 'object' || input === null) {
    return { error: 'Invalid liability payload' }
  }

  const body = input as LiabilityPayloadInput
  const name = normalizeText(body.name)
  const type = normalizeLiabilityType(body.type)
  const accountId = normalizeText(body.accountId)
  const balance = parseNumber(body.balance)
  const interestRate = parseNumber(body.interestRate) ?? 0
  const minimumPayment = parseNumber(body.minimumPayment)
  const dueDay = parseNumber(body.dueDay)
  const extraPayment = parseNumber(body.extraPayment) ?? 0
  const startDate = normalizeText(body.startDate)
  const targetPayoffDate = normalizeText(body.targetPayoffDate)
  const note = normalizeText(body.note)
  const isActive = body.isActive !== false

  if (!name) return { error: 'name is required' }
  if (!type || !LIABILITY_TYPES.includes(type)) return { error: 'type is invalid' }
  if (balance === null || balance < 0) return { error: 'balance must be a non-negative number' }
  if (interestRate < 0) return { error: 'interestRate must be a non-negative number' }
  if (minimumPayment === null || minimumPayment <= 0) return { error: 'minimumPayment must be a positive number' }
  if (dueDay === null || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return { error: 'dueDay must be an integer from 1 to 31' }
  if (extraPayment < 0) return { error: 'extraPayment must be a non-negative number' }
  if (!isValidDateOnly(startDate)) return { error: 'startDate must be a valid YYYY-MM-DD value' }
  if (targetPayoffDate && !isValidDateOnly(targetPayoffDate)) return { error: 'targetPayoffDate must be a valid YYYY-MM-DD value' }

  return {
    data: {
      name,
      type,
      accountId,
      balance,
      interestRate,
      minimumPayment,
      dueDay,
      extraPayment,
      startDate,
      targetPayoffDate,
      note,
      isActive,
    },
  }
}

export function mapLiabilityRecord(record: Record<string, unknown>): LiabilityRecord | null {
  if (
    typeof record.id !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.type !== 'string' ||
    typeof record.balance !== 'number' ||
    typeof record.minimumPayment !== 'number' ||
    typeof record.dueDay !== 'number' ||
    typeof record.startDate !== 'string' ||
    typeof record.created !== 'string'
  ) {
    return null
  }

  return {
    id: record.id,
    name: record.name,
    type: normalizeLiabilityType(record.type) ?? 'other',
    accountId: typeof record.accountId === 'string' && record.accountId.trim().length > 0 ? record.accountId : undefined,
    balance: record.balance,
    interestRate: typeof record.interestRate === 'number' ? record.interestRate : 0,
    minimumPayment: record.minimumPayment,
    dueDay: record.dueDay,
    extraPayment: typeof record.extraPayment === 'number' ? record.extraPayment : 0,
    startDate: record.startDate,
    targetPayoffDate: typeof record.targetPayoffDate === 'string' && record.targetPayoffDate.trim().length > 0 ? record.targetPayoffDate : undefined,
    note: typeof record.note === 'string' && record.note.trim().length > 0 ? record.note : undefined,
    isActive: record.isActive !== false,
    createdAt: record.created,
    updatedAt: typeof record.updated === 'string' ? record.updated : undefined,
  }
}

export function getLiabilityTypeLabel(type: LiabilityType): string {
  switch (type) {
    case 'credit_card':
      return 'liabilities.type.credit_card'
    case 'personal_loan':
      return 'liabilities.type.personal_loan'
    case 'mortgage':
      return 'liabilities.type.mortgage'
    case 'bnpl':
      return 'liabilities.type.bnpl'
    default:
      return 'liabilities.type.other'
  }
}

export function getLiabilityNextDueDate(liability: Pick<LiabilityRecord, 'dueDay'>, today = startOfToday()): string {
  const day = Math.min(liability.dueDay, endOfMonth(today).getDate())
  const currentMonthDue = setDate(today, day)
  if (!isBefore(currentMonthDue, today)) {
    return format(currentMonthDue, 'yyyy-MM-dd')
  }

  const nextMonth = addMonths(today, 1)
  const nextDay = Math.min(liability.dueDay, endOfMonth(nextMonth).getDate())
  return format(setDate(nextMonth, nextDay), 'yyyy-MM-dd')
}

export function getMonthlyLiabilityPayment(liability: Pick<LiabilityRecord, 'minimumPayment' | 'extraPayment'>): number {
  return liability.minimumPayment + liability.extraPayment
}

export function calculateDebtProjection(
  liability: Pick<LiabilityRecord, 'balance' | 'interestRate' | 'minimumPayment' | 'extraPayment'>,
  fromDate = startOfToday()
): LiabilityPayoffProjection {
  let remaining = liability.balance
  const monthlyPayment = getMonthlyLiabilityPayment(liability)
  const monthlyRate = liability.interestRate > 0 ? liability.interestRate / 100 / 12 : 0

  if (remaining <= 0) {
    return {
      months: 0,
      totalInterest: 0,
      totalPaid: 0,
      payoffDate: format(fromDate, 'yyyy-MM-dd'),
      isNegativeAmortization: false,
    }
  }

  const firstMonthInterest = remaining * monthlyRate
  if (monthlyPayment <= firstMonthInterest && remaining > 0) {
    return {
      months: null,
      totalInterest: 0,
      totalPaid: 0,
      isNegativeAmortization: true,
    }
  }

  let months = 0
  let totalInterest = 0
  let totalPaid = 0
  let cursor = fromDate

  while (remaining > 0.005 && months < 600) {
    const interest = remaining * monthlyRate
    totalInterest += interest
    remaining += interest

    const payment = Math.min(remaining, monthlyPayment)
    remaining -= payment
    totalPaid += payment
    months += 1
    cursor = addMonths(cursor, 1)
  }

  return {
    months,
    totalInterest,
    totalPaid,
    payoffDate: format(cursor, 'yyyy-MM-dd'),
    isNegativeAmortization: false,
  }
}
