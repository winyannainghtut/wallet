'use client'


import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { PlusCircle, TrendingUp, Calendar, Wallet, PiggyBank, Scale, Plus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SummaryCard } from '@/components/SummaryCard'
import { CategoryPieChart, IncomeExpenseBarChart } from '@/components/Charts'
import { ChatAssistant } from '@/components/ChatAssistant'
import { AiInsightsCard } from '@/components/AiInsightsCard'
import { TransactionList, TransactionItem } from '@/components/TransactionList'
import { UpcomingSubscriptions } from '@/components/UpcomingSubscriptions'
import { SavingsGoalWidget } from '@/components/SavingsGoalWidget'
import { useApp } from '@/contexts/AppContext'
import { useSavingsAssetsPortfolio } from '@/hooks/useSavingsAssetsPortfolio'
import { t } from '@/i18n/config'
import type { AiSavingsContext } from '@/types'
import { getCurrencyDisplayLabel } from '@/lib/settings'

function normalizeDateKey(rawDate: string): string {
  const datePartMatch = rawDate.match(/^(\d{4}-\d{2}-\d{2})/)
  if (datePartMatch?.[1]) return datePartMatch[1]

  const parsed = new Date(rawDate)
  if (!Number.isNaN(parsed.getTime())) {
    return format(parsed, 'yyyy-MM-dd')
  }

  return rawDate
}

