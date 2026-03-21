'use client'

import { AppProvider, useApp } from '@/contexts/AppContext'
import { AppLayout } from '@/components/AppLayout'
import { PasswordModal } from '@/components/PasswordModal'

function AppContent({ children }: { children: React.ReactNode }) {
  const { isLocked, isLoading, unlock } = useApp()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (isLocked) {
    return <PasswordModal onUnlock={unlock} />
  }

  return <AppLayout>{children}</AppLayout>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AppContent>{children}</AppContent>
    </AppProvider>
  )
}
