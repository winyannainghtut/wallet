'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'

const INACTIVITY_LIMIT_MS = 48 * 60 * 60 * 1000 // 2 days
const LAST_ACTIVITY_STORAGE_KEY = 'wallet_last_activity'
const INACTIVITY_CHECK_INTERVAL_MS = 60 * 1000 // 1 minute

function readLastActivityFromStorage(): number {
  try {
    if (typeof window === 'undefined') return Date.now()
    const stored = localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY)
    return stored ? parseInt(stored, 10) : Date.now()
  } catch {
    return Date.now()
  }
}

function writeLastActivityToStorage(timestamp: number): void {
  try {
    if (typeof window === 'undefined') return
    localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(timestamp))
  } catch {
    // localStorage may be unavailable
  }
}

function clearActivityStorage(): void {
  try {
    if (typeof window === 'undefined') return
    localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY)
  } catch {
    // ignore
  }
}

interface User {
  id: string
  email: string
  name?: string
  avatar?: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (email: string, password: string, passwordConfirm: string, name?: string) => Promise<void>
  refreshUser: () => Promise<void>
  logoutMessage: string | null
  clearLogoutMessage: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null)
  const lastActivityRef = useRef<number>(readLastActivityFromStorage())

  // Check if user is already logged in on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        setUser(data.user)
      } catch (error) {
        console.error('Error initializing auth:', error)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      let errorMessage = 'Login failed'
      try {
        const error = await res.json()
        if (error?.error) errorMessage = error.error
      } catch {
        // Server returned non-JSON response
      }
      throw new Error(errorMessage)
    }

    const data = await res.json()
    setUser(data.user)
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    clearActivityStorage()
  }, [])

  const register = useCallback(async (
    email: string,
    password: string,
    passwordConfirm: string,
    name?: string
  ) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, passwordConfirm, name }),
    })

    if (!res.ok) {
      let errorMessage = 'Registration failed'
      try {
        const error = await res.json()
        if (error?.error) errorMessage = error.error
      } catch {
        // Server returned non-JSON response
      }
      throw new Error(errorMessage)
    }

    const data = await res.json()
    setUser(data.user)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      setUser(data.user)
    } catch (error) {
      console.error('Error refreshing user:', error)
      setUser(null)
    }
  }, [])

  const updateActivity = useCallback(() => {
    const now = Date.now()
    lastActivityRef.current = now
    writeLastActivityToStorage(now)
  }, [])

  const clearLogoutMessage = useCallback(() => {
    setLogoutMessage(null)
  }, [])

  // Inactivity auto-logout
  useEffect(() => {
    if (!user) return

    // Check immediately on mount (e.g. user returns after 2+ days)
    if (Date.now() - lastActivityRef.current > INACTIVITY_LIMIT_MS) {
      void logout().then(() => {
        setLogoutMessage('You have been logged out due to 2 days of inactivity.')
      })
      return
    }

    const handleActivity = () => updateActivity()

    const events = ['click', 'keydown', 'scroll', 'touchstart', 'mousemove'] as const
    for (const eventName of events) {
      window.addEventListener(eventName, handleActivity, { passive: true })
    }

    const intervalId = setInterval(() => {
      if (Date.now() - lastActivityRef.current > INACTIVITY_LIMIT_MS) {
        void logout().then(() => {
          setLogoutMessage('You have been logged out due to 2 days of inactivity.')
        })
      }
    }, INACTIVITY_CHECK_INTERVAL_MS)

    return () => {
      for (const eventName of events) {
        window.removeEventListener(eventName, handleActivity)
      }
      clearInterval(intervalId)
    }
  }, [user, logout, updateActivity])

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    register,
    refreshUser,
    logoutMessage,
    clearLogoutMessage,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
