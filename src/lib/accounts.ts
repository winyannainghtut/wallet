export type AccountType = 'cash' | 'bank' | 'credit_card' | 'ewallet' | 'investment' | 'other'

export type AccountRecord = {
  id: string
  name: string
  type: AccountType
  balance: number
  currency: string
  institution?: string
  note?: string
  isActive: boolean
  createdAt: string
  updatedAt?: string
}

type AccountPayloadInput = {
  name?: unknown
  type?: unknown
  balance?: unknown
  currency?: unknown
  institution?: unknown
  note?: unknown
  isActive?: unknown
}

export type NormalizedAccountInput = {
  name: string
  type: AccountType
  balance: number
  currency: string
  institution: string
  note: string
  isActive: boolean
}

const ACCOUNT_TYPES: AccountType[] = ['cash', 'bank', 'credit_card', 'ewallet', 'investment', 'other']

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeCurrencyCode(value: unknown): string {
  const normalized = normalizeText(value).toUpperCase()
  return /^[A-Z]{3}$/.test(normalized) ? normalized : ''
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function parseAccountInput(input: unknown): { data?: NormalizedAccountInput; error?: string } {
  if (typeof input !== 'object' || input === null) {
    return { error: 'Invalid account payload' }
  }

  const body = input as AccountPayloadInput
  const name = normalizeText(body.name)
  const type = normalizeText(body.type) as AccountType
  const balance = parseNumber(body.balance)
  const currency = normalizeCurrencyCode(body.currency)
  const institution = normalizeText(body.institution)
  const note = normalizeText(body.note)
  const isActive = body.isActive !== false

  if (!name) {
    return { error: 'name is required' }
  }

  if (!ACCOUNT_TYPES.includes(type)) {
    return { error: 'type is invalid' }
  }

  if (balance === null) {
    return { error: 'balance must be a number' }
  }

  if (!currency) {
    return { error: 'currency must be a valid 3-letter code' }
  }

  return {
    data: {
      name,
      type,
      balance,
      currency,
      institution,
      note,
      isActive,
    },
  }
}

export function mapAccountRecord(record: Record<string, unknown>): AccountRecord | null {
  if (
    typeof record.id !== 'string' ||
    typeof record.name !== 'string' ||
    typeof record.type !== 'string' ||
    typeof record.balance !== 'number' ||
    typeof record.currency !== 'string' ||
    typeof record.created !== 'string'
  ) {
    return null
  }

  return {
    id: record.id,
    name: record.name,
    type: record.type as AccountType,
    balance: record.balance,
    currency: record.currency,
    institution: typeof record.institution === 'string' && record.institution.trim().length > 0 ? record.institution : undefined,
    note: typeof record.note === 'string' && record.note.trim().length > 0 ? record.note : undefined,
    isActive: record.isActive !== false,
    createdAt: record.created,
    updatedAt: typeof record.updated === 'string' ? record.updated : undefined,
  }
}

export function getAccountTypeLabel(type: AccountType): string {
  switch (type) {
    case 'cash':
      return 'accounts.type.cash'
    case 'bank':
      return 'accounts.type.bank'
    case 'credit_card':
      return 'accounts.type.credit_card'
    case 'ewallet':
      return 'accounts.type.ewallet'
    case 'investment':
      return 'accounts.type.investment'
    default:
      return 'accounts.type.other'
  }
}
