'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import {
  Expense,
  Income,
  IncomeCategory,
  Trip,
  TripMutationInput,
  Subscription,
  UserProfile,
  AppSettings,
  DailySummary,
  WeeklySummary,
  MonthlySummary,
  Category,
  CustomCategory
} from '@/types'
import {
  getSettings,
  saveSettings,
  getDailySummary,
  getWeeklySummary,
  getMonthlySummary,
  ensureProfileForUser,
  getProfiles,
  addProfile as storageAddProfile,
  deleteProfile as storageDeleteProfile,
  setActiveUserId,
  getActiveProfile,
  getCustomCategories,
  saveCustomCategories,
  getChatHistory,
  saveChatHistory,
} from '@/lib/storage'
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { setLanguage as setI18nLanguage } from '@/i18n/config'
import { useAuth } from '@/contexts/AuthContext'
import { mergeExpensesWithSubscriptionOccurrences } from '@/lib/subscription-expenses'
import { applyPersonalExpenseShares } from '@/lib/expense-sharing'
import { DEFAULT_APP_SETTINGS, hasCustomAppSettings, normalizeAppSettings } from '@/lib/settings'
import { fetchUserPreferences, updateUserPreferences, type UserPreferencesResponse } from '@/lib/preferences-client'

function normalizeExpenseDate(rawDate: string): string {
  const datePartMatch = rawDate.match(/^(\d{4}-\d{2}-\d{2})/)
  if (datePartMatch?.[1]) return datePartMatch[1]

  const parsed = new Date(rawDate)
  if (!Number.isNaN(parsed.getTime())) {
    return format(parsed, 'yyyy-MM-dd')
  }

  return rawDate
}

type TransactionApiRecord = {
  id: string
  amount: number
  category: string
  description?: string
  date: string
  created: string
  updated?: string
  tripId?: string
  sharedGroupExpense?: boolean
  type?: 'income' | 'expense' | string
}

type TripApiRecord = {
  id: string
  name: string
  startDate: string
  endDate: string
  budget?: number | null
  destinations?: string | null
  groupName?: string | null
  groupSize?: number | null
  groupFund?: number | null
  created: string
}

type SubscriptionApiRecord = {
  id: string
  name: string
  amount: number
  category: string
  billingCycle?: string
  frequency?: string
  startDate?: string
  nextDueDate?: string
  isActive?: boolean
  created: string
  updated?: string
}

function mapExpenseRecord(item: TransactionApiRecord): Expense {
  const tripId = typeof item.tripId === 'string' && item.tripId.trim().length > 0
    ? item.tripId
    : undefined

  return {
    id: item.id,
    amount: item.amount,
    category: item.category as Category,
    description: item.description || '',
    date: normalizeExpenseDate(item.date),
    createdAt: item.created,
    updatedAt: item.updated,
    tripId,
    sharedGroupExpense: item.sharedGroupExpense === true,
  }
}

function mapIncomeRecord(item: TransactionApiRecord): Income {
  return {
    id: item.id,
    amount: item.amount,
    category: (item.category || 'other') as IncomeCategory,
    description: item.description || '',
    date: normalizeExpenseDate(item.date),
    createdAt: item.created,
    updatedAt: item.updated,
  }
}

function mapTripRecord(item: TripApiRecord): Trip {
  return {
    id: item.id,
    name: item.name,
    startDate: item.startDate,
    endDate: item.endDate,
    budget: typeof item.budget === 'number' ? item.budget : undefined,
    destinations: item.destinations || undefined,
    groupName: item.groupName || undefined,
    groupSize: typeof item.groupSize === 'number' ? item.groupSize : undefined,
    groupFund: typeof item.groupFund === 'number' ? item.groupFund : undefined,
    createdAt: item.created,
  }
}

