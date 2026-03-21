import { Expense, Trip, Subscription, AppSettings, UserProfile, Category, DailySummary, WeeklySummary, MonthlySummary, ExpenseFilter } from '@/types'
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
  AUTH: 'auth',
}

// ==================== Profile Management ====================

export function getProfiles(): UserProfile[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(GLOBAL_KEYS.PROFILES)
  return data ? JSON.parse(data) : []
}

export function saveProfiles(profiles: UserProfile[]): void {
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

export function getActiveUserId(): string {
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

// Initialize profiles + migrate old data on first load
export function initializeProfiles(): UserProfile {
  let profiles = getProfiles()

  if (profiles.length === 0) {
    // First run — check for legacy data to migrate
    const legacyExpenses = localStorage.getItem('wallet_app_expenses')
    const legacyTrips = localStorage.getItem('wallet_app_trips')
    const legacySubscriptions = localStorage.getItem('wallet_app_subscriptions')
    const legacySettings = localStorage.getItem('wallet_app_settings')

    const defaultProfile: UserProfile = {
      id: 'default',
      name: 'Default',
      avatar: '👤',
      createdAt: new Date().toISOString(),
    }
    profiles = [defaultProfile]
    saveProfiles(profiles)
    setActiveUserId('default')

    // Migrate legacy data to the default user namespace
    if (legacyExpenses) {
      localStorage.setItem(userKey(FIELD.EXPENSES), legacyExpenses)
      localStorage.removeItem('wallet_app_expenses')
    }
    if (legacyTrips) {
      localStorage.setItem(userKey(FIELD.TRIPS), legacyTrips)
      localStorage.removeItem('wallet_app_trips')
    }
    if (legacySubscriptions) {
      localStorage.setItem(userKey(FIELD.SUBSCRIPTIONS), legacySubscriptions)
      localStorage.removeItem('wallet_app_subscriptions')
    }
    if (legacySettings) {
      // Also fix currency during migration
      try {
        const parsed = JSON.parse(legacySettings)
        parsed.currency = 'SGD' // Force fix MMK -> SGD during migration
        localStorage.setItem(userKey(FIELD.SETTINGS), JSON.stringify(parsed))
      } catch {
        localStorage.setItem(userKey(FIELD.SETTINGS), legacySettings)
      }
      localStorage.removeItem('wallet_app_settings')
    }

    return defaultProfile
  }

  // Ensure there's an active user
  const activeId = getActiveUserId()
  if (!profiles.find(p => p.id === activeId)) {
    setActiveUserId(profiles[0].id)
  }

  return profiles.find(p => p.id === getActiveUserId()) || profiles[0]
}

// Simple hash function for password
export function hashPassword(password: string): string {
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(16)
}

// ==================== Expense Operations ====================

export function getExpenses(): Expense[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(userKey(FIELD.EXPENSES))
  return data ? JSON.parse(data) : []
}

export function saveExpenses(expenses: Expense[]): void {
  localStorage.setItem(userKey(FIELD.EXPENSES), JSON.stringify(expenses))
}

export function addExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Expense {
  const expenses = getExpenses()
  const newExpense: Expense = {
    ...expense,
    id: uuidv4(),
    createdAt: new Date().toISOString()
  }
  expenses.push(newExpense)
  saveExpenses(expenses)
  return newExpense
}

export function updateExpense(id: string, updates: Partial<Omit<Expense, 'id' | 'createdAt'>>): Expense | null {
  const expenses = getExpenses()
  const index = expenses.findIndex(e => e.id === id)
  if (index === -1) return null

  expenses[index] = {
    ...expenses[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }
  saveExpenses(expenses)
  return expenses[index]
}

export function deleteExpense(id: string): boolean {
  const expenses = getExpenses()
  const filtered = expenses.filter(e => e.id !== id)
  if (filtered.length === expenses.length) return false
  saveExpenses(filtered)
  return true
}

export function getExpenseById(id: string): Expense | null {
  const expenses = getExpenses()
  return expenses.find(e => e.id === id) || null
}

// ==================== Trip Operations ====================

export function getTrips(): Trip[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(userKey(FIELD.TRIPS))
  return data ? JSON.parse(data) : []
}

export function saveTrips(trips: Trip[]): void {
  localStorage.setItem(userKey(FIELD.TRIPS), JSON.stringify(trips))
}

export function addTrip(trip: Omit<Trip, 'id' | 'createdAt'>): Trip {
  const trips = getTrips()
  const newTrip: Trip = {
    ...trip,
    id: uuidv4(),
    createdAt: new Date().toISOString()
  }
  trips.push(newTrip)
  saveTrips(trips)
  return newTrip
}

export function updateTrip(id: string, updates: Partial<Omit<Trip, 'id' | 'createdAt'>>): Trip | null {
  const trips = getTrips()
  const index = trips.findIndex(t => t.id === id)
  if (index === -1) return null

  trips[index] = {
    ...trips[index],
    ...updates
  }
  saveTrips(trips)
  return trips[index]
}

export function deleteTrip(id: string): boolean {
  const trips = getTrips()
  const filtered = trips.filter(t => t.id !== id)
  if (filtered.length === trips.length) return false
  saveTrips(filtered)
  
  // Optional: Remove tripId from all expenses associated with this trip
  const expenses = getExpenses()
  let expensesUpdated = false
  const updatedExpenses = expenses.map(e => {
    if (e.tripId === id) {
      expensesUpdated = true
      const { tripId, ...rest } = e
      return rest
    }
    return e
  })
  if (expensesUpdated) saveExpenses(updatedExpenses as Expense[])

  return true
}

export function getTripById(id: string): Trip | null {
  const trips = getTrips()
  return trips.find(t => t.id === id) || null
}

// ==================== Subscription Operations ====================

export function getSubscriptions(): Subscription[] {
  if (typeof window === 'undefined') return []
  const data = localStorage.getItem(userKey(FIELD.SUBSCRIPTIONS))
  return data ? JSON.parse(data) : []
}

export function saveSubscriptions(subscriptions: Subscription[]): void {
  localStorage.setItem(userKey(FIELD.SUBSCRIPTIONS), JSON.stringify(subscriptions))
}

export function addSubscription(sub: Omit<Subscription, 'id' | 'createdAt'>): Subscription {
  const subs = getSubscriptions()
  const newSub: Subscription = {
    ...sub,
    id: uuidv4(),
    createdAt: new Date().toISOString()
  }
  subs.push(newSub)
  saveSubscriptions(subs)
  return newSub
}

export function updateSubscription(id: string, updates: Partial<Omit<Subscription, 'id' | 'createdAt'>>): Subscription | null {
  const subs = getSubscriptions()
  const index = subs.findIndex(s => s.id === id)
  if (index === -1) return null

  subs[index] = {
    ...subs[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }
  saveSubscriptions(subs)
  return subs[index]
}

export function deleteSubscription(id: string): boolean {
  const subs = getSubscriptions()
  const filtered = subs.filter(s => s.id !== id)
  if (filtered.length === subs.length) return false
  saveSubscriptions(filtered)
  return true
}

export function filterExpenses(filters: ExpenseFilter): Expense[] {
  let expenses = getExpenses()

  if (filters.startDate) {
    expenses = expenses.filter(e => e.date >= filters.startDate!)
  }
  if (filters.endDate) {
    expenses = expenses.filter(e => e.date <= filters.endDate!)
  }
  if (filters.category) {
    expenses = expenses.filter(e => e.category === filters.category)
  }
  if (filters.minAmount !== undefined) {
    expenses = expenses.filter(e => e.amount >= filters.minAmount!)
  }
  if (filters.maxAmount !== undefined) {
    expenses = expenses.filter(e => e.amount <= filters.maxAmount!)
  }
  if (filters.search) {
    const search = filters.search.toLowerCase()
    expenses = expenses.filter(e =>
      e.description.toLowerCase().includes(search) ||
      e.category.toLowerCase().includes(search)
    )
  }

  return expenses
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
    return { language: 'en', currency: 'SGD' }
  }
  const data = localStorage.getItem(userKey(FIELD.SETTINGS))
  if (!data) return { language: 'en', currency: 'SGD' }
  const parsed = JSON.parse(data)
  // Force-fix any legacy MMK currency
  if (parsed.currency === 'MMK') parsed.currency = 'SGD'
  return parsed
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const updated = { ...current, ...settings }
  localStorage.setItem(userKey(FIELD.SETTINGS), JSON.stringify(updated))
  return updated
}

export function setLanguage(language: 'en' | 'my'): void {
  saveSettings({ language })
}

export function setApiKey(apiKey: string): void {
  saveSettings({ apiKey })
}

export function getApiKey(): string | undefined {
  return getSettings().apiKey
}

// ==================== Auth Operations ====================

export function isPasswordProtected(): boolean {
  const settings = getSettings()
  return !!settings.passwordHash
}

export function setPassword(password: string): void {
  const hash = hashPassword(password)
  saveSettings({ passwordHash: hash })
}

export function removePassword(): void {
  const settings = getSettings()
  delete settings.passwordHash
  localStorage.setItem(userKey(FIELD.SETTINGS), JSON.stringify(settings))
}

export function verifyPassword(password: string): boolean {
  const settings = getSettings()
  if (!settings.passwordHash) return true
  return hashPassword(password) === settings.passwordHash
}

export function setAuthenticated(authenticated: boolean): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(userKey(FIELD.AUTH), authenticated ? 'true' : 'false')
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(userKey(FIELD.AUTH)) === 'true'
}

// ==================== Data Operations ====================

export function clearAllData(): void {
  localStorage.removeItem(userKey(FIELD.EXPENSES))
  localStorage.removeItem(userKey(FIELD.TRIPS))
  localStorage.removeItem(userKey(FIELD.SUBSCRIPTIONS))
  localStorage.removeItem(userKey(FIELD.SETTINGS))
  sessionStorage.removeItem(userKey(FIELD.AUTH))
}

export function exportAllData(): { expenses: Expense[]; settings: AppSettings } {
  return {
    expenses: getExpenses(),
    settings: getSettings()
  }
}

export function importData(data: { expenses?: Expense[]; settings?: AppSettings }): void {
  if (data.expenses) {
    saveExpenses(data.expenses)
  }
  if (data.settings) {
    localStorage.setItem(userKey(FIELD.SETTINGS), JSON.stringify(data.settings))
  }
}
