import { eachDayOfInterval, format } from 'date-fns'
import { Expense, Subscription } from '@/types'
import { parseDateOnly, isSubscriptionDueOnDay } from '@/lib/date-utils'

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