function mapSubscriptionRecord(item: SubscriptionApiRecord): Subscription {
  return {
    id: item.id,
    name: item.name,
    amount: item.amount,
    category: item.category as Category,
    billingCycle: (item.billingCycle ?? item.frequency ?? 'monthly') as Subscription['billingCycle'],
    startDate: item.startDate ?? item.nextDueDate ?? format(new Date(), 'yyyy-MM-dd'),
    isActive: item.isActive ?? true,
    createdAt: item.created,
    updatedAt: item.updated,
  }
}

async function getResponseError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json()
    if (payload && typeof payload.error === 'string' && payload.error.length > 0) {
      return payload.error
    }
  } catch {
    // ignore parse errors
  }
  return fallback
}

interface AppContextType {
  // Expenses
  expenses: Expense[]
  personalExpenses: Expense[]
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<Expense>
  updateExpense: (id: string, updates: Partial<Omit<Expense, 'id' | 'createdAt'>>) => Promise<Expense | null>
  deleteExpense: (id: string) => Promise<boolean>
  refreshExpenses: () => Promise<void>

  // Income
  incomes: Income[]
  addIncome: (income: Omit<Income, 'id' | 'createdAt'>) => Promise<Income>
  updateIncome: (id: string, updates: Partial<Omit<Income, 'id' | 'createdAt'>>) => Promise<Income | null>
  deleteIncome: (id: string) => Promise<boolean>
  refreshIncomes: () => Promise<void>

  // Trips
  trips: Trip[]
  addTrip: (trip: TripMutationInput) => Promise<Trip>
  updateTrip: (id: string, updates: TripMutationInput) => Promise<Trip | null>
  deleteTrip: (id: string) => Promise<boolean>
  refreshTrips: () => Promise<void>

  // Subscriptions
  subscriptions: Subscription[]
  addSubscription: (sub: Omit<Subscription, 'id' | 'createdAt'>) => Promise<Subscription>
  updateSubscription: (id: string, updates: Partial<Omit<Subscription, 'id' | 'createdAt'>>) => Promise<Subscription | null>
  deleteSubscription: (id: string) => Promise<boolean>
  refreshSubscriptions: () => Promise<void>

  // User Profiles (local multi-user support)
  profiles: UserProfile[]
  activeProfile: UserProfile | null
  switchUser: (userId: string) => void
  addProfile: (name: string, avatar?: string) => UserProfile
  removeProfile: (id: string) => boolean

  // Summaries
  todaySummary: DailySummary
  weeklySummary: WeeklySummary
  monthlySummary: MonthlySummary

  // Settings
  settings: AppSettings
  updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>
  setLanguage: (lang: 'en' | 'my') => Promise<void>

  // Custom Categories
  customCategories: CustomCategory[]
  addCustomCategory: (category: Omit<CustomCategory, 'id'>) => CustomCategory
  deleteCustomCategory: (id: string) => boolean
  persistChatHistory: (messages: ReturnType<typeof getChatHistory>) => Promise<void>

  // Loading
  isLoading: boolean

  // Current user info from PocketBase
  currentUser: {
    id: string
    email: string
    name?: string
  } | null
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [incomes, setIncomes] = useState<Income[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS)
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const preferencesWriteQueueRef = useRef<Promise<void>>(Promise.resolve())

  // Current PocketBase user
  const currentUser = user ? {
    id: user.id,
    email: user.email,
    name: user.name,
  } : null

  const applyPreferenceSnapshot = useCallback((nextSettings: AppSettings, nextCustomCategories: CustomCategory[], nextChatHistory?: ReturnType<typeof getChatHistory>) => {
    const normalizedSettings = normalizeAppSettings(nextSettings)
    const storedSettings = saveSettings(normalizedSettings)
    saveCustomCategories(nextCustomCategories)
    setI18nLanguage(storedSettings.language)
    setSettings(storedSettings)
    setCustomCategories(nextCustomCategories)

    if (nextChatHistory) {
      saveChatHistory(nextChatHistory)
    }
  }, [])

