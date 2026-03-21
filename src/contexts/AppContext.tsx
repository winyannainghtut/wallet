'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { Expense, Trip, Subscription, UserProfile, AppSettings, DailySummary, WeeklySummary, MonthlySummary } from '@/types'
import {
  getExpenses,
  addExpense as storageAddExpense,
  updateExpense as storageUpdateExpense,
  deleteExpense as storageDeleteExpense,
  getSettings,
  saveSettings,
  getTrips,
  addTrip as storageAddTrip,
  updateTrip as storageUpdateTrip,
  deleteTrip as storageDeleteTrip,
  getSubscriptions,
  addSubscription as storageAddSubscription,
  updateSubscription as storageUpdateSubscription,
  deleteSubscription as storageDeleteSubscription,
  getDailySummary,
  getWeeklySummary,
  getMonthlySummary,
  isAuthenticated,
  setAuthenticated,
  verifyPassword,
  isPasswordProtected,
  initializeProfiles,
  getProfiles,
  addProfile as storageAddProfile,
  deleteProfile as storageDeleteProfile,
  setActiveUserId,
  getActiveProfile,
} from '@/lib/storage'
import { format } from 'date-fns'
import { setLanguage as setI18nLanguage } from '@/i18n/config'

interface AppContextType {
  // Expenses
  expenses: Expense[]
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Expense
  updateExpense: (id: string, updates: Partial<Omit<Expense, 'id' | 'createdAt'>>) => Expense | null
  deleteExpense: (id: string) => boolean
  refreshExpenses: () => void

  // Trips
  trips: Trip[]
  addTrip: (trip: Omit<Trip, 'id' | 'createdAt'>) => Trip
  updateTrip: (id: string, updates: Partial<Omit<Trip, 'id' | 'createdAt'>>) => Trip | null
  deleteTrip: (id: string) => boolean
  refreshTrips: () => void

  // Subscriptions
  subscriptions: Subscription[]
  addSubscription: (sub: Omit<Subscription, 'id' | 'createdAt'>) => Subscription
  updateSubscription: (id: string, updates: Partial<Omit<Subscription, 'id' | 'createdAt'>>) => Subscription | null
  deleteSubscription: (id: string) => boolean
  refreshSubscriptions: () => void

  // User Profiles
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
  updateSettings: (settings: Partial<AppSettings>) => void
  setLanguage: (lang: 'en' | 'my') => void

  // Auth
  isLocked: boolean
  unlock: (password: string) => boolean
  lock: () => void
  hasPassword: boolean

