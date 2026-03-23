'use client'

import { useEffect, useState, useRef } from 'react'
import { Download, Upload, Trash2, Key, Globe, FileSpreadsheet, User, Palette, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import { clearAllData, getExpenses, saveExpenses } from '@/lib/storage'
import { exportToExcel, importFromExcel, downloadTemplate } from '@/lib/excel'
import { t, Language } from '@/i18n/config'

type NoticeType = 'success' | 'error'
type AiModel = 'glm-4.7' | 'glm-5-turbo' | 'glm-5'

export default function SettingsPage() {
  const { settings, updateSettings, setLanguage, refreshExpenses, currentUser, expenses, customCategories, addCustomCategory, deleteCustomCategory } = useApp()
  const { logout } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [aiModel, setAiModel] = useState<AiModel>((settings.aiModel as AiModel) || 'glm-4.7')
  const [notice, setNotice] = useState<{ type: NoticeType; message: string } | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatType, setNewCatType] = useState<'expense' | 'income'>('expense')

  useEffect(() => {
    setAiModel((settings.aiModel as AiModel) || 'glm-4.7')
  }, [settings.aiModel])

  const showNotice = (type: NoticeType, message: string) => {
    setNotice({ type, message })
  }

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
    showNotice('success', 'Language updated.')
  }

  const handleAiModelChange = (model: AiModel) => {
    setAiModel(model)
    updateSettings({ aiModel: model })
    showNotice('success', t('settings.aiModelUpdated'))
  }

  const handleExport = () => {
    if (expenses.length === 0) {
      showNotice('error', t('common.noData'))
      return
    }

    exportToExcel(expenses)
    showNotice('success', t('excel.exportSuccess'))
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

  const handleAddCategory = () => {
    if (!newCatName.trim()) return
    addCustomCategory({ name: newCatName.trim(), type: newCatType })
    setNewCatName('')
    showNotice('success', 'Custom category added.')
  }

  const sectionIconClass = "flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-accent/20"

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground">Manage language, AI, and data tools.</p>
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

      {/* Current User Info */}
      {currentUser && (
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base">
              <span className={sectionIconClass}>
                <User className="h-3.5 w-3.5 text-primary" />
              </span>
              Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border/40 p-3">
              <div>
                <p className="font-medium">{currentUser.name || 'User'}</p>
                <p className="text-sm text-muted-foreground">{currentUser.email}</p>
              </div>
              <Button
                variant="outline"
                onClick={() => logout()}
                className="rounded-xl border-border/60"
              >
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
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
              <Palette className="h-3.5 w-3.5 text-primary" />
            </span>
            Theme
          </CardTitle>
          <CardDescription>Choose how the app looks like.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={settings.theme || 'dark'} onValueChange={(v) => v && updateSettings({ theme: v as any })}>
            <SelectTrigger className="w-full rounded-xl border-border/60 bg-muted/20 sm:w-56 transition-all focus:bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">Dark Theme</SelectItem>
              <SelectItem value="light">Light Theme</SelectItem>
              <SelectItem value="blossom">🌸 Blossom (Unique)</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span className={sectionIconClass}>
              <Plus className="h-3.5 w-3.5 text-primary" />
            </span>
            Custom Categories
          </CardTitle>
          <CardDescription>Manage your own categories for expenses and incomes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder="Category name"
              className="rounded-xl flex-1 bg-muted/20 focus-visible:bg-background"
            />
            <Select value={newCatType} onValueChange={(v: any) => setNewCatType(v)}>
              <SelectTrigger className="w-[110px] sm:w-[130px] rounded-xl bg-muted/20 focus:bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAddCategory} className="rounded-xl min-w-[70px]">Add</Button>
          </div>
          
          <div className="space-y-2 pt-2">
            {customCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No custom categories added yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {customCategories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between gap-2 bg-muted/30 px-3 py-2.5 rounded-xl border border-border/40">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{cat.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{cat.type}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0 rounded-lg"
                      onClick={() => deleteCustomCategory(cat.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span className={sectionIconClass}>
              <Key className="h-3.5 w-3.5 text-primary" />
            </span>
            {t('settings.aiModel')}
          </CardTitle>
          <CardDescription>{t('settings.aiModelDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-model" className="text-sm font-medium">{t('settings.aiModel')}</Label>
            <Select value={aiModel} onValueChange={(v) => handleAiModelChange(v as AiModel)}>
              <SelectTrigger id="ai-model" className="w-full rounded-xl border-border/60 bg-muted/20 sm:w-56 transition-all focus:bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="glm-4.7">GLM-4.7</SelectItem>
                <SelectItem value="glm-5-turbo">GLM-5-Turbo</SelectItem>
                <SelectItem value="glm-5">GLM-5</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">{t('settings.aiKeyManagedByAdmin')}</p>
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
