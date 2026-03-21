'use client'

import { subMonths, subWeeks } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CategoryPieChart, DailyBarChart, WeeklyTrendChart } from '@/components/Charts'
import { useApp } from '@/contexts/AppContext'
import { getWeeklySummary, getMonthlySummary } from '@/lib/storage'
import { CATEGORY_LABELS, Category, WeeklySummary } from '@/types'
import { t, getLanguage } from '@/i18n/config'

export default function ReportsPage() {
  const language = getLanguage()
  const { weeklySummary, monthlySummary, subscriptions } = useApp()

  // Monthly subscription cost
  const monthlySubCost = subscriptions
    .filter(s => s.isActive)
    .reduce((sum, s) => {
      if (s.billingCycle === 'monthly') return sum + s.amount
      if (s.billingCycle === 'yearly') return sum + s.amount / 12
      if (s.billingCycle === 'weekly') return sum + s.amount * 4.33
      return sum
    }, 0)

  const weeklySummaries: WeeklySummary[] = []
  for (let i = 7; i >= 0; i--) {
    const date = subWeeks(new Date(), i)
    weeklySummaries.push(getWeeklySummary(date))
  }

  const monthlySummaries = []
  for (let i = 5; i >= 0; i--) {
    const date = subMonths(new Date(), i)
    monthlySummaries.push(getMonthlySummary(date))
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
  const totalMonthlyWithSubs = monthlySummary.total + Math.round(monthlySubCost)
  const activeSubscriptions = subscriptions.filter(s => s.isActive)

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
        </TabsList>

        <TabsContent value="weekly" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports.totalExpenses')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight tabular-nums">
                  {weeklySummary.total.toLocaleString()} <span className="text-base font-semibold text-muted-foreground">SGD</span>
                </div>
                {monthlySubCost > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">+ {Math.round(monthlySubCost / 4.33).toLocaleString()} SGD/wk subs</p>
                )}
              </CardContent>
            </Card>
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports.averageDaily')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight tabular-nums">
                  {weeklyAverage.toLocaleString()} <span className="text-base font-semibold text-muted-foreground">SGD</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports.highestCategory')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">
                  {highestCategory ? CATEGORY_LABELS[highestCategory[0] as Category][language] : '-'}
                </div>
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
            />
          </div>

          <WeeklyTrendChart
            data={weeklySummaries}
            title={`${t('reports.weekly')} ${t('reports.trend')}`}
          />
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports.totalExpenses')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight tabular-nums">
                  {totalMonthlyWithSubs.toLocaleString()} <span className="text-base font-semibold text-muted-foreground">SGD</span>
                </div>
                {monthlySubCost > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {monthlySummary.total.toLocaleString()} expenses + {Math.round(monthlySubCost).toLocaleString()} subs
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports.averageDaily')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight tabular-nums">
                  {monthlyAverage.toLocaleString()} <span className="text-base font-semibold text-muted-foreground">SGD</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports.highestCategory')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">
                  {highestCategory ? CATEGORY_LABELS[highestCategory[0] as Category][language] : '-'}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t('reports.lowestCategory')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">
                  {lowestCategory ? CATEGORY_LABELS[lowestCategory[0] as Category][language] : '-'}
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
                {sixMonthAverage.toLocaleString()} <span className="text-base font-semibold text-muted-foreground">SGD</span>
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
                  {Math.round(monthlySubCost).toLocaleString()} <span className="text-base font-semibold text-muted-foreground">SGD / month</span>
                </div>
                <div className="space-y-2 border-t border-border/40 pt-3">
                  {activeSubscriptions.map(sub => {
                    const monthlyAmount = sub.billingCycle === 'yearly' ? sub.amount / 12
                      : sub.billingCycle === 'weekly' ? sub.amount * 4.33
                      : sub.amount
                    return (
                      <div key={sub.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{sub.name}</span>
                        <span className="font-semibold tabular-nums">{Math.round(monthlyAmount).toLocaleString()} SGD</span>
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
            />
          </div>

          <WeeklyTrendChart
            data={monthlyTrendAsWeeks}
            title="6-Month Spend Trend"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
