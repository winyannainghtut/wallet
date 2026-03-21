'use client'

import { useState, useRef } from 'react'
import { Download, Upload, Trash2, Key, Globe, Shield, FileSpreadsheet, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApp } from '@/contexts/AppContext'
import { clearAllData, getExpenses, hashPassword, saveExpenses } from '@/lib/storage'
import { exportToExcel, importFromExcel, downloadTemplate } from '@/lib/excel'
import { t, Language } from '@/i18n/config'

type NoticeType = 'success' | 'error'

export default function SettingsPage() {
  const { settings, updateSettings, setLanguage, hasPassword, refreshExpenses } = useApp()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [apiKey, setApiKey] = useState(settings.apiKey || '')
  const [notice, setNotice] = useState<{ type: NoticeType; message: string } | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const showNotice = (type: NoticeType, message: string) => {
    setNotice({ type, message })
  }

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
    showNotice('success', 'Language updated.')
  }

  const handleSetPassword = () => {
    if (!newPassword || newPassword !== confirmPassword) {
      showNotice('error', t('settings.passwordMismatch'))
      return
    }

    updateSettings({ passwordHash: hashPassword(newPassword) })
    setNewPassword('')
    setConfirmPassword('')
    showNotice('success', t('settings.passwordSuccess'))
  }

  const handleRemovePassword = () => {
    if (confirm('Remove password protection?')) {
      updateSettings({ passwordHash: undefined })
      showNotice('success', 'Password protection removed.')
    }
  }

  const handleSaveApiKey = () => {
    const trimmed = apiKey.trim()
    if (!trimmed) {
      showNotice('error', 'No API key found. Please enter a valid key.')
      return
    }
    updateSettings({ apiKey: trimmed })
    showNotice('success', t('settings.apiKeySuccess'))
  }

  const handleClearApiKey = () => {
    setApiKey('')
    updateSettings({ apiKey: undefined })
    showNotice('success', 'API key removed.')
  }

  const handleExport = () => {
    exportToExcel(getExpenses())
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const importedExpenses = await importFromExcel(file)
      const currentExpenses = getExpenses()
      saveExpenses([...currentExpenses, ...importedExpenses])
      refreshExpenses()
      showNotice('success', t('excel.importSuccess'))
    } catch {
      showNotice('error', t('excel.importError'))
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleClearData = () => {
    if (confirm(t('settings.clearDataConfirm'))) {
      clearAllData()
      window.location.reload()
    }
  }

  const sectionIconClass = "flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-accent/20"

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground">Manage language, security, AI, and data tools.</p>
      </div>

      {notice && (
        <div
          className={[
            'rounded-xl border px-4 py-3 text-sm font-medium transition-all',
            notice.type === 'success'
              ? 'border-primary/20 bg-primary/5 text-primary'
              : 'border-destructive/20 bg-destructive/5 text-destructive',
          ].join(' ')}
        >
          {notice.message}
        </div>
      )}

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span className={sectionIconClass}>
              <Globe className="h-3.5 w-3.5 text-primary" />
            </span>
            {t('settings.language')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={settings.language} onValueChange={(v) => handleLanguageChange(v as Language)}>
            <SelectTrigger className="w-full rounded-xl border-border/60 bg-muted/20 sm:w-56 transition-all focus:bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t('settings.english')}</SelectItem>
              <SelectItem value="my">{t('settings.myanmar')}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span className={sectionIconClass}>
              <Key className="h-3.5 w-3.5 text-primary" />
            </span>
            {t('settings.apiKey')}
          </CardTitle>
          <CardDescription>Google Gemini API Key (free tier available)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="password"
            placeholder="Enter your Gemini API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleSaveApiKey}
              className="rounded-xl bg-gradient-to-r from-primary to-primary/85 shadow-sm shadow-primary/20"
            >
              {t('common.save')}
            </Button>
            {settings.apiKey && (
              <Button
                variant="destructive"
                onClick={handleClearApiKey}
                className="rounded-xl"
              >
                Clear API Key
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span className={sectionIconClass}>
              <Wallet className="h-3.5 w-3.5 text-primary" />
            </span>
            {t('settings.monthlyBudget')}
          </CardTitle>
          <CardDescription>{t('settings.monthlyBudgetDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="number"
            min="0"
            step="1000"
            placeholder={t('settings.monthlyBudgetPlaceholder')}
            value={settings.monthlyBudget || ''}
            onChange={(e) => updateSettings({ monthlyBudget: e.target.value ? Number(e.target.value) : undefined })}
            className="rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background"
          />
        </CardContent>
      </Card>

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span className={sectionIconClass}>
              <Shield className="h-3.5 w-3.5 text-primary" />
            </span>
            {t('settings.password')}
          </CardTitle>
          <CardDescription>
            {hasPassword ? 'Password protection is active.' : 'Set a password to protect local data.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('settings.newPassword')}</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('settings.confirmPassword')}</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="rounded-xl border-border/60 bg-muted/20 transition-all focus:bg-background"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleSetPassword}
              className="rounded-xl bg-gradient-to-r from-primary to-primary/85 shadow-sm shadow-primary/20"
            >
              {hasPassword ? t('settings.changePassword') : t('settings.setPassword')}
            </Button>
            {hasPassword && (
              <Button variant="destructive" onClick={handleRemovePassword} className="rounded-xl">
                {t('settings.removePassword')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span className={sectionIconClass}>
              <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
            </span>
            Excel
          </CardTitle>
          <CardDescription>Import and export your expense data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExport} className="rounded-xl border-border/60">
              <Download className="mr-2 h-4 w-4" />
              {t('settings.exportData')}
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="rounded-xl border-border/60"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isImporting ? `${t('common.loading')}` : t('settings.importData')}
            </Button>
            <Button variant="outline" onClick={downloadTemplate} className="rounded-xl border-border/60">
              {t('excel.downloadTemplate')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base text-destructive">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </span>
            {t('settings.clearData')}
          </CardTitle>
          <CardDescription>This action cannot be undone.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleClearData} className="rounded-xl">
            {t('settings.clearData')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
