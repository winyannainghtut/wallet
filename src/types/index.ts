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

export const INCOME_CATEGORIES = [
  'salary',
  'bonus',
  'freelance',
  'business',
  'investment',
  'other'
] as const

export type IncomeCategory = typeof INCOME_CATEGORIES[number]

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

export const INCOME_CATEGORY_LABELS: Record<IncomeCategory, { en: string; my: string }> = {
  salary: { en: 'Salary', my: 'Salary' },
  bonus: { en: 'Bonus', my: 'Bonus' },
  freelance: { en: 'Freelance', my: 'Freelance' },
  business: { en: 'Business', my: 'Business' },
  investment: { en: 'Investment', my: 'Investment' },
  other: { en: 'Other', my: 'Other' }
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



// Settings
export interface AppSettings {
  language: 'en' | 'my'
  currency: string
  aiModel?: 'glm-4.7' | 'glm-5-turbo' | 'glm-5'
  theme?: 'dark' | 'light' | 'blossom'
}



// User Profile for multi-user support
export interface UserProfile {
  id: string
  name: string
  avatar?: string // emoji or initials
  createdAt: string
}
