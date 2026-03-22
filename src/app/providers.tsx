'use client'

import { AppProvider, useApp } from '@/contexts/AppContext'
import { AppLayout } from '@/components/AppLayout'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const isLoginPath = pathname === '/login'

  useEffect(() => {
    if (isLoading) {
      return
    }

    if (!isAuthenticated && !isLoginPath) {
      router.replace('/login')
      return
    }

    if (isAuthenticated && isLoginPath) {
      router.replace('/')
    }
  }, [isAuthenticated, isLoading, isLoginPath, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if ((!isAuthenticated && !isLoginPath) || (isAuthenticated && isLoginPath)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return <>{children}</>
}

function AppContent({ children }: { children: React.ReactNode }) {
  const { isLoading } = useApp()
  const pathname = usePathname()

  if (pathname === '/login') {
    return <>{children}</>
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return <AppLayout>{children}</AppLayout>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppProvider>
        <AuthRedirect>
          <AppContent>{children}</AppContent>
        </AuthRedirect>
      </AppProvider>
    </AuthProvider>
  )
}