export default function DashboardPage() {
  const { 
    expenses, personalExpenses, incomes, subscriptions, todaySummary, weeklySummary, monthlySummary, 
    settings, currentUser 
  } = useApp()
  const displayCurrency = getCurrencyDisplayLabel(settings)
  const {
    totalAssetValue,
    insuranceValue,
    cryptoValue,
    stocksValue,
    personalFundsValue,
    sortedPortfolioAssets,
    cryptoSocketState,
    cryptoSocketError,
    usdToCurrencyRate,
    fxError,
  } = useSavingsAssetsPortfolio(settings.currency)

  const monthStart = startOfMonth(new Date())
  const monthEnd = endOfMonth(new Date())
  const monthStartKey = format(monthStart, 'yyyy-MM-dd')
  const monthEndKey = format(monthEnd, 'yyyy-MM-dd')
  const weekStart = startOfWeek(new Date())
  const weekEnd = endOfWeek(new Date())
  const weekStartKey = format(weekStart, 'yyyy-MM-dd')
  const weekEndKey = format(weekEnd, 'yyyy-MM-dd')

  const monthlyIncome = incomes.reduce((sum, income) => {
    const key = normalizeDateKey(income.date)
    if (key < monthStartKey || key > monthEndKey) {
      return sum
    }
    return sum + income.amount
  }, 0)

  const weeklyIncome = incomes.reduce((sum, income) => {
    const key = normalizeDateKey(income.date)
    if (key < weekStartKey || key > weekEndKey) {
      return sum
    }
    return sum + income.amount
  }, 0)

  const monthlySavings = monthlyIncome - monthlySummary.total
  const weeklySavings = weeklyIncome - weeklySummary.total
  const expenseIncomeRatio = monthlyIncome > 0 ? (monthlySummary.total / monthlyIncome) * 100 : 0
  const averageDailyExpense = monthlySummary.total / 30
  const aiSavingsContext: AiSavingsContext = {
    currency: settings.currency,
    totalAssetValue,
    insuranceValue,
    cryptoValue,
    stocksValue,
    personalFundsValue,
    usdToCurrencyRate,
    fxError,
    cryptoSocketState,
    cryptoSocketError,
    assets: sortedPortfolioAssets.slice(0, 25).map((item) => ({
      id: item.asset.id,
      type: item.asset.type,
      name: item.asset.name,
      symbol: item.symbol ?? item.asset.symbol,
      quantity: item.quantity,
      currentValue: item.currentValue,
      valueSource: item.valueSource,
      productId: item.productId,
      unitPriceUsd: item.unitPriceUsd,
      quoteUpdatedAt: item.quoteUpdatedAt,
      recurringMonthlyAmount: item.recurringMonthlyAmount,
      recurringStartDate: item.recurringStartDate,
    })),
  }

  // Combine Income and Expenses for Recent Transactions
  const recentTransactions: TransactionItem[] = [
    ...expenses.map(e => ({ ...e, type: 'expense' as const })),
    ...incomes.map(i => ({ ...i, type: 'income' as const }))
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  // Time-based Greeting
  const currentHour = new Date().getHours()
  let greeting = 'Good Evening'
  if (currentHour < 12) greeting = 'Good Morning'
  else if (currentHour < 18) greeting = 'Good Afternoon'

  return (
    <div className="space-y-7">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/80 p-5 shadow-sm backdrop-blur-sm md:p-7">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.04] via-transparent to-accent/[0.04]" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/70">
              {greeting}, {currentUser?.name || 'User'}
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
                Week: {weeklySummary.total.toLocaleString()} {displayCurrency}
              </span>
              <span className={`rounded-full px-3 py-1.5 font-medium ${weeklySavings >= 0 ? 'bg-emerald-500/10 text-emerald-700' : 'bg-rose-500/10 text-rose-700'}`}>
                Weekly Net: {Math.round(weeklySavings).toLocaleString()} {displayCurrency}
              </span>
              <span className="rounded-full bg-primary/10 px-3 py-1.5 font-medium text-primary">
                Net Savings: {Math.round(monthlySavings).toLocaleString()} {displayCurrency}
              </span>
              <span className="rounded-full bg-accent/30 px-3 py-1.5 font-medium text-foreground">
                Assets: {Math.round(totalAssetValue).toLocaleString()} {displayCurrency}
              </span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto mt-4 md:mt-0">
            <Link href="/add" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full rounded-xl bg-gradient-to-r from-primary to-primary/85 shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                {t('dashboard.quickAdd')}
              </Button>
            </Link>
            <Link href="/income" className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="w-full rounded-xl border-primary/20 text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary/5"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Income
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {(personalExpenses.length > 0 || incomes.length > 0) && (
        <AiInsightsCard 
          expenses={personalExpenses} 
          incomes={incomes}
          subscriptions={subscriptions}
          monthlySavings={monthlySavings}
          savingsContext={aiSavingsContext}
        />
      )}

      <div className="grid grid-cols-1 gap-4">
        <SavingsGoalWidget currentSavings={monthlySavings} currency={displayCurrency} />
        <UpcomingSubscriptions subscriptions={subscriptions} currency={displayCurrency} />
      </div>

      {/* Summary Cards */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
          <SummaryCard
            title={t('dashboard.todayExpenses')}
            amount={todaySummary.total}
            icon={Calendar}
            subtitle={`${todaySummary.count} items`}
            currency={displayCurrency}
          />
          <SummaryCard
            title={t('dashboard.weeklyExpenses')}
            amount={weeklySummary.total}
            icon={TrendingUp}
            currency={displayCurrency}
          />
          <SummaryCard
            title={t('dashboard.monthlyExpenses')}
            amount={monthlySummary.total}
            icon={Wallet}
            currency={displayCurrency}
          />
          <SummaryCard
            title={t('dashboard.monthlyIncome')}
            amount={monthlyIncome}
            icon={TrendingUp}
            currency={displayCurrency}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 xl:gap-5">
          <SummaryCard
            title={t('dashboard.monthlyNetSavings')}
            amount={monthlySavings}
            icon={PiggyBank}
            subtitle={monthlyIncome > 0 ? `${((monthlySavings / monthlyIncome) * 100).toFixed(1)}% savings rate` : 'No income records this month'}
            currency={displayCurrency}
          />
          <SummaryCard
            title="Tracked Assets"
            amount={totalAssetValue}
            icon={Wallet}
            subtitle="Insurance, crypto, stocks, and personal funds"
            currency={displayCurrency}
          />
          <SummaryCard
            title={t('dashboard.expenseIncomeRatio')}
            amount={Math.round(expenseIncomeRatio)}
            icon={Scale}
            subtitle={`${Math.round(averageDailyExpense).toLocaleString()} ${displayCurrency} avg/day`}
            currency="%"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Category Chart */}
        <div className="lg:col-span-3">
          <IncomeExpenseBarChart
            expenses={personalExpenses}
            incomes={incomes}
            title="Trend"
            currency={displayCurrency}
          />
        </div>
        <div className="lg:col-span-3">
          <CategoryPieChart
            data={monthlySummary.byCategory}
            title={t('reports.byCategory')}
          />
        </div>
      </div>

      {/* AI Assistant */}
      <div>
        <ChatAssistant
          expenses={personalExpenses}
          incomes={incomes}
          subscriptions={subscriptions}
          monthlySavings={monthlySavings}
          savingsContext={aiSavingsContext}
          className="h-[620px]"
        />
      </div>

      {/* Recent Transactions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Recent Transactions</h2>
          <Link href="/history">
            <Button variant="link" className="text-primary">{t('dashboard.viewAll')}</Button>
          </Link>
        </div>
        <TransactionList 
          transactions={recentTransactions} 
          currency={displayCurrency} 
          showDate 
        />
      </div>
    </div>
  )
}
