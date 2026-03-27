'use client'

import { eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subMonths, subWeeks } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CategoryPieChart, DailyBarChart, WeeklyTrendChart } from '@/components/Charts'
import { useApp } from '@/contexts/AppContext'
import { useSavingsAssetsPortfolio } from '@/hooks/useSavingsAssetsPortfolio'
import { buildCashflowForecast, buildProjectedNetWorth } from '@/lib/cashflow'
import { getWeeklySummary, getMonthlySummary } from '@/lib/storage'
import { WeeklySummary, getCategoryLabel } from '@/types'
import { t, getLanguage } from '@/i18n/config'
import { getSubscriptionSpendForRange, mergeExpensesWithSubscriptionOccurrences } from '@/lib/subscription-expenses'
import { getCurrencyDisplayLabel } from '@/lib/settings'

function getDateKey(rawDate: string): string {
  const datePartMatch = rawDate.match(/^(\d{4}-\d{2}-\d{2})/)
  if (datePartMatch?.[1]) return datePartMatch[1]

  const parsed = new Date(rawDate)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }
  return rawDate
}

export default function ReportsPage() {
  const language = getLanguage()
  const { weeklySummary, monthlySummary, subscriptions, personalExpenses, incomes, settings } = useApp()
  const currencyCode = settings.currency
  const displayCurrency = getCurrencyDisplayLabel(settings)
  const { totalAssetValue, sortedPortfolioAssets } = useSavingsAssetsPortfolio(currencyCode)

  // Monthly subscription cost
  const monthlySubCost = subscriptions
    .filter(s => s.isActive)
    .reduce((sum, s) => {
      if (s.billingCycle === 'monthly') return sum + s.amount
      if (s.billingCycle === 'yearly') return sum + s.amount / 12
      if (s.billingCycle === 'weekly') return sum + s.amount * 4.33
      return sum
    }, 0)

  const currentWeekSubSpend = Math.round(
    getSubscriptionSpendForRange(subscriptions, startOfWeek(new Date()), endOfWeek(new Date()))
  )
  const currentMonthSubSpend = Math.round(
    getSubscriptionSpendForRange(subscriptions, startOfMonth(new Date()), endOfMonth(new Date()))
  )
  const currentMonthExpenseOnly = Math.max(0, monthlySummary.total - currentMonthSubSpend)

  const weekStart = startOfWeek(new Date())
  const weekEnd = endOfWeek(new Date())
  const monthStart = startOfMonth(new Date())
  const monthEnd = endOfMonth(new Date())
  const weekStartKey = format(weekStart, 'yyyy-MM-dd')
  const weekEndKey = format(weekEnd, 'yyyy-MM-dd')
  const monthStartKey = format(monthStart, 'yyyy-MM-dd')
  const monthEndKey = format(monthEnd, 'yyyy-MM-dd')

  const weeklyIncomeTotal = incomes.reduce((sum, income) => {
    const key = getDateKey(income.date)
    if (key < weekStartKey || key > weekEndKey) {
      return sum
    }
    return sum + income.amount
  }, 0)

  const monthlyIncomeTotal = incomes.reduce((sum, income) => {
    const key = getDateKey(income.date)
    if (key < monthStartKey || key > monthEndKey) {
      return sum
    }
    return sum + income.amount
  }, 0)

  const weeklyExpenseOnlyTotal = personalExpenses.reduce((sum, expense) => {
    const dateKey = getDateKey(expense.date)
    if (dateKey < format(weekStart, 'yyyy-MM-dd') || dateKey > format(weekEnd, 'yyyy-MM-dd')) {
      return sum
    }
    return sum + expense.amount
  }, 0)
  const weeklyTotalWithSubs = weeklySummary.total
  const weeklySubShare = weeklyTotalWithSubs > 0 ? (currentWeekSubSpend / weeklyTotalWithSubs) * 100 : 0
  const weeklyNetSavings = weeklyIncomeTotal - weeklyTotalWithSubs
  const weeklySavingsRate = weeklyIncomeTotal > 0 ? (weeklyNetSavings / weeklyIncomeTotal) * 100 : 0
  const weeklyExpenseIncomeRatio = weeklyIncomeTotal > 0 ? (weeklyTotalWithSubs / weeklyIncomeTotal) * 100 : 0
  const monthlyNetSavings = monthlyIncomeTotal - monthlySummary.total
  const monthlySavingsRate = monthlyIncomeTotal > 0 ? (monthlyNetSavings / monthlyIncomeTotal) * 100 : 0
  const monthlyExpenseIncomeRatio = monthlyIncomeTotal > 0 ? (monthlySummary.total / monthlyIncomeTotal) * 100 : 0

  const reportRangeStart = startOfMonth(subMonths(new Date(), 5))
  const reportRangeEnd = endOfMonth(new Date())
  const expensesWithSubsForReports = mergeExpensesWithSubscriptionOccurrences(
    personalExpenses,
    subscriptions,
    reportRangeStart,
    reportRangeEnd
  )

  const weeklySummaries: WeeklySummary[] = []
  for (let i = 7; i >= 0; i--) {
    const date = subWeeks(new Date(), i)
    weeklySummaries.push(getWeeklySummary(date, expensesWithSubsForReports))
  }

  const monthlySummaries = []
  for (let i = 5; i >= 0; i--) {
    const date = subMonths(new Date(), i)
    monthlySummaries.push(getMonthlySummary(date, expensesWithSubsForReports))
  }

  const monthlyTrendAsWeeks: WeeklySummary[] = monthlySummaries.map((monthSummary) => ({
    weekStart: `${monthSummary.month}-01`,
    weekEnd: `${monthSummary.month}-28`,
    total: monthSummary.total,
    byCategory: monthSummary.byCategory,
    dailyBreakdown: [],
  }))

  const categoryTotals = monthlySummary.byCategory
  const sortedCategories = Object.entries(categoryTotals)
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1])

  const highestCategory = sortedCategories[0]
  const lowestCategory = sortedCategories[sortedCategories.length - 1]
  const weeklyAverage = Math.round(weeklySummary.total / 7)
  const monthlyAverage = Math.round(monthlySummary.total / 30)
  const sixMonthAverage = Math.round(
    monthlySummaries.reduce((sum, month) => sum + month.total, 0) / Math.max(monthlySummaries.length, 1)
  )
  const activeSubscriptions = subscriptions.filter(s => s.isActive)

  const weeklySubByDate = mergeExpensesWithSubscriptionOccurrences([], subscriptions, weekStart, weekEnd)
    .reduce<Record<string, { amount: number; count: number }>>((acc, item) => {
      const key = item.date
      const current = acc[key] || { amount: 0, count: 0 }
      acc[key] = { amount: current.amount + item.amount, count: current.count + 1 }
      return acc
    }, {})

  const weeklyExpenseByDate = personalExpenses.reduce<Record<string, { amount: number; count: number }>>((acc, item) => {
    const key = getDateKey(item.date)
    if (key < format(weekStart, 'yyyy-MM-dd') || key > format(weekEnd, 'yyyy-MM-dd')) {
      return acc
    }
    const current = acc[key] || { amount: 0, count: 0 }
    acc[key] = { amount: current.amount + item.amount, count: current.count + 1 }
    return acc
  }, {})
  const weeklyIncomeByDate = incomes.reduce<Record<string, { amount: number; count: number }>>((acc, item) => {
    const key = getDateKey(item.date)
    if (key < weekStartKey || key > weekEndKey) {
      return acc
    }
    const current = acc[key] || { amount: 0, count: 0 }
    acc[key] = { amount: current.amount + item.amount, count: current.count + 1 }
    return acc
  }, {})

  const weeklyDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const weeklyDetailsByDate = weeklyDays.reduce<Record<string, { expense: number; subscription: number; income: number; count: number }>>((acc, day) => {
    const key = format(day, 'yyyy-MM-dd')
    const expenseInfo = weeklyExpenseByDate[key] || { amount: 0, count: 0 }
    const subInfo = weeklySubByDate[key] || { amount: 0, count: 0 }
    const incomeInfo = weeklyIncomeByDate[key] || { amount: 0, count: 0 }
    acc[key] = {
      expense: expenseInfo.amount,
      subscription: subInfo.amount,
      income: incomeInfo.amount,
      count: expenseInfo.count + subInfo.count + incomeInfo.count,
    }
    return acc
  }, {})

  const highestSpendDay = weeklySummary.dailyBreakdown.reduce((best, day) => {
    if (!best || day.total > best.total) return day
    return best
  }, null as WeeklySummary['dailyBreakdown'][number] | null)
  const activeSpendDays = weeklySummary.dailyBreakdown.filter(day => day.total > 0).length
  const forecastDays = buildCashflowForecast({
    expenses: personalExpenses,
    incomes,
    subscriptions,
    portfolioAssets: sortedPortfolioAssets,
    horizonDays: 180,
  })
  const next30ForecastDays = forecastDays.slice(0, 30)
  const next30Income = next30ForecastDays.reduce((sum, day) => sum + day.income, 0)
  const next30Outflows = next30ForecastDays.reduce((sum, day) => sum + day.expenses + day.subscriptions, 0)
  const next30SavingsTransfers = next30ForecastDays.reduce((sum, day) => sum + day.savingsTransfers, 0)
  const next30Net = next30ForecastDays.reduce((sum, day) => sum + day.net, 0)
  const projectedNetWorthPoints = buildProjectedNetWorth(forecastDays, totalAssetValue, 6)
  const sixMonthProjectedNetWorth = projectedNetWorthPoints[projectedNetWorthPoints.length - 1]?.projectedNetWorth ?? totalAssetValue
  const maxProjectedNetWorth = Math.max(...projectedNetWorthPoints.map((point) => point.projectedNetWorth), totalAssetValue, 1)
  const upcomingForecastEntries = forecastDays
    .flatMap((day) => day.entries)
    .filter((entry) => entry.date >= format(new Date(), 'yyyy-MM-dd'))
    .sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind))
    .slice(0, 12)

  return (
    <div className="space-y-7">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('reports.title')}</h1>
        <p className="text-sm text-muted-foreground">
          Monitor category shifts and short-term trends to keep spending predictable.
        </p>
      </div>

      <Tabs defaultValue="weekly" className="space-y-6">
        <TabsList className="rounded-xl border border-border/40 bg-muted/40 p-1 backdrop-blur-sm">
          <TabsTrigger value="weekly" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">{t('reports.weekly')}</TabsTrigger>
          <TabsTrigger value="monthly" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">{t('reports.monthly')}</TabsTrigger>
          <TabsTrigger value="forecast" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Forecast</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total (incl. subscriptions)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight tabular-nums">
                  {weeklyTotalWithSubs.toLocaleString()} <span className="text-base font-semibold text-muted-foreground">{displayCurrency}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {highestSpendDay ? `Highest day: ${format(new Date(`${highestSpendDay.date}T00:00:00`), 'EEE')} ${highestSpendDay.total.toLocaleString()} ${displayCurrency}` : 'Highest day: -'}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports.weeklyIncome')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight tabular-nums">
                  {Math.round(weeklyIncomeTotal).toLocaleString()} <span className="text-base font-semibold text-muted-foreground">{displayCurrency}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t('reports.incomeVsExpense')}: {(weeklyIncomeTotal - weeklyExpenseOnlyTotal).toLocaleString()} {displayCurrency}</p>
              </CardContent>
            </Card>
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports.netSavings')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold tracking-tight tabular-nums ${weeklyNetSavings >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {Math.round(weeklyNetSavings).toLocaleString()} <span className="text-base font-semibold text-muted-foreground">{displayCurrency}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t('reports.savingsRate')}: {weeklySavingsRate.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports.expenseIncomeRatio')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight tabular-nums">
                  {weeklyExpenseIncomeRatio.toFixed(1)} <span className="text-base font-semibold text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Active days: {activeSpendDays}/7</p>
              </CardContent>
            </Card>
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Expense-only</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight tabular-nums">
                  {Math.round(weeklyExpenseOnlyTotal).toLocaleString()} <span className="text-base font-semibold text-muted-foreground">{displayCurrency}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t('reports.averageDaily')}: {weeklyAverage.toLocaleString()} {displayCurrency}</p>
              </CardContent>
            </Card>
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Subscription-only</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight tabular-nums">
                  {currentWeekSubSpend.toLocaleString()} <span className="text-base font-semibold text-muted-foreground">{displayCurrency}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{weeklySubShare.toFixed(1)}% of weekly total</p>
              </CardContent>
            </Card>
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tracked Assets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight tabular-nums text-primary">
                  {Math.round(totalAssetValue).toLocaleString()} <span className="text-base font-semibold text-muted-foreground">{displayCurrency}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Insurance, crypto, stocks, and personal funds snapshot</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CategoryPieChart
              data={weeklySummary.byCategory}
              title={`${t('reports.weekly')} ${t('reports.byCategory')}`}
            />
            <DailyBarChart
              data={weeklySummary.dailyBreakdown}
              title={t('common.thisWeek')}
              currency={displayCurrency}
              detailsByDate={weeklyDetailsByDate}
            />
          </div>

          <WeeklyTrendChart
            data={weeklySummaries}
            title={`${t('reports.weekly')} ${t('reports.trend')}`}
            currency={displayCurrency}
          />
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports.totalExpenses')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight tabular-nums">
                  {monthlySummary.total.toLocaleString()} <span className="text-base font-semibold text-muted-foreground">{displayCurrency}</span>
                </div>
                {monthlySubCost > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {Math.round(currentMonthExpenseOnly).toLocaleString()} expenses + {currentMonthSubSpend.toLocaleString()} subscriptions
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports.monthlyIncome')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight tabular-nums">
                  {Math.round(monthlyIncomeTotal).toLocaleString()} <span className="text-base font-semibold text-muted-foreground">{displayCurrency}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t('reports.expenseIncomeRatio')}: {monthlyExpenseIncomeRatio.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports.netSavings')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold tracking-tight tabular-nums ${monthlyNetSavings >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {Math.round(monthlyNetSavings).toLocaleString()} <span className="text-base font-semibold text-muted-foreground">{displayCurrency}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t('reports.savingsRate')}: {monthlySavingsRate.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tracked Assets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight tabular-nums text-primary">
                  {Math.round(totalAssetValue).toLocaleString()} <span className="text-base font-semibold text-muted-foreground">{displayCurrency}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Insurance, crypto, stocks, and personal funds snapshot</p>
              </CardContent>
            </Card>
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports.averageDaily')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight tabular-nums">
                  {monthlyAverage.toLocaleString()} <span className="text-base font-semibold text-muted-foreground">{displayCurrency}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports.highestCategory')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">
                  {highestCategory ? getCategoryLabel(highestCategory[0], language) : '-'}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports.lowestCategory')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">
                  {lowestCategory ? getCategoryLabel(lowestCategory[0], language) : '-'}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">6-Month Average</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight tabular-nums">
                {sixMonthAverage.toLocaleString()} <span className="text-base font-semibold text-muted-foreground">{displayCurrency}</span>
              </div>
            </CardContent>
          </Card>

          {activeSubscriptions.length > 0 && (
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('subscriptions.title')} ({activeSubscriptions.length} active)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight tabular-nums mb-3">
                  {Math.round(monthlySubCost).toLocaleString()} <span className="text-base font-semibold text-muted-foreground">{displayCurrency} / month</span>
                </div>
                <div className="space-y-2 border-t border-border/40 pt-3">
                  {activeSubscriptions.map(sub => {
                    const monthlyAmount = sub.billingCycle === 'yearly' ? sub.amount / 12
                      : sub.billingCycle === 'weekly' ? sub.amount * 4.33
                      : sub.amount
                    return (
                      <div key={sub.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{sub.name}</span>
                        <span className="font-semibold tabular-nums">{Math.round(monthlyAmount).toLocaleString()} {displayCurrency}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CategoryPieChart
              data={monthlySummary.byCategory}
              title={`${t('reports.monthly')} ${t('reports.byCategory')}`}
            />
            <WeeklyTrendChart
              data={monthlySummary.weeklyBreakdown}
              title={`${t('reports.monthly')} Weekly Breakdown`}
              currency={displayCurrency}
            />
          </div>

          <WeeklyTrendChart
            data={monthlyTrendAsWeeks}
            title="6-Month Spend Trend"
            currency={displayCurrency}
          />
        </TabsContent>

        <TabsContent value="forecast" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Next 30d Income</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight tabular-nums text-emerald-600">
                  {Math.round(next30Income).toLocaleString()} <span className="text-base font-semibold text-muted-foreground">{displayCurrency}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Next 30d Outflows</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight tabular-nums">
                  {Math.round(next30Outflows).toLocaleString()} <span className="text-base font-semibold text-muted-foreground">{displayCurrency}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Expenses + subscriptions</p>
              </CardContent>
            </Card>
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Savings Transfers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight tabular-nums text-primary">
                  {Math.round(next30SavingsTransfers).toLocaleString()} <span className="text-base font-semibold text-muted-foreground">{displayCurrency}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Recurring insurance and asset contributions</p>
              </CardContent>
            </Card>
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Next 30d Net</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold tracking-tight tabular-nums ${next30Net >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {Math.round(next30Net).toLocaleString()} <span className="text-base font-semibold text-muted-foreground">{displayCurrency}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">6-Month Projected Net Worth</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight tabular-nums text-primary">
                  {Math.round(sixMonthProjectedNetWorth).toLocaleString()} <span className="text-base font-semibold text-muted-foreground">{displayCurrency}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Tracked assets plus forecasted net cashflow</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader>
                <CardTitle className="text-base">Upcoming Cashflow</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingForecastEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No scheduled cashflow events in the next 30 days.</p>
                ) : (
                  upcomingForecastEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between rounded-xl border border-border/40 px-4 py-3">
                      <div className="space-y-1">
                        <p className="font-medium">{entry.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(`${entry.date}T00:00:00`), 'EEE, MMM d')} • {entry.kind.replace('_', ' ')} • {entry.source}
                        </p>
                      </div>
                      <span className={`font-semibold tabular-nums ${
                        entry.kind === 'income'
                          ? 'text-emerald-600'
                          : entry.kind === 'savings_transfer'
                            ? 'text-primary'
                            : 'text-foreground'
                      }`}>
                        {entry.kind === 'income' ? '+' : '-'}{Math.round(entry.amount).toLocaleString()} {displayCurrency}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader>
                <CardTitle className="text-base">Projected Net Worth</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {projectedNetWorthPoints.map((point) => (
                  <div key={point.month} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{point.label}</p>
                        <p className="text-xs text-muted-foreground">
                          Net {Math.round(point.netCashflow).toLocaleString()} {displayCurrency}
                          {' • '}
                          Asset growth {Math.round(point.savingsTransferAmount).toLocaleString()} {displayCurrency}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold tabular-nums">
                          {Math.round(point.projectedNetWorth).toLocaleString()} {displayCurrency}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Assets {Math.round(point.projectedAssets).toLocaleString()} {displayCurrency}
                        </p>
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, Math.max((point.projectedNetWorth / maxProjectedNetWorth) * 100, 0))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
