'use client'

import React, { useState } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { t } from '@/i18n/config'

interface PasswordModalProps {
  onUnlock: (password: string) => boolean
}

export function PasswordModal({ onUnlock }: PasswordModalProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const success = onUnlock(password)
    if (!success) {
      setError(true)
      setPassword('')
    }
  }

  return (
    <div className="min-h-screen p-4"
      style={{
        background: `
          radial-gradient(1000px circle at 30% 20%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 50%),
          radial-gradient(800px circle at 70% 80%, color-mix(in oklab, var(--accent) 10%, transparent), transparent 50%),
          var(--background)
        `
      }}
    >
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-sm border-border/40 shadow-xl shadow-primary/5">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/25">
              <Lock className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-xl">{t('auth.passwordRequired')}</CardTitle>
            <CardDescription className="text-sm">{t('auth.enterPassword')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(false)
                }}
                placeholder="••••••••"
                className={`rounded-xl border-border/60 bg-muted/20 text-center text-lg tracking-[0.3em] transition-all focus:bg-background ${error ? 'border-destructive' : ''}`}
                autoFocus
              />
              {error && (
                <p className="text-center text-sm text-destructive">{t('auth.incorrectPassword')}</p>
              )}
              <Button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-primary to-primary/85 shadow-sm shadow-primary/20 transition-all hover:shadow-md hover:shadow-primary/25"
              >
                {t('auth.unlock')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
