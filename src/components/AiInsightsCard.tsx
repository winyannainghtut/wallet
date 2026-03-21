'use client'

import React, { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Expense } from '@/types'
import { getSpendingInsights } from '@/lib/ai'
import { getApiKey } from '@/lib/storage'
import { getLanguage, t } from '@/i18n/config'

export function AiInsightsCard({ expenses }: { expenses: Expense[] }) {
  const [insight, setInsight] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const apiKey = getApiKey()
  const language = getLanguage()

  const handleFetchInsights = async () => {
    if (!apiKey || expenses.length === 0) return
    
    setLoading(true)
    try {
      const result = await getSpendingInsights(expenses.slice(0, 50), apiKey, language)
      setInsight(result)
    } catch (error) {
      console.error('Failed to get insights', error)
    } finally {
      setLoading(false)
    }
  }

  if (!apiKey) return null

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 backdrop-blur-xl mb-6 shadow-sm overflow-hidden relative">
      <div className="absolute top-0 right-0 p-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
      <CardHeader className="pb-3 relative">
        <CardTitle className="flex items-center gap-2 text-primary text-base">
          <Sparkles className="h-4 w-4" />
          {t('ai.spendingInsight')}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        {loading ? (
          <div className="flex animate-pulse space-x-4">
            <div className="flex-1 space-y-3 py-1">
              <div className="h-2 bg-primary/10 rounded w-3/4"></div>
              <div className="h-2 bg-primary/10 rounded w-5/6"></div>
              <div className="h-2 bg-primary/10 rounded w-1/2"></div>
            </div>
          </div>
        ) : insight ? (
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {insight}
          </p>
        ) : (
          <div className="flex flex-col items-center justify-center py-2 space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              {t('ai.insightPrompt')}
            </p>
            <Button onClick={handleFetchInsights} variant="secondary" size="sm" className="rounded-xl relative z-10 border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all text-primary">
              <Sparkles className="mr-2 h-4 w-4" />
              {t('ai.generateInsightBtn')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
