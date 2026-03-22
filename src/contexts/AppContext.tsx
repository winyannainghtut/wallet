'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { Expense, Trip, Subscription, UserProfile, AppSettings, DailySummary, WeeklySummary, MonthlySummary, Category } from '@/types'
import {
  getExpenses as storageGetExpenses,
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
import { useAuth } from '@/contexts/AuthContext'

interface AppContextType {
  // Expenses
  expenses: Expense[]
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<Expense>
  updateExpense: (id: string, updates: Partial<Omit<Expense, 'id' | 'createdAt'>>) => Promise<Expense | null>
  deleteExpense: (id: string) => Promise<boolean>
  refreshExpenses: () => Promise<void>

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
  isUsingBackend: boolean
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated: isPbAuthenticated, user } = useAuth()
  const isUsingBackend = isPbAuthenticated && !!user

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null)
  const [settings, setSettings] = useState<AppSettings>({ language: 'en', currency: 'SGD' })
  const [hasPassword, setHasPassword] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Load expenses from PocketBase or localStorage
  const refreshExpenses = useCallback(async () => {
    if (isUsingBackend) {
      try {
        const res = await fetch('/api/transactions')
        if (res.ok) {
          const data = await res.json()
          // Map PocketBase records to Expense type
          const mappedExpenses: Expense[] = (data.items || []).map((item: any) => ({
            id: item.id,
            amount: item.amount,
            category: item.category as Category,
            description: item.description || '',
            date: item.date,
            createdAt: item.created,
            updatedAt: item.updated,
            tripId: item.tripId,
          }))
          setExpenses(mappedExpenses)
        } else {
          // Fallback to localStorage if API fails
          setExpenses(storageGetExpenses())
        }
      } catch (error) {
        console.error('Failed to fetch expenses from backend:', error)
        setExpenses(storageGetExpenses())
      }
    } else {
      setExpenses(storageGetExpenses())
    }
  }, [isUsingBackend])

  // Load all user-scoped data
  const loadUserData = useCallback(async () => {
    const loadedSettings = getSettings()
    setI18nLanguage(loadedSettings.language)
    setSettings(loadedSettings)

    const passwordProtected = isPasswordProtected()
    setHasPassword(passwordProtected)
    setIsLocked(passwordProtected ? !isAuthenticated() : false)

    // Load expenses (from backend or localStorage)
    await refreshExpenses()

    setTrips(getTrips())
    setSubscriptions(getSubscriptions())
    setActiveProfile(getActiveProfile())
  }, [refreshExpenses])

  useEffect(() => {
    const loadData = async () => {
      // Initialize profiles (migrates legacy data on first run)
      initializeProfiles()
      setProfiles(getProfiles())
      await loadUserData()
      setIsLoading(false)
    }

    queueMicrotask(loadData)
  }, [loadUserData])

  // Reload expenses when authentication changes
  useEffect(() => {
    if (!isLoading) {
      refreshExpenses()
    }
  }, [isPbAuthenticated, user, isLoading, refreshExpenses])

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
  const refreshTrips = useCallback(() => {
    setTrips(getTrips())
  }, [])

  const refreshSubscriptions = useCallback(() => {
    setSubscriptions(getSubscriptions())
  }, [])

  // Expense operations - use PocketBase when authenticated
  const addExpense = useCallback(async (expense: Omit<Expense, 'id' | 'createdAt'>) => {
    if (isUsingBackend) {
      try {
        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'expense',
            category: expense.category,
            amount: expense.amount,
            description: expense.description,
            date: expense.date,
            tripId: expense.tripId,
          }),
        })

        if (!res.ok) {
          throw new Error('Failed to save to backend')
        }

        const data = await res.json()
        const newExpense: Expense = {
          id: data.id,
          amount: data.amount,
          category: data.category as Category,
          description: data.description || '',
          date: data.date,
          createdAt: data.created,
          updatedAt: data.updated,
          tripId: data.tripId,
        }

        setExpenses(prev => [newExpense, ...prev])
        return newExpense
      } catch (error) {
        console.error('Failed to save expense to backend:', error)
        // Fallback to localStorage
        const newExpense = storageAddExpense(expense)
        refreshExpenses()
        return newExpense
      }
    } else {
      // Use localStorage
      const newExpense = storageAddExpense(expense)
      setExpenses(prev => [newExpense, ...prev])
      return newExpense
    }
  }, [isUsingBackend, refreshExpenses])

  const updateExpense = useCallback(async (id: string, updates: Partial<Omit<Expense, 'id' | 'createdAt'>>) => {
    if (isUsingBackend) {
      try {
        const res = await fetch(`/api/transactions/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })

        if (!res.ok) {
          throw new Error('Failed to update in backend')
        }

        const data = await res.json()
        const updatedExpense: Expense = {
          id: data.id,
          amount: data.amount,
          category: data.category as Category,
          description: data.description || '',
          date: data.date,
          createdAt: data.created,
          updatedAt: data.updated,
          tripId: data.tripId,
        }

        setExpenses(prev => prev.map(e => e.id === id ? updatedExpense : e))
        return updatedExpense
      } catch (error) {
        console.error('Failed to update expense in backend:', error)
        // Fallback to localStorage
        const result = storageUpdateExpense(id, updates)
        if (result) refreshExpenses()
        return result
      }
    } else {
      const result = storageUpdateExpense(id, updates)
      if (result) {
        setExpenses(prev => prev.map(e => e.id === id ? result : e))
      }
      return result
    }
  }, [isUsingBackend, refreshExpenses])

  const deleteExpense = useCallback(async (id: string) => {
    if (isUsingBackend) {
      try {
        const res = await fetch(`/api/transactions/${id}`, {
          method: 'DELETE',
        })

        if (!res.ok) {
          throw new Error('Failed to delete from backend')
        }

        setExpenses(prev => prev.filter(e => e.id !== id))
        return true
      } catch (error) {
        console.error('Failed to delete expense from backend:', error)
        // Fallback to localStorage
        const result = storageDeleteExpense(id)
        if (result) refreshExpenses()
        return result
      }
    } else {
      const result = storageDeleteExpense(id)
      if (result) {
        setExpenses(prev => prev.filter(e => e.id !== id))
      }
      return result
    }
  }, [isUsingBackend, refreshExpenses])

  // Trip operations (still using localStorage for now)
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

  // Subscription operations (still using localStorage for now)
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
        isLoading,
        isUsingBackend,
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