  const refreshPreferences = useCallback(async () => {
    const cachedSettings = getSettings()
    const cachedCategories = getCustomCategories()
    setI18nLanguage(cachedSettings.language)
    setSettings(cachedSettings)
    setCustomCategories(cachedCategories)

    if (!isAuthenticated || !user) {
      return
    }

    try {
      const remotePreferences = await fetchUserPreferences()
      const legacyHistory = getChatHistory()
      const shouldMigrateLegacyState =
        !remotePreferences.exists &&
        (
          hasCustomAppSettings(cachedSettings) ||
          cachedCategories.length > 0 ||
          legacyHistory.length > 0
        )

      if (shouldMigrateLegacyState) {
        const migratedPreferences = await updateUserPreferences({
          settings: cachedSettings,
          customCategories: cachedCategories,
          chatHistory: legacyHistory,
        })

        applyPreferenceSnapshot(
          migratedPreferences.settings,
          migratedPreferences.customCategories,
          migratedPreferences.chatHistory
        )
        return
      }

      applyPreferenceSnapshot(
        remotePreferences.settings,
        remotePreferences.customCategories,
        remotePreferences.chatHistory
      )
    } catch (error) {
      console.error('Failed to load user preferences:', error)
    }
  }, [applyPreferenceSnapshot, isAuthenticated, user])

  const persistPreferences = useCallback(async (patch: {
    settings?: Partial<AppSettings>
    customCategories?: CustomCategory[]
    chatHistory?: ReturnType<typeof getChatHistory>
  }): Promise<UserPreferencesResponse | null> => {
    if (!isAuthenticated || !user) {
      return null
    }

    const task = preferencesWriteQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const updatedPreferences = await updateUserPreferences(patch)
        applyPreferenceSnapshot(
          updatedPreferences.settings,
          updatedPreferences.customCategories,
          updatedPreferences.chatHistory
        )
        return updatedPreferences
      })

    preferencesWriteQueueRef.current = task
      .then(() => undefined)
      .catch(() => undefined)

