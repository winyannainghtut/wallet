'use client'

import React from 'react'
import { Globe } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Language } from '@/i18n/config'
import { useApp } from '@/contexts/AppContext'

export function LanguageSwitcher() {
  const { settings, setLanguage } = useApp()
  const language = settings.language

  const changeLanguage = (lang: Language) => {
    if (lang !== language) {
      setLanguage(lang)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center justify-center rounded-md p-2 transition-colors hover:bg-accent"
        aria-label="Change language"
      >
        <Globe className="h-5 w-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => changeLanguage('en')}
          className={language === 'en' ? 'bg-accent' : ''}
        >
          English
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => changeLanguage('my')}
          className={language === 'my' ? 'bg-accent' : ''}
        >
          Myanmar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
