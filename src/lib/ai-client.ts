import { AiSavingsContext, Category, CATEGORIES, Expense, Income, Subscription } from '@/types'

export type ParsedExpense = {
  amount: number
  category: Category
  date: string
  description: string
}

export type SuggestedCategory = {
  category: Category
  shouldCreateCustomCategory: boolean
  customCategoryName?: string
}

type AiAction = 'suggestCategory' | 'parseExpenseText' | 'insights' | 'chat'

type AiResponseError = {
  error?: string
  code?: string
}

export class AiClientError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'AiClientError'
    this.status = status
    this.code = code
  }
}

export function isAiKeyNotConfiguredError(error: unknown): boolean {
  if (error instanceof AiClientError) {
    if (error.code === 'AI_KEY_NOT_CONFIGURED') return true
    if (error.status === 503 && error.message.toLowerCase().includes('ai key is not configured')) return true
  }

  if (error instanceof Error) {
    return error.message.toLowerCase().includes('ai key is not configured')
  }

  return false
}

type SuggestCategoryResponse = {
  category?: string
  shouldCreateCustomCategory?: boolean
  customCategoryName?: string
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
    let code: string | undefined
    try {
      const data = (await response.json()) as AiResponseError
      if (typeof data.error === 'string' && data.error.length > 0) {
        message = data.error
      }
      if (typeof data.code === 'string' && data.code.length > 0) {
        code = data.code
      }
    } catch {
      // ignore parse errors
    }
    throw new AiClientError(message, response.status, code)
  }

  return await response.json() as T
}

function toCategoryOrOther(raw: unknown): Category {
  if (typeof raw !== 'string') return 'other'
  const normalized = raw.trim().toLowerCase()
  if ((CATEGORIES as readonly string[]).includes(normalized)) return normalized
  return 'other'
}

function sanitizeCustomCategoryName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null

  const cleaned = raw
    .trim()
    .replace(/^['"`]+|['"`]+$/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[=+\-@]+/, '')
    .trim()
    .slice(0, 40)
    .trim()

  if (!cleaned) return null
  return cleaned
}

export async function suggestCategory(description: string, model?: string): Promise<SuggestedCategory> {
  if (!description.trim()) {
    return {
      category: 'other',
      shouldCreateCustomCategory: false,
    }
  }

  const result = await postAi<SuggestCategoryResponse>('suggestCategory', { description, model })

  if (result.shouldCreateCustomCategory) {
    const customCategoryName = sanitizeCustomCategoryName(result.customCategoryName ?? result.category)
    if (customCategoryName) {
      return {
        category: customCategoryName,
        shouldCreateCustomCategory: true,
        customCategoryName,
      }
    }
  }

  return {
    category: toCategoryOrOther(result.category),
    shouldCreateCustomCategory: false,
  }
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
  model?: string,
  savingsContext?: AiSavingsContext
): Promise<string> {
  const result = await postAi<InsightsResponse>('insights', {
    expenses,
    incomes,
    subscriptions,
    monthlySavings,
    language,
    currency,
    model,
    savingsContext,
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
  model?: string,
  savingsContext?: AiSavingsContext
): AsyncGenerator<string> {
  const result = await postAi<ChatResponse>('chat', {
    message,
    expenses,
    language,
    incomes,
    subscriptions,
    monthlySavings,
    model,
    savingsContext,
  })
  if (result.message) {
    yield result.message
  }
}