    try {
      return await task
    } catch (error) {
      console.error('Failed to persist user preferences:', error)
      throw error
    }
  }, [applyPreferenceSnapshot, isAuthenticated, user])

  // Load expenses from PocketBase
  const refreshExpenses = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setExpenses([])
      return
    }

    try {
      const res = await fetch('/api/transactions')
      if (res.ok) {
        const data = await res.json()
        const mappedExpenses: Expense[] = (data.items || [])
          .filter((item: TransactionApiRecord) => item.type !== 'income')
          .map(mapExpenseRecord)
        setExpenses(mappedExpenses)
      } else {
        setExpenses([])
      }
    } catch (error) {
      console.error('Failed to fetch expenses:', error)
      setExpenses([])
    }
  }, [isAuthenticated, user])

  // Load incomes from PocketBase
  const refreshIncomes = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setIncomes([])
      return
    }

    try {
      const res = await fetch('/api/incomes')
      if (res.ok) {
        const data = await res.json()
        const mappedIncomes: Income[] = (data.items || []).map(mapIncomeRecord)
        setIncomes(mappedIncomes)
      } else {
        setIncomes([])
      }
    } catch (error) {
      console.error('Failed to fetch incomes:', error)
      setIncomes([])
    }
  }, [isAuthenticated, user])

  // Load trips from PocketBase
  const refreshTrips = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setTrips([])
      return
    }

    try {
      const res = await fetch('/api/trips')
      if (res.ok) {
        const data = await res.json()
        const mappedTrips: Trip[] = (data.items || []).map(mapTripRecord)
        setTrips(mappedTrips)
      } else {
        setTrips([])
      }
    } catch (error) {
      console.error('Failed to fetch trips:', error)
      setTrips([])
    }
  }, [isAuthenticated, user])

  // Load subscriptions from PocketBase
  const refreshSubscriptions = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setSubscriptions([])
      return
    }

    try {
      const res = await fetch('/api/subscriptions')
      if (res.ok) {
        const data = await res.json()
        const mappedSubscriptions: Subscription[] = (data.items || []).map(mapSubscriptionRecord)
        setSubscriptions(mappedSubscriptions)
      } else {
        setSubscriptions([])
      }
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error)
      setSubscriptions([])
    }
  }, [isAuthenticated, user])

  // Load all user data
  const loadUserData = useCallback(async () => {
    const cachedSettings = getSettings()
    setI18nLanguage(cachedSettings.language)
    setSettings(cachedSettings)
    setCustomCategories(getCustomCategories())

    await Promise.all([
      refreshExpenses(),
      refreshIncomes(),
      refreshTrips(),
      refreshSubscriptions(),
      refreshPreferences(),
    ])

    setActiveProfile(getActiveProfile())
  }, [refreshExpenses, refreshIncomes, refreshTrips, refreshSubscriptions, refreshPreferences])

  useEffect(() => {
    const loadData = async () => {
      if (!isAuthenticated || !user) {
        setExpenses([])
        setIncomes([])
        setTrips([])
        setSubscriptions([])
        setProfiles([])
        setActiveProfile(null)
        setSettings(DEFAULT_APP_SETTINGS)
        setCustomCategories([])
        setI18nLanguage(DEFAULT_APP_SETTINGS.language)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      const profile = ensureProfileForUser({
        id: user.id,
        name: user.name,
        email: user.email,
      })
      setProfiles(getProfiles())
      setActiveProfile(profile)
      await loadUserData()
      setIsLoading(false)
    }

    queueMicrotask(loadData)
  }, [isAuthenticated, user, loadUserData])

  // Switch active user (local profiles)
  const switchUser = useCallback((userId: string) => {
    if (!user || userId !== user.id) return
    setActiveUserId(userId)
    loadUserData()
    setProfiles(getProfiles())
  }, [user, loadUserData])

  const addProfile = useCallback((name: string, avatar?: string) => {
    if (user) {
      const profile = ensureProfileForUser({
        id: user.id,
        name: user.name || name,
        email: user.email,
        avatar,
      })
      setProfiles(getProfiles())
      setActiveProfile(profile)
      return profile
    }

    const profile = storageAddProfile(name, avatar)
    setProfiles(getProfiles())
    return profile
  }, [user])

  const removeProfile = useCallback((id: string) => {
    if (user && id === user.id) {
      return false
    }

    const result = storageDeleteProfile(id)
    if (result) {
      setProfiles(getProfiles())
      loadUserData()
    }
    return result
  }, [user, loadUserData])

  // Expense operations - PocketBase only (requires authentication)
  const addExpense = useCallback(async (expense: Omit<Expense, 'id' | 'createdAt'>) => {
    if (!isAuthenticated) {
      throw new Error('Must be logged in to add expenses')
    }

    const normalizedTripId =
      typeof expense.tripId === 'string' && expense.tripId.trim().length > 0
        ? expense.tripId.trim()
        : ''

    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'expense',
        category: expense.category,
        amount: expense.amount,
        description: expense.description,
        date: expense.date,
        tripId: normalizedTripId,
        sharedGroupExpense: normalizedTripId ? expense.sharedGroupExpense === true : false,
      }),
    })

    if (!res.ok) {
      throw new Error(await getResponseError(res, 'Failed to save expense'))
    }

    const data = (await res.json()) as TransactionApiRecord
    const newExpense = mapExpenseRecord(data)

    setExpenses(prev => [newExpense, ...prev])
    return newExpense
  }, [isAuthenticated])

  const updateExpense = useCallback(async (id: string, updates: Partial<Omit<Expense, 'id' | 'createdAt'>>) => {
    if (!isAuthenticated) {
      throw new Error('Must be logged in to update expenses')
    }

    const normalizedTripId =
      typeof updates.tripId === 'string'
        ? updates.tripId.trim()
        : updates.tripId === undefined
          ? undefined
          : ''

    const payload = {
      ...updates,
      ...(normalizedTripId !== undefined ? { tripId: normalizedTripId } : {}),
      ...(normalizedTripId !== undefined
        ? { sharedGroupExpense: normalizedTripId ? updates.sharedGroupExpense === true : false }
        : {}),
    }

    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      throw new Error(await getResponseError(res, 'Failed to update expense'))
    }

    const data = (await res.json()) as TransactionApiRecord
    const updatedExpense = mapExpenseRecord(data)

    setExpenses(prev => prev.map(e => e.id === id ? updatedExpense : e))
    return updatedExpense
  }, [isAuthenticated])

  const deleteExpense = useCallback(async (id: string) => {
    if (!isAuthenticated) {
      throw new Error('Must be logged in to delete expenses')
    }

    const res = await fetch(`/api/transactions/${id}`, {
      method: 'DELETE',
    })

    if (!res.ok) {
      throw new Error(await getResponseError(res, 'Failed to delete expense'))
    }

    setExpenses(prev => prev.filter(e => e.id !== id))
    return true
  }, [isAuthenticated])

  // Income operations - PocketBase only (requires authentication)
  const addIncome = useCallback(async (income: Omit<Income, 'id' | 'createdAt'>) => {
    if (!isAuthenticated) {
      throw new Error('Must be logged in to add income')
    }

    const res = await fetch('/api/incomes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: income.category,
        amount: income.amount,
        description: income.description,
        date: income.date,
      }),
    })

    if (!res.ok) {
      throw new Error(await getResponseError(res, 'Failed to save income'))
    }

    const data = (await res.json()) as TransactionApiRecord
    const newIncome = mapIncomeRecord(data)

    setIncomes(prev => [newIncome, ...prev])
    return newIncome
  }, [isAuthenticated])

  const updateIncome = useCallback(async (id: string, updates: Partial<Omit<Income, 'id' | 'createdAt'>>) => {
    if (!isAuthenticated) {
      throw new Error('Must be logged in to update income')
    }

    const res = await fetch(`/api/incomes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })

    if (res.status === 404) {
      return null
    }

    if (!res.ok) {
      throw new Error(await getResponseError(res, 'Failed to update income'))
    }

    const data = (await res.json()) as TransactionApiRecord
    const updatedIncome = mapIncomeRecord(data)

    setIncomes(prev => prev.map(item => item.id === id ? updatedIncome : item))
    return updatedIncome
  }, [isAuthenticated])

  const deleteIncome = useCallback(async (id: string) => {
    if (!isAuthenticated) {
      throw new Error('Must be logged in to delete income')
    }

    const res = await fetch(`/api/incomes/${id}`, {
      method: 'DELETE',
    })

    if (res.status === 404) {
      return false
    }

    if (!res.ok) {
      throw new Error(await getResponseError(res, 'Failed to delete income'))
    }

    setIncomes(prev => prev.filter(item => item.id !== id))
    return true
  }, [isAuthenticated])

  // Trip operations - PocketBase only (requires authentication)
  const addTrip = useCallback(async (trip: TripMutationInput) => {
    if (!isAuthenticated) {
      throw new Error('Must be logged in to add trips')
    }

    const res = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trip),
    })

    if (!res.ok) {
      throw new Error(await getResponseError(res, 'Failed to save trip'))
    }

    const data = (await res.json()) as TripApiRecord
    const newTrip = mapTripRecord(data)
    setTrips(prev => [newTrip, ...prev])
    return newTrip
  }, [isAuthenticated])

  const updateTrip = useCallback(async (id: string, updates: TripMutationInput) => {
    if (!isAuthenticated) {
      throw new Error('Must be logged in to update trips')
    }

    const res = await fetch(`/api/trips/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })

    if (res.status === 404) {
      return null
    }

    if (!res.ok) {
      throw new Error(await getResponseError(res, 'Failed to update trip'))
    }

    const data = (await res.json()) as TripApiRecord
    const updatedTrip = mapTripRecord(data)
    setTrips(prev => prev.map(trip => trip.id === id ? updatedTrip : trip))
    return updatedTrip
  }, [isAuthenticated])

  const deleteTrip = useCallback(async (id: string) => {
    if (!isAuthenticated) {
      throw new Error('Must be logged in to delete trips')
    }

    const res = await fetch(`/api/trips/${id}`, {
      method: 'DELETE',
    })

    if (res.status === 404) {
      return false
    }

    if (!res.ok) {
      throw new Error(await getResponseError(res, 'Failed to delete trip'))
    }

    setTrips(prev => prev.filter(trip => trip.id !== id))
    await refreshExpenses()
    return true
  }, [isAuthenticated, refreshExpenses])

  // Subscription operations - PocketBase only (requires authentication)
  const addSubscription = useCallback(async (sub: Omit<Subscription, 'id' | 'createdAt'>) => {
    if (!isAuthenticated) {
      throw new Error('Must be logged in to add subscriptions')
    }

    const res = await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    })

    if (!res.ok) {
      throw new Error(await getResponseError(res, 'Failed to save subscription'))
    }

    const data = (await res.json()) as SubscriptionApiRecord
    const newSubscription = mapSubscriptionRecord(data)
    setSubscriptions(prev => [newSubscription, ...prev])
    return newSubscription
  }, [isAuthenticated])

  const updateSubscription = useCallback(async (id: string, updates: Partial<Omit<Subscription, 'id' | 'createdAt'>>) => {
    if (!isAuthenticated) {
      throw new Error('Must be logged in to update subscriptions')
    }

    const res = await fetch(`/api/subscriptions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })

    if (res.status === 404) {
      return null
    }

    if (!res.ok) {
      throw new Error(await getResponseError(res, 'Failed to update subscription'))
    }

    const data = (await res.json()) as SubscriptionApiRecord
    const updatedSubscription = mapSubscriptionRecord(data)
    setSubscriptions(prev => prev.map(sub => sub.id === id ? updatedSubscription : sub))
    return updatedSubscription
  }, [isAuthenticated])

  const deleteSubscription = useCallback(async (id: string) => {
    if (!isAuthenticated) {
      throw new Error('Must be logged in to delete subscriptions')
    }

    const res = await fetch(`/api/subscriptions/${id}`, {
      method: 'DELETE',
    })

    if (res.status === 404) {
      return false
    }

    if (!res.ok) {
      throw new Error(await getResponseError(res, 'Failed to delete subscription'))
    }

    setSubscriptions(prev => prev.filter(sub => sub.id !== id))
    return true
  }, [isAuthenticated])

  const personalExpenses = React.useMemo(
    () => applyPersonalExpenseShares(expenses, trips),
    [expenses, trips]
  )

  // Summaries (include recurring subscriptions as part of spend)
  const todaySummary = React.useMemo(() => {
    const now = new Date()
    const dateKey = format(now, 'yyyy-MM-dd')
    const withSubs = mergeExpensesWithSubscriptionOccurrences(personalExpenses, subscriptions, now, now)
    return getDailySummary(dateKey, withSubs)
  }, [personalExpenses, subscriptions])

  const weeklySummary = React.useMemo(() => {
    const now = new Date()
    const weekStart = startOfWeek(now)
    const weekEnd = endOfWeek(now)
    const withSubs = mergeExpensesWithSubscriptionOccurrences(personalExpenses, subscriptions, weekStart, weekEnd)
    return getWeeklySummary(now, withSubs)
  }, [personalExpenses, subscriptions])

  const monthlySummary = React.useMemo(() => {
    const now = new Date()
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)
    const withSubs = mergeExpensesWithSubscriptionOccurrences(personalExpenses, subscriptions, monthStart, monthEnd)
    return getMonthlySummary(now, withSubs)
  }, [personalExpenses, subscriptions])

  // Settings
  const updateSettings = useCallback(async (newSettings: Partial<AppSettings>) => {
    const settingKeys = Object.keys(newSettings) as (keyof AppSettings)[]
    if (settingKeys.length === 0) {
      return settings
    }

    if (!isAuthenticated || !user) {
      const updated = saveSettings(newSettings)
      setSettings(updated)
      setI18nLanguage(updated.language)
      return updated
    }

    const persistedPreferences = await persistPreferences({ settings: newSettings })
    if (!persistedPreferences) {
      throw new Error('Failed to persist user preferences')
    }

    const expectedSettings = normalizeAppSettings({ ...settings, ...newSettings })
    const didPersistRequestedKeys = settingKeys.every(
      (key) => persistedPreferences.settings[key] === expectedSettings[key]
    )

    if (!didPersistRequestedKeys) {
      throw new Error('Settings update did not persist on the server. Apply the latest backend migrations and try again.')
    }

    return persistedPreferences.settings
  }, [isAuthenticated, persistPreferences, settings, user])

  const setLanguage = useCallback(async (lang: 'en' | 'my') => {
    await updateSettings({ language: lang })
  }, [updateSettings])

  // Custom Categories
  const addCustomCategory = useCallback((category: Omit<CustomCategory, 'id'>) => {
    const name = category.name.trim()
    if (!name) {
      throw new Error('Category name is required')
    }

    const existingCategories = getCustomCategories()
    const normalizedName = name.toLowerCase()
    const existing = existingCategories.find(
      (item) => item.type === category.type && item.name.trim().toLowerCase() === normalizedName
    )

    if (existing) {
      setCustomCategories(existingCategories)
      return existing
    }

    const newCategory: CustomCategory = {
      ...category,
      name,
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    }
    const updated = [...existingCategories, newCategory]
    saveCustomCategories(updated)
    setCustomCategories(updated)
    void persistPreferences({ customCategories: updated })
    return newCategory
  }, [persistPreferences])

  const deleteCustomCategory = useCallback((id: string) => {
    const current = getCustomCategories()
    const updated = current.filter(c => c.id !== id)
    if (current.length === updated.length) return false
    
    saveCustomCategories(updated)
    setCustomCategories(updated)
    void persistPreferences({ customCategories: updated })
    return true
  }, [persistPreferences])

  const persistChatHistory = useCallback(async (messages: ReturnType<typeof getChatHistory>) => {
    saveChatHistory(messages)
    await persistPreferences({ chatHistory: messages })
  }, [persistPreferences])

  // Sync Theme to DOM
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      root.classList.remove('dark', 'theme-blossom', 'theme-glowing-horizon')
      if (settings.theme === 'dark') {
        root.classList.add('dark')
      } else if (settings.theme === 'blossom') {
        root.classList.add('theme-blossom')
      } else if (settings.theme === 'glowing-horizon') {
        root.classList.add('theme-glowing-horizon')
      }
    }
  }, [settings.theme])

  return (
    <AppContext.Provider
      value={{
        expenses,
        personalExpenses,
        addExpense,
        updateExpense,
        deleteExpense,
        refreshExpenses,
        incomes,
        addIncome,
        updateIncome,
        deleteIncome,
        refreshIncomes,
        trips,
        addTrip,
        updateTrip,
        deleteTrip,
        refreshTrips,
        subscriptions,
        addSubscription,
        updateSubscription,
        deleteSubscription,
        refreshSubscriptions,
        profiles,
        activeProfile,
        switchUser,
        addProfile,
        removeProfile,
        todaySummary,
        weeklySummary,
        monthlySummary,
        settings,
        updateSettings,
        setLanguage,
        customCategories,
        addCustomCategory,
        deleteCustomCategory,
        persistChatHistory,
        isLoading,
        currentUser,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}
