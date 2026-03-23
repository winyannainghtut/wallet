import { Expense, AppSettings, UserProfile, Category, DailySummary, WeeklySummary, MonthlySummary, CustomCategory } from '@/types'
import { v4 as uuidv4 } from 'uuid'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, parseISO } from 'date-fns'

// ==================== Multi-User Profile System ====================

const GLOBAL_KEYS = {
  PROFILES: 'wallet_app_profiles',
  ACTIVE_USER: 'wallet_app_active_user',
}

// Get storage keys namespaced by user ID
function userKey(base: string): string {
  const userId = getActiveUserId()
  return `wallet_app_${userId}_${base}`
}

const FIELD = {
  EXPENSES: 'expenses',
  TRIPS: 'trips',
  SUBSCRIPTIONS: 'subscriptions',
  SETTINGS: 'settings',
  CUSTOM_CATEGORIES: 'custom_categories',
}

// ==================== Profile Management ====================

export function getProfiles(): UserProfile[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(GLOBAL_KEYS.PROFILES)
  return data ? JSON.parse(data) : []
}

function saveProfiles(profiles: UserProfile[]): void {
  localStorage.setItem(GLOBAL_KEYS.PROFILES, JSON.stringify(profiles))
}

export function addProfile(name: string, avatar?: string): UserProfile {
  const profiles = getProfiles()
  const profile: UserProfile = {
    id: uuidv4(),
    name,
    avatar: avatar || name.charAt(0).toUpperCase(),
    createdAt: new Date().toISOString(),
  }
  profiles.push(profile)
  saveProfiles(profiles)
  return profile
}

export function ensureProfileForUser(user: {
  id: string
  name?: string
  email?: string
  avatar?: string
}): UserProfile {
  const profiles = getProfiles()
  const existing = profiles.find((profile) => profile.id === user.id)
  const displayName = user.name?.trim() || user.email?.trim() || 'User'
  const avatar = user.avatar || existing?.avatar || displayName.charAt(0).toUpperCase()

  const profile: UserProfile = existing
    ? {
        ...existing,
        name: displayName,
        avatar,
      }
    : {
        id: user.id,
        name: displayName,
        avatar,
        createdAt: new Date().toISOString(),
      }

  if (existing) {
    saveProfiles(profiles.map((item) => (item.id === user.id ? profile : item)))
  } else {
    saveProfiles([...profiles, profile])
  }

  setActiveUserId(user.id)
  return profile
}

export function deleteProfile(id: string): boolean {
  const profiles = getProfiles()
  if (profiles.length <= 1) return false // Must keep at least one
  const filtered = profiles.filter(p => p.id !== id)
  if (filtered.length === profiles.length) return false
  saveProfiles(filtered)

  // Clean up user data
  const prefix = `wallet_app_${id}_`
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (key && key.startsWith(prefix)) {
      localStorage.removeItem(key)
    }
  }

  // Switch to first remaining profile if deleting the active user
  if (getActiveUserId() === id) {
    setActiveUserId(filtered[0].id)
  }
  return true
}

function getActiveUserId(): string {
  if (typeof window === 'undefined') return 'default'
  return localStorage.getItem(GLOBAL_KEYS.ACTIVE_USER) || 'default'
}

export function setActiveUserId(id: string): void {
  localStorage.setItem(GLOBAL_KEYS.ACTIVE_USER, id)
}

export function getActiveProfile(): UserProfile | null {
  const profiles = getProfiles()
  const activeId = getActiveUserId()
  return profiles.find(p => p.id === activeId) || null
}

// ==================== Expense Operations ====================

function getExpenses(): Expense[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(userKey(FIELD.EXPENSES))
  return data ? JSON.parse(data) : []
}

// ==================== Custom Categories Operations ====================

export function getCustomCategories(): CustomCategory[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(userKey(FIELD.CUSTOM_CATEGORIES))
  return data ? JSON.parse(data) : []
}

export function saveCustomCategories(categories: CustomCategory[]): void {
  localStorage.setItem(userKey(FIELD.CUSTOM_CATEGORIES), JSON.stringify(categories))
}




// ==================== Summary Operations ====================

export function getDailySummary(dateStr: string, expensesArr?: Expense[]): DailySummary {
  const expenses = (expensesArr || getExpenses()).filter(e => e.date === dateStr)

  const byCategory = {} as Record<Category, number>
  expenses.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount
  })

  return {
    date: dateStr,
    total: expenses.reduce((sum, e) => sum + e.amount, 0),
    byCategory,
    count: expenses.length
  }
}

