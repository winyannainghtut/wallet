'use client'

import { PlusCircle, TrendingUp, Calendar, Wallet, Repeat } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SummaryCard } from '@/components/SummaryCard'
import { ExpenseList } from '@/components/ExpenseList'
import { CategoryPieChart } from '@/components/Charts'
import { ChatAssistant } from '@/components/ChatAssistant'
import { AiInsightsCard } from '@/components/AiInsightsCard'
import { BudgetProgressCard } from '@/components/BudgetProgressCard'
import { useApp } from '@/contexts/AppContext'
import { getApiKey } from '@/lib/storage'
import { t } from '@/i18n/config'

export default function DashboardPage() {
  const { expenses, subscriptions, todaySummary, weeklySummary, monthlySummary, settings } = useApp()

  // Monthly subscription cost
  const monthlySubCost = subscriptions
    .filter(s => s.isActive)
    .reduce((sum, s) => {
      if (s.billingCycle === 'monthly') return sum + s.amount
      if (s.billingCycle === 'yearly') return sum + s.amount / 12
      if (s.billingCycle === 'weekly') return sum + s.amount * 4.33
      return sum
    }, 0)

  // Get top 5 recent expenses
  const recentExpenses = [...expenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  const hasApiKey = !!getApiKey()

  return (
    <div className="space-y-7">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/80 p-5 shadow-sm backdrop-blur-sm md:p-7">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.04] via-transparent to-accent/[0.04]" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/70">
              {t('dashboard.title')}
            </p>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              {t('common.appName')}
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Track spending daily and spot trends before they become habits.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-xs">
              <span className="rounded-full bg-primary/10 px-3 py-1.5 font-medium text-primary">
                {todaySummary.count} items today
              </span>
              <span className="rounded-full bg-secondary px-3 py-1.5 font-medium text-secondary-foreground">
                Week: {weeklySummary.total.toLocaleString()} SGD
              </span>
            </div>
          </div>
          <Link href="/add">
            <Button
              size="lg"
              className="w-full rounded-xl bg-gradient-to-r from-primary to-primary/85 shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25 md:w-auto"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              {t('dashboard.quickAdd')}
            </Button>
          </Link>
        </div>
      </div>

      {settings.monthlyBudget && settings.monthlyBudget > 0 && (
        <BudgetProgressCard
          currentSpend={monthlySummary.total}
          budget={settings.monthlyBudget}
        />
      )}

      {hasApiKey && expenses.length > 0 && (
        <AiInsightsCard expenses={expenses} />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title={t('dashboard.todayExpenses')}
          amount={todaySummary.total}
          icon={Calendar}
          subtitle={`${todaySummary.count} expenses`}
        />
        <SummaryCard
          title={t('dashboard.weeklyExpenses')}
          amount={weeklySummary.total}
          icon={TrendingUp}
        />
        <SummaryCard
          title={t('dashboard.monthlyExpenses')}
          amount={monthlySummary.total}
          icon={Wallet}
        />
        <SummaryCard
          title={t('reports.averageDaily')}
          amount={monthlySummary.total / 30}
          icon={TrendingUp}
        />
        {subscriptions.length > 0 && (
          <SummaryCard
            title={t('subscriptions.totalMonthly')}
            amount={Math.round(monthlySubCost)}
            icon={Repeat}
            subtitle={`${subscriptions.filter(s => s.isActive).length} active`}
          />
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Category Chart */}
        <div className="lg:col-span-2">
          <CategoryPieChart
            data={monthlySummary.byCategory}
            title={t('reports.byCategory')}
          />
        </div>

        {/* AI Chat Assistant */}
        <div className="lg:col-span-1">
          {hasApiKey ? (
            <ChatAssistant expenses={expenses} />
          ) : (
            <div className="flex h-[500px] items-center justify-center rounded-2xl border border-dashed border-border/50 bg-card/60 p-6 backdrop-blur-sm">
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60">
                  <span className="text-2xl">🤖</span>
                </div>
                <p className="text-sm text-muted-foreground">{t('ai.noApiKey')}</p>
                <Link href="/settings">
                  <Button variant="outline" className="rounded-xl border-border/60">{t('nav.settings')}</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">{t('dashboard.recentExpenses')}</h2>
          <Link href="/history">
            <Button variant="link" className="text-primary">{t('dashboard.viewAll')}</Button>
          </Link>
        </div>
        <ExpenseList expenses={recentExpenses} showDate />
      </div>
    </div>
  )
}
