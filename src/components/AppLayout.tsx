'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  PlusCircle,
  History,
  BarChart3,
  Settings,
  X,
  LogOut,
  Wallet,
  Plane,
  PanelLeftClose,
  PanelLeftOpen,
  Repeat,
  CalendarDays,
  User,
  Landmark,
  PiggyBank,
  CreditCard,
  Receipt,
  ScanSearch,
  Users
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { CommandPalette } from './CommandPalette'
import { LanguageSwitcher } from './LanguageSwitcher'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import { t } from '@/i18n/config'

const navItems = [
  { href: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { href: '/add', icon: PlusCircle, labelKey: 'nav.addExpense' },
  { href: '/history', icon: History, labelKey: 'nav.history' },
  { href: '/income', icon: Landmark, labelKey: 'nav.income' },
  { href: '/savings', icon: PiggyBank, labelKey: 'nav.savings' },
  { href: '/budgets', icon: PiggyBank, labelKey: 'nav.budgets' },
  { href: '/reports', icon: BarChart3, labelKey: 'nav.reports' },
  { href: '/calendar', icon: CalendarDays, labelKey: 'nav.calendar' },
  { href: '/trips', icon: Plane, labelKey: 'nav.trips' },
  { href: '/subscriptions', icon: Repeat, labelKey: 'nav.subscriptions' },
  { href: '/bills', icon: Receipt, labelKey: 'nav.bills' },
  { href: '/liabilities', icon: CreditCard, labelKey: 'nav.liabilities' },
  { href: '/accounts', icon: Landmark, labelKey: 'nav.accounts' },
  { href: '/review', icon: ScanSearch, labelKey: 'nav.review' },
  { href: '/household', icon: Users, labelKey: 'nav.household' },
  { href: '/settings', icon: Settings, labelKey: 'nav.settings' },
]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { settings, currentUser } = useApp()
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  // Desktop nav — respects collapsed state
  const renderDesktopNavLinks = () =>
    navItems.map((item) => {
      const Icon = item.icon
      const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

      return (
        <Link
          key={item.href}
          href={item.href}
          title={isCollapsed ? t(item.labelKey) : undefined}
          className={[
            'group relative flex items-center rounded-xl py-2.5 text-sm font-medium transition-all duration-200',
            isCollapsed ? 'justify-center px-0 mx-2' : 'gap-3 px-3',
            isActive
              ? 'bg-gradient-to-r from-primary to-primary/85 text-primary-foreground shadow-md shadow-primary/20'
              : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
          ].join(' ')}
        >
          <span
            className={[
              'flex items-center justify-center rounded-lg transition-all duration-200 shrink-0',
              isCollapsed ? 'h-10 w-10' : 'h-8 w-8',
              isActive
                ? 'bg-white/20 text-primary-foreground'
                : 'bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary',
            ].join(' ')}
          >
            <Icon className={isCollapsed ? 'h-5 w-5' : 'h-4 w-4'} />
          </span>
          {!isCollapsed && <span>{t(item.labelKey)}</span>}
          {isActive && !isCollapsed && (
            <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-primary-foreground/70" />
          )}
        </Link>
      )
    })

  // Mobile nav — always shows labels (never collapsed)
  const renderMobileNavLinks = (onNavigate: () => void) =>
    navItems.map((item) => {
      const Icon = item.icon
      const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={[
            'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
            isActive
              ? 'bg-gradient-to-r from-primary to-primary/85 text-primary-foreground shadow-md shadow-primary/20'
              : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
          ].join(' ')}
        >
          <span
            className={[
              'flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200',
              isActive
                ? 'bg-white/20 text-primary-foreground'
                : 'bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary',
            ].join(' ')}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span>{t(item.labelKey)}</span>
          {isActive && (
            <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-primary-foreground/70" />
          )}
        </Link>
      )
    })

  return (
    <div className="min-h-screen" data-lang={settings.language}>
      {/* Desktop Sidebar */}
      <aside className={`hidden transition-all duration-300 md:fixed md:inset-y-0 md:left-0 md:z-50 md:flex md:flex-col ${isCollapsed ? 'md:w-[80px]' : 'md:w-[272px]'}`}>
        <div className="flex h-full min-h-0 flex-col border-r border-border/50 bg-card/80 backdrop-blur-xl">
          {/* Brand + Collapse Toggle */}
          <div className="border-b border-border/40 px-4 pb-4 pt-5">
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-md shadow-primary/25">
                  <Wallet className="h-4.5 w-4.5 text-primary-foreground" />
                </div>
                {!isCollapsed && (
                  <div className="whitespace-nowrap">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">{t('nav.wallet')}</p>
                    <h1 className="text-base font-bold tracking-tight">{t('common.appName')}</h1>
                  </div>
                )}
              </div>
              {!isCollapsed && <LanguageSwitcher />}
            </div>
            {/* Current User Info */}
            {!isCollapsed && currentUser && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{currentUser.name || currentUser.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{currentUser.email}</p>
                </div>
              </div>
            )}
            {isCollapsed && currentUser && (
              <div className="mt-3 flex justify-center">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
              </div>
            )}
            {/* Collapse/Expand Button */}
            <Button
              variant="ghost"
              size="sm"
              className={`mt-3 w-full rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent/70 transition-all ${isCollapsed ? 'justify-center px-0' : 'justify-start gap-2'}`}
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? t('nav.expand') : t('nav.collapse')}
            >
              {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              {!isCollapsed && <span>{t('nav.collapse')}</span>}
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
            {renderDesktopNavLinks()}
          </nav>

          {/* Logout Button */}
          <div className="border-t border-border/40 p-3">
            <Button
              variant="ghost"
              className={`w-full ${isCollapsed ? 'justify-center px-0' : 'justify-start gap-3'} rounded-xl text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/70`}
              onClick={handleLogout}
              title={isCollapsed ? t('common.logout') : undefined}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!isCollapsed && t('common.logout')}
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-card/85 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              aria-label={open ? 'Close menu' : 'Open menu'}
              className="rounded-xl border border-border/60 p-2 transition-all hover:bg-accent/70 hover:shadow-sm"
            >
              {open ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex items-center justify-between border-b border-border/40 p-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70">
                      <Wallet className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <h1 className="text-base font-bold tracking-tight">{t('common.appName')}</h1>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="rounded-lg">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {/* Current User - Mobile */}
                {currentUser && (
                  <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{currentUser.name || currentUser.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{currentUser.email}</p>
                    </div>
                  </div>
                )}
                <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                  {renderMobileNavLinks(() => setOpen(false))}
                </nav>
                <div className="border-t border-border/40 p-3">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/70"
                    onClick={() => {
                      handleLogout()
                      setOpen(false)
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    {t('common.logout')}
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70">
              <Wallet className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <h1 className="text-sm font-bold tracking-tight">{t('common.appName')}</h1>
          </div>
          <LanguageSwitcher />
        </div>

      </header>

      {/* Main Content */}
      <main className={`transition-all duration-300 ${isCollapsed ? 'md:pl-[80px]' : 'md:pl-[272px]'}`}>
        <div className="mx-auto w-full max-w-6xl p-4 md:p-6 lg:p-8">
          <div className="animate-fade-in-up">
            {children}
          </div>
        </div>
      </main>

      {/* Global Command Palette */}
      <CommandPalette />
    </div>
  )
}
