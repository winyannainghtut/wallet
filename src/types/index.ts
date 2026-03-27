// Expense Categories
// Built-in categories
export const CATEGORIES = [
  'groceries',
  'breakfast',
  'lunch',
  'dinner',
  'transportation',
  'shopping',
  'donations',
  'insurance',
  'utilities',
  'entertainment',
  'health',
  'education',
  'other'
] as const

// Changed to string to allow custom categories
export type Category = string

// Built-in income categories
export const INCOME_CATEGORIES = [
  'salary',
  'bonus',
  'freelance',
  'business',
  'investment',
  'other'
] as const

// Changed to string to allow custom income categories
export type IncomeCategory = string

// Category labels for i18n
export const CATEGORY_LABELS: Record<string, { en: string; my: string }> = {
  groceries: { en: 'Groceries', my: 'စားသောက်ကုန်' },
  breakfast: { en: 'Breakfast', my: 'နံနက်စာ' },
  lunch: { en: 'Lunch', my: 'နေ့လယ်စာ' },
  dinner: { en: 'Dinner', my: 'ညစာ' },
  transportation: { en: 'Transportation', my: 'သွားလာရေး' },
  shopping: { en: 'Shopping', my: 'ဈေးဝယ်' },
  donations: { en: 'Donations', my: 'လှူဒါန်းမှု' },
  insurance: { en: 'Insurance', my: 'အာမခံ' },
  utilities: { en: 'Utilities', my: 'လျှပ်စစ်/ရေ' },
  entertainment: { en: 'Entertainment', my: 'ဖျော်ဖြေရေး' },
  health: { en: 'Health', my: 'ကျန်းမာရေး' },
  education: { en: 'Education', my: 'ပညာရေး' },
  other: { en: 'Other', my: 'အခြား' }
}

export const INCOME_CATEGORY_LABELS: Record<string, { en: string; my: string }> = {
  salary: { en: 'Salary', my: 'Salary' },
  bonus: { en: 'Bonus', my: 'Bonus' },
  freelance: { en: 'Freelance', my: 'Freelance' },
  business: { en: 'Business', my: 'Business' },
  investment: { en: 'Investment', my: 'Investment' },
  other: { en: 'Other', my: 'Other' }
}

export type AppLanguage = 'en' | 'my'

export function getCategoryLabel(category: string, language: AppLanguage): string {
  const known = CATEGORY_LABELS[category]
  if (!known) return category
  return known[language] ?? known.en ?? category
}

export function getIncomeCategoryLabel(category: string, language: AppLanguage): string {
  const known = INCOME_CATEGORY_LABELS[category]
  if (!known) return category
  return known[language] ?? known.en ?? category
}

// Expense interface
export interface Expense {
  id: string
  amount: number
  category: Category
  description: string
  date: string // YYYY-MM-DD
  createdAt: string // ISO timestamp
  updatedAt?: string
  tripId?: string
  sharedGroupExpense?: boolean
  paidByMemberId?: string
}

export interface Income {
  id: string
  amount: number
  category: IncomeCategory
  description: string
  date: string // YYYY-MM-DD
  createdAt: string // ISO timestamp
  updatedAt?: string
}

export interface SavingsGoal {
  id: string
  month: string // YYYY-MM
  targetAmount: number
  note?: string
  createdAt: string // ISO timestamp
  updatedAt?: string
}

export type SavingsAssetType = 'insurance' | 'crypto' | 'stocks' | 'personal_funds'

export interface SavingsAsset {
  id: string
  type: SavingsAssetType
  name: string
  amount: number
  symbol?: string
  recurringMonthlyAmount?: number
  recurringStartDate?: string
  note?: string
  createdAt: string // ISO timestamp
  updatedAt?: string
}

export type SavingsAssetValueSource = 'manual' | 'live' | 'pending'

export type CryptoSocketState = 'idle' | 'connecting' | 'connected' | 'error'

export interface AiSavingsAssetContext {
  id: string
  type: SavingsAssetType
  name: string
  symbol?: string
  quantity?: number
  currentValue: number
  valueSource: SavingsAssetValueSource
  productId?: string
  unitPriceUsd?: number
  quoteUpdatedAt?: string
  recurringMonthlyAmount?: number
  recurringStartDate?: string
}

export interface AiSavingsContext {
  currency: string
  totalAssetValue: number
  insuranceValue: number
  cryptoValue: number
  stocksValue: number
  personalFundsValue: number
  usdToCurrencyRate?: number
  fxError?: string | null
  cryptoSocketState?: CryptoSocketState
  cryptoSocketError?: string | null
  assets: AiSavingsAssetContext[]
}

// Trip interface for Travel Mode
export interface Trip {
  id: string
  name: string
  startDate: string
  endDate: string
  budget?: number
  destinations?: string
  groupName?: string
  groupSize?: number
  groupFund?: number
  createdAt: string
}

export interface TripMutationInput {
  name: string
  startDate: string
  endDate: string
  destinations?: string
  budget?: number | null
  groupName?: string
  groupSize?: number | null
  groupFund?: number | null
}

export interface TripMember {
  id: string
  tripId: string
  name: string
  isOwner?: boolean
  sortOrder?: number
  createdAt: string
  updatedAt?: string
}

export interface TripSettlement {
  id: string
  tripId: string
  fromMemberId: string
  toMemberId: string
  amount: number
  date: string
  status: 'planned' | 'paid'
  note?: string
  createdAt: string
  updatedAt?: string
}

export interface FundGoal {
  id: string
  name: string
  targetAmount: number
  targetDate?: string
  monthlyContribution?: number
  includeMonthlySavings?: boolean
  linkedTripId?: string
  linkedAssetIds: string[]
  note?: string
  status: 'active' | 'completed' | 'archived'
  color?: string
  createdAt: string
  updatedAt?: string
}

export type BillingCycle = 'monthly' | 'yearly' | 'weekly'

export interface Subscription {
  id: string
  name: string
  amount: number
  category: Category
  billingCycle: BillingCycle
  startDate: string
  isActive: boolean
  createdAt: string
  updatedAt?: string
}

// Summary interfaces
export interface DailySummary {
  date: string
  total: number
  byCategory: Record<Category, number>
  count: number
}

export interface WeeklySummary {
  weekStart: string
  weekEnd: string
  total: number
  byCategory: Record<Category, number>
  dailyBreakdown: DailySummary[]
}

export interface MonthlySummary {
  month: string // YYYY-MM
  total: number
  byCategory: Record<Category, number>
  weeklyBreakdown: WeeklySummary[]
}



// Settings
export interface CustomCategory {
  id: string
  name: string
  icon?: string
  type: 'expense' | 'income'
  color?: string
}

export interface AppSettings {
  language: 'en' | 'my'
  currency: string
  currencySign?: string
  aiModel?: 'glm-4.7' | 'glm-5' | 'glm-5-turbo'
  theme?: 'dark' | 'light' | 'blossom' | 'glowing-horizon'
}



// User Profile for multi-user support
export interface UserProfile {
  id: string
  name: string
  avatar?: string // emoji or initials
  createdAt: string
}
