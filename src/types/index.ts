// Expense Categories
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

export type Category = typeof CATEGORIES[number]

// Category labels for i18n
export const CATEGORY_LABELS: Record<Category, { en: string; my: string }> = {
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
}

// Trip interface for Travel Mode
export interface Trip {
  id: string
  name: string
  startDate: string
  endDate: string
  budget?: number
  destinations?: string
  createdAt: string
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

// Filter types
export interface ExpenseFilter {
  startDate?: string
  endDate?: string
  category?: Category
  minAmount?: number
  maxAmount?: number
  search?: string
}

// Settings
export interface AppSettings {
  language: 'en' | 'my'
  currency: string
  passwordHash?: string
  apiKey?: string
  monthlyBudget?: number
}

// AI Chat
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

// Excel import/export
export interface ExcelExpense {
  Date: string
  Category: string
  Amount: number
  Description: string
}

// User Profile for multi-user support
export interface UserProfile {
  id: string
  name: string
  avatar?: string // emoji or initials
  createdAt: string
}
