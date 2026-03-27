'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  Settings,
  PieChart,
  Home,
  PlusCircle,
  Languages,
  Plane,
  Repeat,
  CalendarDays,
  Landmark,
  PiggyBank,
  Receipt,
  ScanSearch,
  Users
} from 'lucide-react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { t } from '@/i18n/config'
import { useApp } from '@/contexts/AppContext'

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()
  const { settings, setLanguage } = useApp()
  const language = settings.language

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false)
    command()
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t('common.commandPalette')} />
      <CommandList>
        <CommandEmpty>{t('common.noResults')}</CommandEmpty>
        <CommandGroup heading={t('common.navigation')}>
          <CommandItem onSelect={() => runCommand(() => router.push('/'))}>
            <Home className="mr-2 h-4 w-4" />
            <span>{t('nav.dashboard')}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/add'))}>
            <PlusCircle className="mr-2 h-4 w-4" />
            <span>{t('nav.addExpense')}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/history'))}>
            <Calendar className="mr-2 h-4 w-4" />
            <span>{t('nav.history')}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/income'))}>
            <Landmark className="mr-2 h-4 w-4" />
            <span>{t('nav.income')}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/savings'))}>
            <PiggyBank className="mr-2 h-4 w-4" />
            <span>{t('nav.savings')}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/reports'))}>
            <PieChart className="mr-2 h-4 w-4" />
            <span>{t('nav.reports')}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/calendar'))}>
            <CalendarDays className="mr-2 h-4 w-4" />
            <span>{t('nav.calendar')}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/trips'))}>
            <Plane className="mr-2 h-4 w-4" />
            <span>{t('nav.trips')}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/subscriptions'))}>
            <Repeat className="mr-2 h-4 w-4" />
            <span>{t('nav.subscriptions')}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/bills'))}>
            <Receipt className="mr-2 h-4 w-4" />
            <span>{t('nav.bills')}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/accounts'))}>
            <Landmark className="mr-2 h-4 w-4" />
            <span>{t('nav.accounts')}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/review'))}>
            <ScanSearch className="mr-2 h-4 w-4" />
            <span>{t('nav.review')}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/household'))}>
            <Users className="mr-2 h-4 w-4" />
            <span>{t('nav.household')}</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/settings'))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>{t('nav.settings')}</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={t('common.quickActions')}>
          <CommandItem onSelect={() => runCommand(() => {
            const nextLang = language === 'en' ? 'my' : 'en'
            void setLanguage(nextLang)
          })}>
            <Languages className="mr-2 h-4 w-4" />
            <span>{t('common.switchLanguageTo', {
              language: language === 'en' ? t('settings.myanmar') : t('settings.english'),
            })}</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