export function getWeeklySummary(date: Date = new Date(), expensesArr?: Expense[]): WeeklySummary {
  const weekStart = startOfWeek(date)
  const weekEnd = endOfWeek(date)
  const allExpenses = expensesArr || getExpenses()

  const expenses = allExpenses.filter(e => {
    const expDate = parseISO(e.date)
    return isWithinInterval(expDate, { start: weekStart, end: weekEnd })
  })

  const byCategory = {} as Record<Category, number>
  expenses.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount
  })

  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const dailyBreakdown = days.map(d => getDailySummary(format(d, 'yyyy-MM-dd'), allExpenses))

  return {
    weekStart: format(weekStart, 'yyyy-MM-dd'),
    weekEnd: format(weekEnd, 'yyyy-MM-dd'),
    total: expenses.reduce((sum, e) => sum + e.amount, 0),
    byCategory,
    dailyBreakdown
  }
}

export function getMonthlySummary(date: Date = new Date(), expensesArr?: Expense[]): MonthlySummary {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const allExpenses = expensesArr || getExpenses()

  const expenses = allExpenses.filter(e => {
    const expDate = parseISO(e.date)
    return isWithinInterval(expDate, { start: monthStart, end: monthEnd })
  })

  const byCategory = {} as Record<Category, number>
  expenses.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount
  })

  // Weekly breakdown for the month
  const weeks: WeeklySummary[] = []
  let current = monthStart
  while (current <= monthEnd) {
    weeks.push(getWeeklySummary(current, allExpenses))
    current = new Date(endOfWeek(current).getTime() + 86400000)
  }

  return {
    month: format(date, 'yyyy-MM'),
    total: expenses.reduce((sum, e) => sum + e.amount, 0),
    byCategory,
    weeklyBreakdown: weeks
  }
}

// ==================== Settings Operations ====================

export function getSettings(): AppSettings {
  if (typeof window === 'undefined') {
    return { language: 'en', currency: 'SGD', aiModel: 'glm-5', theme: 'dark' }
  }
  const data = localStorage.getItem(userKey(FIELD.SETTINGS))
  if (!data) return { language: 'en', currency: 'SGD', aiModel: 'glm-5', theme: 'dark' }
  const parsed = JSON.parse(data)
  // Force-fix any legacy MMK currency
  if (parsed.currency === 'MMK') parsed.currency = 'SGD'
  if (parsed.aiModel === 'glm-5-turbo') {
    parsed.aiModel = 'glm-5'
  }
  if (!parsed.aiModel || !['glm-4.7', 'glm-5'].includes(parsed.aiModel)) {
    parsed.aiModel = 'glm-5'
  }
  if (!parsed.theme || !['dark', 'light', 'blossom', 'glowing-horizon'].includes(parsed.theme)) {
    parsed.theme = 'dark'
  }
  delete parsed.apiKey
  delete parsed.aiProvider
  return parsed
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const updated = { ...current, ...settings }
  localStorage.setItem(userKey(FIELD.SETTINGS), JSON.stringify(updated))
  return updated
}

// ==================== Data Operations ====================

export type ChatHistoryMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string | Date
}

function isChatHistoryMessage(value: unknown): value is ChatHistoryMessage {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Partial<ChatHistoryMessage>
  return (
    typeof item.id === 'string' &&
    (item.role === 'user' || item.role === 'assistant') &&
    typeof item.content === 'string' &&
    (typeof item.timestamp === 'string' || item.timestamp instanceof Date)
  )
}

export function getChatHistory(): ChatHistoryMessage[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(userKey('chat_history'))
  if (!data) return []

  try {
    const parsed = JSON.parse(data)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isChatHistoryMessage)
  } catch {
    return []
  }
}

export function saveChatHistory(messages: ChatHistoryMessage[]): void {
  localStorage.setItem(userKey('chat_history'), JSON.stringify(messages))
}

export function clearAllData(): void {
  localStorage.removeItem(userKey(FIELD.EXPENSES))
  localStorage.removeItem(userKey(FIELD.TRIPS))
  localStorage.removeItem(userKey(FIELD.SUBSCRIPTIONS))
  localStorage.removeItem(userKey(FIELD.SETTINGS))
  localStorage.removeItem(userKey(FIELD.CUSTOM_CATEGORIES))
  localStorage.removeItem(userKey('chat_history'))
}

