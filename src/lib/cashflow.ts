import {
  addDays,
  addMonths,
  eachDayOfInterval,
  format,
  getDaysInMonth,
  startOfDay,
  startOfMonth,
} from 'date-fns'
import { isValidDateOnly } from '@/lib/savings-assets'
import { normalizeDateKey, getMonthKey, isSubscriptionDueOnDay } from '@/lib/date-utils'
import type { Expense, Income, Subscription } from '@/types'
import type { PortfolioAsset } from '@/hooks/useSavingsAssetsPortfolio'

export type ForecastEntry = {
  id: string
  label: string
  amount: number
  date: string
  kind: 'income' | 'subscription' | 'savings_transfer'
  source: string
}

export type CashflowForecastDay = {
  date: string
  income: number
  expenses: number
  subscriptions: number
  savingsTransfers: number
  net: number
  entries: ForecastEntry[]
}

export type ProjectedNetWorthPoint = {
  month: string
  label: string
  netCashflow: number
  savingsTransferAmount: number
  projectedAssets: number
  projectedNetWorth: number
}

function parseDateOnlyStrict(rawDate: string): Date | null {
  const normalized = normalizeDateKey(rawDate)
  if (!isValidDateOnly(normalized)) {
    return null
  }

  const parsed = new Date(`${normalized}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return startOfDay(parsed)
}

function getAverageMonthlyTotal(
  items: Array<{ amount: number; date: string }>,
  referenceDate: Date,
  monthWindow = 3,
): number {
  const months = Array.from({ length: monthWindow }, (_, index) =>
    format(startOfMonth(addMonths(referenceDate, -index)), 'yyyy-MM')
  )
  const totals = new Map(months.map((month) => [month, 0]))

  for (const item of items) {
    const monthKey = getMonthKey(item.date)
    if (!totals.has(monthKey)) continue
    totals.set(monthKey, (totals.get(monthKey) ?? 0) + item.amount)
  }

  return [...totals.values()].reduce((sum, value) => sum + value, 0) / monthWindow
}

function getProjectedIncomeDay(incomes: Income[]): number {
  const counts = new Map<number, number>()

  for (const income of incomes) {
    const parsed = parseDateOnlyStrict(income.date)
    if (!parsed) continue
    counts.set(parsed.getDate(), (counts.get(parsed.getDate()) ?? 0) + 1)
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])
  return sorted[0]?.[0] ?? 1
}


function isInsuranceContributionDueOnDay(day: Date, startDate: Date): boolean {
  if (day < startDate) return false
  const targetDay = Math.min(startDate.getDate(), getDaysInMonth(day))
  return day.getDate() === targetDay
}

export function buildCashflowForecast({
  expenses,
  incomes,
  subscriptions,
  portfolioAssets,
  horizonDays = 180,
  referenceDate = new Date(),
}: {
  expenses: Expense[]
  incomes: Income[]
  subscriptions: Subscription[]
  portfolioAssets: PortfolioAsset[]
  horizonDays?: number
  referenceDate?: Date
}): CashflowForecastDay[] {
  const today = startOfDay(referenceDate)
  const endDate = startOfDay(addDays(today, Math.max(horizonDays - 1, 0)))
  const days = eachDayOfInterval({ start: today, end: endDate })
  const averageMonthlyIncome = getAverageMonthlyTotal(incomes, referenceDate, 3)
  const averageDailyExpense = getAverageMonthlyTotal(expenses, referenceDate, 3) / 30
  const projectedIncomeDay = getProjectedIncomeDay(incomes)

  const forecast = days.map((day) => ({
    date: format(day, 'yyyy-MM-dd'),
    income: 0,
    expenses: averageDailyExpense,
    subscriptions: 0,
    savingsTransfers: 0,
    net: 0,
    entries: [] as ForecastEntry[],
  }))
  const dayMap = new Map(forecast.map((day) => [day.date, day]))

  if (averageMonthlyIncome > 0) {
    const monthIterations = Math.ceil(horizonDays / 28) + 1
    for (let offset = 0; offset < monthIterations; offset += 1) {
      const monthStart = startOfMonth(addMonths(today, offset))
      const dueDay = Math.min(projectedIncomeDay, getDaysInMonth(monthStart))
      const dueDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), dueDay)
      const dueKey = format(dueDate, 'yyyy-MM-dd')
      const target = dayMap.get(dueKey)
      if (!target) continue

      target.income += averageMonthlyIncome
      target.entries.push({
        id: `income-${dueKey}`,
        label: 'Projected income',
        amount: averageMonthlyIncome,
        date: dueKey,
        kind: 'income',
        source: 'average monthly income',
      })
    }
  }

  for (const subscription of subscriptions.filter((item) => item.isActive)) {
    const startDate = parseDateOnlyStrict(subscription.startDate)
    if (!startDate) continue

    for (const day of days) {
      if (!isSubscriptionDueOnDay(subscription, day, startDate)) continue

      const dayKey = format(day, 'yyyy-MM-dd')
      const target = dayMap.get(dayKey)
      if (!target) continue

      // Use the actual billed amount per occurrence, not the monthly equivalent
      target.subscriptions += subscription.amount
      target.entries.push({
        id: `subscription-${subscription.id}-${dayKey}`,
        label: subscription.name,
        amount: subscription.amount,
        date: dayKey,
        kind: 'subscription',
        source: subscription.billingCycle,
      })
    }
  }

  for (const asset of portfolioAssets) {
    if (asset.asset.type !== 'insurance') continue
    if (!asset.recurringStartDate || !asset.recurringMonthlyAmount || asset.recurringMonthlyAmount <= 0) continue

    const startDate = parseDateOnlyStrict(asset.recurringStartDate)
    if (!startDate) continue

    for (const day of days) {
      if (!isInsuranceContributionDueOnDay(day, startDate)) continue

      const dayKey = format(day, 'yyyy-MM-dd')
      const target = dayMap.get(dayKey)
      if (!target) continue

      target.savingsTransfers += asset.recurringMonthlyAmount
      target.entries.push({
        id: `savings-transfer-${asset.asset.id}-${dayKey}`,
        label: `${asset.asset.name} contribution`,
        amount: asset.recurringMonthlyAmount,
        date: dayKey,
        kind: 'savings_transfer',
        source: 'insurance recurring contribution',
      })
    }
  }

  return forecast.map((day) => ({
    ...day,
    net: day.income - day.expenses - day.subscriptions - day.savingsTransfers,
  }))
}

export function buildProjectedNetWorth(
  forecastDays: CashflowForecastDay[],
  currentAssetValue: number,
  months = 6,
): ProjectedNetWorthPoint[] {
  const monthSummaries = new Map<string, { netCashflow: number; savingsTransferAmount: number }>()

  for (const day of forecastDays) {
    const monthKey = day.date.slice(0, 7)
    const summary = monthSummaries.get(monthKey) ?? { netCashflow: 0, savingsTransferAmount: 0 }
    summary.netCashflow += day.net
    summary.savingsTransferAmount += day.savingsTransfers
    monthSummaries.set(monthKey, summary)
  }

  let projectedAssets = currentAssetValue
  let projectedNetWorth = currentAssetValue

  return [...monthSummaries.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, months)
    .map(([month, summary]) => {
      projectedAssets += summary.savingsTransferAmount
      projectedNetWorth += summary.netCashflow + summary.savingsTransferAmount

      return {
        month,
        label: format(new Date(`${month}-01T00:00:00`), 'MMM yyyy'),
        netCashflow: summary.netCashflow,
        savingsTransferAmount: summary.savingsTransferAmount,
        projectedAssets,
        projectedNetWorth,
      }
    })
}
