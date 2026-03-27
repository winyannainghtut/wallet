'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Trip, FundGoal } from '@/types'
import type { PortfolioAsset } from '@/hooks/useSavingsAssetsPortfolio'
import { enrichFundGoal, normalizeFundGoalRecord, type EnrichedFundGoal, type FundGoalRecord } from '@/lib/fund-goals'

type FundGoalsApiResponse = {
  items?: FundGoalRecord[]
  error?: string
}

type UseFundGoalsResult = {
  goals: FundGoal[]
  enrichedGoals: EnrichedFundGoal[]
  isLoading: boolean
  error: string | null
  refreshGoals: () => Promise<void>
}

export function useFundGoals(
  portfolioAssets: PortfolioAsset[],
  trips: Trip[],
  monthlySavings: number
): UseFundGoalsResult {
  const [goals, setGoals] = useState<FundGoal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshGoals = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/fund-goals?perPage=200')
      const data = (await response.json()) as FundGoalsApiResponse

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load fund goals')
      }

      const normalized = (data.items ?? [])
        .map(normalizeFundGoalRecord)
        .filter((goal): goal is FundGoal => goal !== null)
      setGoals(normalized)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load fund goals'
      setError(message)
      setGoals([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshGoals()
  }, [refreshGoals])

  const enrichedGoals = useMemo(
    () => goals.map((goal) => enrichFundGoal(goal, portfolioAssets, trips, monthlySavings)),
    [goals, monthlySavings, portfolioAssets, trips]
  )

  return {
    goals,
    enrichedGoals,
    isLoading,
    error,
    refreshGoals,
  }
}
