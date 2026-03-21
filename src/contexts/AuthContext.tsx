'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import PocketBase from 'pocketbase'
import { getPocketBaseClient } from '@/lib/pocketbase'
import { UserRecord } from '@/lib/pocketbase-types'

interface AuthContextType {
  user: UserRecord | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  register: (email: string, password: string, passwordConfirm: string, name?: string) => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const pb = getPocketBaseClient()

  // Check if user is already logged in on mount
  useEffect(() => {
    const initAuth = () => {
      try {
        if (pb.authStore.isValid && pb.authStore.model) {
          setUser(pb.authStore.model as UserRecord)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()

    // Subscribe to auth changes
    const unsubscribe = pb.authStore.onChange((token, model) => {
      setUser(model as UserRecord | null)
    })

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [pb.authStore])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const authData = await pb.collection('users').authWithPassword(email, password)
      setUser(authData.record as UserRecord)
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }, [pb])

  const logout = useCallback(() => {
    pb.authStore.clear()
    setUser(null)
  }, [pb])

  const register = useCallback(async (
    email: string,
    password: string,
    passwordConfirm: string,
    name?: string
  ) => {
    try {
      // Create user
      await pb.collection('users').create({
        email,
        password,
        passwordConfirm,
        name,
      })

      // Auto-login after registration
      await login(email, password)
    } catch (error) {
      console.error('Registration error:', error)
      throw error
    }
  }, [pb, login])

  const refreshUser = useCallback(async () => {
    if (!pb.authStore.isValid) return

    try {
      const refreshedUser = await pb.collection('users').authRefresh()
      setUser(refreshUser.record as UserRecord)
    } catch (error) {
      console.error('Error refreshing user:', error)
      // Token might be expired or invalid
      pb.authStore.clear()
      setUser(null)
    }
  }, [pb])

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user && pb.authStore.isValid,
    login,
    logout,
    register,
    refreshUser,
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

// Utility to get auth token (for server-side usage)
export function getAuthToken(): string | undefined {
  if (typeof window === 'undefined') return undefined

  // PocketBase stores the token in localStorage
  const pbData = localStorage.getItem('pocketbase_auth')
  if (!pbData) return undefined

  try {
    const parsed = JSON.parse(pbData)
    return parsed.token
  } catch {
    return undefined
  }
}
