import { addMonths, format } from 'date-fns'
import type { FundGoal, Trip } from '@/types'
import type { PortfolioAsset } from '@/hooks/useSavingsAssetsPortfolio'

export type FundGoalRecord = {
  id?: string
  name?: string
  targetAmount?: number
  targetDate?: string | null
  monthlyContribution?: number | null
  includeMonthlySavings?: boolean
  linkedTripId?: string | null
  linkedAssets?: string[] | null
  note?: string | null
  status?: string
  color?: string | null
  created?: string
  updated?: string
}

export type EnrichedFundGoal = FundGoal & {
  linkedAssets: PortfolioAsset[]
  linkedTrip?: Trip
  currentAmount: number
  remainingAmount: number
  progressPercentage: number
  projectedMonthlyContribution: number
  projectedCompletionDate?: string
  isOnTrack?: boolean
}

export function normalizeFundGoalRecord(raw: FundGoalRecord): FundGoal | null {
  if (
    !raw.id ||
    !raw.name ||
    typeof raw.targetAmount !== 'number' ||
    !['active', 'completed', 'archived'].includes(raw.status ?? '')
  ) {
    return null
  }

  return {
    id: raw.id,
    name: raw.name,
    targetAmount: raw.targetAmount,
    targetDate: typeof raw.targetDate === 'string' && raw.targetDate.trim().length > 0 ? raw.targetDate : undefined,
    monthlyContribution:
      typeof raw.monthlyContribution === 'number' && raw.monthlyContribution >= 0
        ? raw.monthlyContribution
        : undefined,
    includeMonthlySavings: raw.includeMonthlySavings === true,
    linkedTripId: typeof raw.linkedTripId === 'string' && raw.linkedTripId.trim().length > 0 ? raw.linkedTripId : undefined,
    linkedAssetIds: Array.isArray(raw.linkedAssets)
      ? raw.linkedAssets.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [],
    note: typeof raw.note === 'string' && raw.note.trim().length > 0 ? raw.note : undefined,
    status: raw.status as FundGoal['status'],
    color: typeof raw.color === 'string' && raw.color.trim().length > 0 ? raw.color : undefined,
    createdAt: raw.created ?? new Date().toISOString(),
    updatedAt: raw.updated ?? undefined,
  }
}

export function enrichFundGoal(
  goal: FundGoal,
  portfolioAssets: PortfolioAsset[],
  trips: Trip[],
  monthlySavings: number
): EnrichedFundGoal {
  const linkedAssets = portfolioAssets.filter((item) => goal.linkedAssetIds.includes(item.asset.id))
  const linkedTrip = goal.linkedTripId ? trips.find((trip) => trip.id === goal.linkedTripId) : undefined
  const currentAmount = linkedAssets.reduce((sum, item) => sum + item.currentValue, 0)
  const recurringContribution = linkedAssets.reduce(
    (sum, item) => sum + (item.recurringMonthlyAmount ?? 0),
    0
  )
  const projectedMonthlyContribution =
    (goal.monthlyContribution ?? 0) +
    recurringContribution +
    (goal.includeMonthlySavings ? Math.max(monthlySavings, 0) : 0)
  const remainingAmount = Math.max(goal.targetAmount - currentAmount, 0)
  const progressPercentage =
    goal.targetAmount > 0
      ? Math.min(100, Math.max((currentAmount / goal.targetAmount) * 100, 0))
      : 0

  let projectedCompletionDate: string | undefined
  if (remainingAmount <= 0) {
    projectedCompletionDate = format(new Date(), 'yyyy-MM-dd')
  } else if (projectedMonthlyContribution > 0) {
    const monthsToGoal = Math.ceil(remainingAmount / projectedMonthlyContribution)
    projectedCompletionDate = format(addMonths(new Date(), monthsToGoal), 'yyyy-MM-dd')
  }

  let isOnTrack: boolean | undefined
  if (goal.targetDate && projectedCompletionDate) {
    isOnTrack = projectedCompletionDate <= goal.targetDate
  }

  return {
    ...goal,
    linkedAssets,
    linkedTrip,
    currentAmount,
    remainingAmount,
    progressPercentage,
    projectedMonthlyContribution,
    projectedCompletionDate,
    isOnTrack,
  }
}
