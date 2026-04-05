import { addDays, differenceInCalendarDays, format, getDaysInMonth } from 'date-fns'
import type { Subscription } from '@/types'

/**
 * Extracts or normalizes a raw date string into 'YYYY-MM-DD' format.
 */
export function normalizeDateKey(rawDate: string): string {
  const datePartMatch = rawDate.match(/^(\d{4}-\d{2}-\d{2})/)
  if (datePartMatch?.[1]) return datePartMatch[1]

  const parsed = new Date(rawDate)
  if (!Number.isNaN(parsed.getTime())) {
    return format(parsed, 'yyyy-MM-dd')
  }

  return rawDate
}

/**
 * Parses a date-only string ('YYYY-MM-DD') into a Date at local midnight.
 * Returns null if the date is invalid.
 */
export function parseDateOnly(rawDate: string): Date | null {
  const normalized = normalizeDateKey(rawDate)
  const parsed = new Date(`${normalized}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

/**
 * Returns the YYYY-MM month key for a given raw date string.
 */
export function getMonthKey(rawDate: string): string {
  return normalizeDateKey(rawDate).slice(0, 7)
}

/**
 * Determines whether a subscription is due on a given day, relative to its
 * start date and billing cycle.
 *
 * Handles weekly, monthly, and yearly cycles. For yearly, ensures the year
 * gap is non-negative (i.e. the day is on or after the start date's year).
 */
export function isSubscriptionDueOnDay(
  subscription: Pick<Subscription, 'billingCycle'>,
  day: Date,
  startDate: Date
): boolean {
  if (day < startDate) return false

  if (subscription.billingCycle === 'weekly') {
    const diff = differenceInCalendarDays(day, startDate)
    // diff is guaranteed >= 0 because of the guard above
    return diff % 7 === 0
  }

  if (subscription.billingCycle === 'monthly') {
    const targetDay = Math.min(startDate.getDate(), getDaysInMonth(day))
    return day.getDate() === targetDay
  }

  // Yearly: must be the same month AND the year difference must be >= 0
  const yearDiff = day.getFullYear() - startDate.getFullYear()
  if (yearDiff < 0 || day.getMonth() !== startDate.getMonth()) return false
  const targetDay = Math.min(startDate.getDate(), getDaysInMonth(day))
  return day.getDate() === targetDay
}

/**
 * Returns the next due date (YYYY-MM-DD) for a subscription on or after
 * `referenceDate`.  Returns null if the start date is unparseable.
 */
export function getNextSubscriptionDueDate(
  subscription: Pick<Subscription, 'billingCycle' | 'startDate'>,
  referenceDate: Date = new Date(),
): string | null {
  const startDate = parseDateOnly(subscription.startDate)
  if (!startDate) return null

  if (startDate >= referenceDate) {
    return format(startDate, 'yyyy-MM-dd')
  }

  for (let d = 0; d <= 400; d++) {
    const day = addDays(referenceDate, d)
    if (isSubscriptionDueOnDay(subscription, day, startDate)) {
      return format(day, 'yyyy-MM-dd')
    }
  }

  return null
}
