import { differenceInCalendarDays, eachDayOfInterval, format, getDaysInMonth } from 'date-fns'
import { Expense, Subscription } from '@/types'

function normalizeDateString(rawDate: string): string {
  const datePartMatch = rawDate.match(/^(\d{4}-\d{2}-\d{2})/)
  if (datePartMatch?.[1]) return datePartMatch[1]

  const parsed = new Date(rawDate)
  if (!Number.isNaN(parsed.getTime())) {
    return format(parsed, 'yyyy-MM-dd')
  }

  return rawDate
}

function parseDateOnly(rawDate: string): Date | null {
  const normalized = normalizeDateString(rawDate)
  const parsed = new Date(`${normalized}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function isSubscriptionDueOnDay(subscription: Subscription, day: Date, startDate: Date): boolean {
  if (day < startDate) return false

  if (subscription.billingCycle === 'weekly') {
    return differenceInCalendarDays(day, startDate) % 7 === 0
  }

  if (subscription.billingCycle === 'monthly') {
    const targetDay = Math.min(startDate.getDate(), getDaysInMonth(day))
    return day.getDate() === targetDay
  }

  if (day.getMonth() !== startDate.getMonth()) return false
  const targetDay = Math.min(startDate.getDate(), getDaysInMonth(day))
  return day.getDate() === targetDay
}

function buildSubscriptionExpenseOccurrences(
  subscriptions: Subscription[],
  start: Date,
  end: Date
): Expense[] {
  const rangeStart = start <= end ? start : end
  const rangeEnd = start <= end ? end : start
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd })

  const occurrences: Expense[] = []
  for (const subscription of subscriptions) {
    if (!subscription.isActive) continue
    const startDate = parseDateOnly(subscription.startDate)
    if (!startDate) continue

    for (const day of days) {
      const dayKey = format(day, 'yyyy-MM-dd')
      const dayDate = new Date(`${dayKey}T00:00:00`)
      if (!isSubscriptionDueOnDay(subscription, dayDate, startDate)) continue

      occurrences.push({
        id: `subscription-${subscription.id}-${dayKey}`,
        amount: subscription.amount,
        category: subscription.category,
        description: subscription.name,
        date: dayKey,
        createdAt: dayDate.toISOString(),
      })
    }
  }

  return occurrences
}

export function getSubscriptionSpendForRange(
  subscriptions: Subscription[],
  start: Date,
  end: Date
): number {
  return buildSubscriptionExpenseOccurrences(subscriptions, start, end)
    .reduce((sum, item) => sum + item.amount, 0)
}

export function mergeExpensesWithSubscriptionOccurrences(
  expenses: Expense[],
  subscriptions: Subscription[],
  start: Date,
  end: Date
): Expense[] {
  return [...expenses, ...buildSubscriptionExpenseOccurrences(subscriptions, start, end)]
}
