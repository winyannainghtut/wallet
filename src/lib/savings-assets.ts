import { addMonths, differenceInCalendarMonths, format, isBefore, parseISO, startOfDay } from 'date-fns'
import type { SavingsAsset, SavingsAssetType } from '@/types'

export const SAVINGS_ASSET_TYPES: SavingsAssetType[] = ['insurance', 'crypto', 'stocks', 'personal_funds']

export function isSavingsAssetType(value: string): value is SavingsAssetType {
  return SAVINGS_ASSET_TYPES.includes(value as SavingsAssetType)
}

export function isValidDateOnly(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return false
  }

  const year = Number.parseInt(match[1], 10)
  const month = Number.parseInt(match[2], 10)
  const day = Number.parseInt(match[3], 10)
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function getRecurringContributionCount(
  recurringStartDate?: string,
  referenceDate: Date = new Date()
): number {
  if (!recurringStartDate || !isValidDateOnly(recurringStartDate)) {
    return 0
  }

  const startDate = startOfDay(parseISO(recurringStartDate))
  const today = startOfDay(referenceDate)
  if (isBefore(today, startDate)) {
    return 0
  }

  const monthDifference = differenceInCalendarMonths(today, startDate)
  const currentCycleDate = addMonths(startDate, monthDifference)

  return isBefore(today, currentCycleDate) ? monthDifference : monthDifference + 1
}

export function getRecurringContributionTotal(
  recurringMonthlyAmount?: number,
  recurringStartDate?: string,
  referenceDate: Date = new Date()
): number {
  if (typeof recurringMonthlyAmount !== 'number' || !Number.isFinite(recurringMonthlyAmount) || recurringMonthlyAmount <= 0) {
    return 0
  }

  return recurringMonthlyAmount * getRecurringContributionCount(recurringStartDate, referenceDate)
}

export function calculateInsuranceAssetValue(
  asset: Pick<SavingsAsset, 'amount' | 'recurringMonthlyAmount' | 'recurringStartDate'>,
  referenceDate: Date = new Date()
): number {
  return asset.amount + getRecurringContributionTotal(
    asset.recurringMonthlyAmount,
    asset.recurringStartDate,
    referenceDate
  )
}

export function getNextRecurringContributionDate(
  recurringStartDate?: string,
  referenceDate: Date = new Date()
): string | undefined {
  if (!recurringStartDate || !isValidDateOnly(recurringStartDate)) {
    return undefined
  }

  const startDate = startOfDay(parseISO(recurringStartDate))
  const today = startOfDay(referenceDate)
  if (isBefore(today, startDate)) {
    return format(startDate, 'yyyy-MM-dd')
  }

  const contributionCount = getRecurringContributionCount(recurringStartDate, referenceDate)
  return format(addMonths(startDate, contributionCount), 'yyyy-MM-dd')
}
