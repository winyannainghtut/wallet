import { Category, CATEGORIES, Expense, Income, Subscription } from '@/types'

export type ParsedExpense = {
  amount: number
  category: Category
  date: string
  description: string
}

type AiAction = 'suggestCategory' | 'parseExpenseText' | 'insights' | 'chat'

type AiResponseError = {
  error?: string
}

type SuggestCategoryResponse = {
  category?: string
}

type ParseExpenseResponse = {
  parsed?: ParsedExpense | null
}

type InsightsResponse = {
  insight?: string
}

type ChatResponse = {
  message?: string
}

async function postAi<T>(
  action: AiAction,
  payload: Record<string, unknown>
): Promise<T> {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      ...payload,
    }),
  })

  if (!response.ok) {
    let message = 'AI request failed'
    try {
      const data = (await response.json()) as AiResponseError
      if (typeof data.error === 'string' && data.error.length > 0) {
        message = data.error
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message)
  }

  return await response.json() as T
}

function toCategoryOrOther(raw: unknown): Category {
  if (typeof raw !== 'string') return 'other'
  const normalized = raw.trim().toLowerCase()
  if (CATEGORIES.includes(normalized as Category)) return normalized as Category
  return 'other'
}

export async function suggestCategory(description: string, model?: string): Promise<Category> {
  if (!description.trim()) return 'other'
  const result = await postAi<SuggestCategoryResponse>('suggestCategory', { description, model })
  return toCategoryOrOther(result.category)
}

export async function parseExpenseText(text: string, model?: string): Promise<ParsedExpense | null> {
  if (!text.trim()) return null
  const result = await postAi<ParseExpenseResponse>('parseExpenseText', { text, model })
  return result.parsed || null
}

export async function getSpendingInsights(
  expenses: Expense[],
  incomes: Income[],
  subscriptions: Subscription[],
  monthlySavings: number,
  language: 'en' | 'my' = 'en',
  currency = 'SGD',
  model?: string
): Promise<string> {
  const result = await postAi<InsightsResponse>('insights', {
    expenses,
    incomes,
    subscriptions,
    monthlySavings,
    language,
    currency,
    model,
  })
  return result.insight || 'Unable to generate insights'
}

export async function* streamChatAboutExpenses(
  message: string,
  expenses: Expense[],
  language: 'en' | 'my' = 'en',
  incomes: Income[] = [],
  subscriptions: Subscription[] = [],
  monthlySavings = 0,
  model?: string
): AsyncGenerator<string> {
  const result = await postAi<ChatResponse>('chat', {
    message,
    expenses,
    language,
    incomes,
    subscriptions,
    monthlySavings,
    model,
  })
  if (result.message) {
    yield result.message
  }
}