  // Loading
  isLoading: boolean
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null)
  const [settings, setSettings] = useState<AppSettings>({ language: 'en', currency: 'SGD' })
  const [hasPassword, setHasPassword] = useState(false)
  const [isLocked, setIsLocked] = useState(true)
  const [isLoading, setIsLoading] = useState(true)

  // Load all user-scoped data
  const loadUserData = useCallback(() => {
    const loadedSettings = getSettings()
    setI18nLanguage(loadedSettings.language)
    setSettings(loadedSettings)

    const passwordProtected = isPasswordProtected()
    setHasPassword(passwordProtected)
    setIsLocked(passwordProtected ? !isAuthenticated() : false)

    setExpenses(getExpenses())
    setTrips(getTrips())
    setSubscriptions(getSubscriptions())
    setActiveProfile(getActiveProfile())
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      // Initialize profiles (migrates legacy data on first run)
      initializeProfiles()
      setProfiles(getProfiles())
      loadUserData()
      setIsLoading(false)
    })
  }, [loadUserData])

  // Switch active user
  const switchUser = useCallback((userId: string) => {
    setActiveUserId(userId)
    loadUserData()
    setProfiles(getProfiles())
  }, [loadUserData])

  // Add new profile
  const addProfile = useCallback((name: string, avatar?: string) => {
    const profile = storageAddProfile(name, avatar)
    setProfiles(getProfiles())
    return profile
  }, [])

  // Remove profile
  const removeProfile = useCallback((id: string) => {
    const result = storageDeleteProfile(id)
    if (result) {
      setProfiles(getProfiles())
      loadUserData() // Reload in case active user changed
    }
    return result
  }, [loadUserData])

  // Refresh functions
  const refreshExpenses = useCallback(() => {
    setExpenses(getExpenses())
  }, [])

  const refreshTrips = useCallback(() => {
    setTrips(getTrips())
  }, [])

  const refreshSubscriptions = useCallback(() => {
    setSubscriptions(getSubscriptions())
  }, [])

  // Expense operations
  const addExpense = useCallback((expense: Omit<Expense, 'id' | 'createdAt'>) => {
    const newExpense = storageAddExpense(expense)
    refreshExpenses()
    return newExpense
  }, [refreshExpenses])

  const updateExpense = useCallback((id: string, updates: Partial<Omit<Expense, 'id' | 'createdAt'>>) => {
    const result = storageUpdateExpense(id, updates)
    if (result) refreshExpenses()
    return result
  }, [refreshExpenses])

  const deleteExpense = useCallback((id: string) => {
    const result = storageDeleteExpense(id)
    if (result) refreshExpenses()
    return result
  }, [refreshExpenses])

  // Trip operations
  const addTrip = useCallback((trip: Omit<Trip, 'id' | 'createdAt'>) => {
    const newTrip = storageAddTrip(trip)
    refreshTrips()
    return newTrip
  }, [refreshTrips])

  const updateTrip = useCallback((id: string, updates: Partial<Omit<Trip, 'id' | 'createdAt'>>) => {
    const result = storageUpdateTrip(id, updates)
    if (result) refreshTrips()
    return result
  }, [refreshTrips])

  const deleteTrip = useCallback((id: string) => {
    const result = storageDeleteTrip(id)
    if (result) {
      refreshTrips()
      refreshExpenses()
    }
    return result
  }, [refreshTrips, refreshExpenses])

  // Subscription operations
  const addSubscription = useCallback((sub: Omit<Subscription, 'id' | 'createdAt'>) => {
    const newSub = storageAddSubscription(sub)
    refreshSubscriptions()
    return newSub
  }, [refreshSubscriptions])

  const updateSubscription = useCallback((id: string, updates: Partial<Omit<Subscription, 'id' | 'createdAt'>>) => {
    const result = storageUpdateSubscription(id, updates)
    if (result) refreshSubscriptions()
    return result
  }, [refreshSubscriptions])

  const deleteSubscription = useCallback((id: string) => {
    const result = storageDeleteSubscription(id)
    if (result) refreshSubscriptions()
    return result
  }, [refreshSubscriptions])

  // Summaries
  const todaySummary = React.useMemo(() => getDailySummary(format(new Date(), 'yyyy-MM-dd'), expenses), [expenses])
  const weeklySummary = React.useMemo(() => getWeeklySummary(new Date(), expenses), [expenses])
  const monthlySummary = React.useMemo(() => getMonthlySummary(new Date(), expenses), [expenses])

  // Settings
  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    const updated = saveSettings(newSettings)
    setSettings(updated)
    const passwordProtected = !!updated.passwordHash
    setHasPassword(passwordProtected)
    if (!passwordProtected) {
      setIsLocked(false)
    }
  }, [])

  const setLanguage = useCallback((lang: 'en' | 'my') => {
    setI18nLanguage(lang)
    updateSettings({ language: lang })
  }, [updateSettings])

  // Auth
  const unlock = useCallback((password: string) => {
    if (verifyPassword(password)) {
      setAuthenticated(true)
      setIsLocked(false)
      return true
    }
    return false
  }, [])

  const lock = useCallback(() => {
    setAuthenticated(false)
    setIsLocked(true)
  }, [])

  return (
    <AppContext.Provider
      value={{
        expenses,
        addExpense,
        updateExpense,
        deleteExpense,
        refreshExpenses,
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
        isLocked,
        unlock,
        lock,
        hasPassword,
        isLoading
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
