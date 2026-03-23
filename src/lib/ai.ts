import { Category, CATEGORIES, CATEGORY_LABELS, Expense, Income, Subscription } from '@/types'

type ChatRole = 'system' | 'user' | 'assistant'

type ChatMessage = {
  role: ChatRole
  content: string
}

type ChatCompletionOptions = {
  temperature?: number
  maxTokens?: number
  disableThinking?: boolean
  model?: string
}

type ParsedExpense = {
  amount: number
  category: Category
  date: string
  description: string
}

const ZAI_ALLOWED_MODELS = ['glm-4.7', 'glm-5-turbo', 'glm-5'] as const
const ZAI_DEFAULT_MODEL = 'glm-4.7'
const ZAI_DEFAULT_BASE_URL = 'https://api.z.ai/api/coding/paas/v4'
const ZAI_BASE_URL = (process.env.ZAI_OPENAI_BASE_URL || process.env.NEXT_PUBLIC_ZAI_OPENAI_BASE_URL || ZAI_DEFAULT_BASE_URL).replace(/\/+$/, '')

export function isSupportedZaiModel(model: string): model is (typeof ZAI_ALLOWED_MODELS)[number] {
  return ZAI_ALLOWED_MODELS.includes(model as (typeof ZAI_ALLOWED_MODELS)[number])
}

export function resolveZaiModel(model?: string): string {
  const requested = model?.trim()
  if (requested && isSupportedZaiModel(requested)) {
    return requested
  }

  const envDefault = (process.env.AI_DEFAULT_MODEL || process.env.ZAI_MODEL || process.env.NEXT_PUBLIC_ZAI_MODEL || ZAI_DEFAULT_MODEL).trim()
  if (isSupportedZaiModel(envDefault)) {
    return envDefault
  }

  return ZAI_DEFAULT_MODEL
}

function normalizeContent(content: unknown): string {
  if (typeof content === 'string') return content

  if (Array.isArray(content)) {
    const textParts = content
      .map((part) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
          return part.text
        }
        return ''
      })
      .filter(Boolean)

    return textParts.join('')
  }

  return ''
}

function getZaiHeaders(apiKey: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
}

function extractZaiMessageText(payload: unknown): string {
  const data = payload as {
    choices?: Array<{
      message?: {
        content?: unknown
      }
      text?: unknown
    }>
    output_text?: unknown
  }

  const firstChoice = data?.choices?.[0]
  const content = normalizeContent(firstChoice?.message?.content)
  if (content.trim().length > 0) return content

  const choiceText = normalizeContent(firstChoice?.text)
  if (choiceText.trim().length > 0) return choiceText

  const outputText = normalizeContent(data?.output_text)
  if (outputText.trim().length > 0) return outputText

  return ''
}

function getAlternatePaaSBaseUrl(baseUrl: string): string | null {
  const normalized = baseUrl.replace(/\/+$/, '')
  const codingSuffix = '/api/coding/paas/v4'
  if (!normalized.endsWith(codingSuffix)) return null
  return `${normalized.slice(0, -codingSuffix.length)}/api/paas/v4`
}

async function requestZai(
  messages: ChatMessage[],
  apiKey: string,
  options: ChatCompletionOptions = {}
): Promise<string> {
  const model = resolveZaiModel(options.model)

  const basePayload: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 800,
    stream: false,
  }

  const shouldDisableThinking = options.disableThinking ?? true
  const payloadWithThinking = shouldDisableThinking
    ? { ...basePayload, thinking: { type: 'disabled' } }
    : basePayload
  let body = JSON.stringify(payloadWithThinking)

  let response = await fetch(`${ZAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: getZaiHeaders(apiKey),
    body,
  })

  // Some plans/models may not accept `thinking`; retry once without it.
  if (!response.ok && shouldDisableThinking && response.status === 400) {
    body = JSON.stringify(basePayload)
    response = await fetch(`${ZAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: getZaiHeaders(apiKey),
      body,
    })
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`Z.AI request failed (${response.status}): ${errText || response.statusText}`)
  }

  const data = await response.json()
  let text = extractZaiMessageText(data)

  if (text.trim().length === 0) {
    const alternateBaseUrl = getAlternatePaaSBaseUrl(ZAI_BASE_URL)
    if (alternateBaseUrl) {
      const retryResponse = await fetch(`${alternateBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: getZaiHeaders(apiKey),
        body,
      })

      if (retryResponse.ok) {
        const retryData = await retryResponse.json()
        text = extractZaiMessageText(retryData)
      }
    }
  }

  if (text.trim().length === 0) {
    throw new Error('Z.AI response returned no content')
  }

  return text.trim()
}

async function* streamZai(
  messages: ChatMessage[],
  apiKey: string,
  options: ChatCompletionOptions = {}
): AsyncGenerator<string> {
  const model = resolveZaiModel(options.model)

  const basePayload: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 1200,
    stream: true,
  }

  const shouldDisableThinking = options.disableThinking ?? true
  const payloadWithThinking = shouldDisableThinking
    ? { ...basePayload, thinking: { type: 'disabled' } }
    : basePayload
  let body = JSON.stringify(payloadWithThinking)

  let response = await fetch(`${ZAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: getZaiHeaders(apiKey),
    body,
  })

  if (!response.ok && shouldDisableThinking && response.status === 400) {
    body = JSON.stringify(basePayload)
    response = await fetch(`${ZAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: getZaiHeaders(apiKey),
      body,
    })
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`Z.AI stream failed (${response.status}): ${errText || response.statusText}`)
  }

  if (!response.body) {
    throw new Error('Z.AI stream failed: empty response body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() || ''

      for (const event of events) {
        for (const line of event.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue

          const payload = trimmed.slice(5).trim()
          if (!payload) continue
          if (payload === '[DONE]') return

          try {
            const parsed = JSON.parse(payload)
            const content = normalizeContent(parsed?.choices?.[0]?.delta?.content)
            if (content) yield content
          } catch {
            // Ignore malformed stream events.
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

async function requestChatCompletion(
  messages: ChatMessage[],
  apiKey: string,
  options: ChatCompletionOptions = {}
): Promise<string> {
  return requestZai(messages, apiKey, options)
}

async function* streamChatCompletion(
  messages: ChatMessage[],
  apiKey: string,
  options: ChatCompletionOptions = {}
): AsyncGenerator<string> {
  for await (const chunk of streamZai(messages, apiKey, options)) {
    yield chunk
  }
}

function toCategoryOrOther(raw: string): Category {
  const normalized = raw.trim().toLowerCase()
  if ((CATEGORIES as readonly string[]).includes(normalized)) return normalized

  for (const category of CATEGORIES) {
    if (normalized.includes(category) || category.includes(normalized)) {
      return category
    }
  }

  return 'other'
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced?.[1]?.trim() || trimmed
}

function extractBalancedJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null

  let inString = false
  let escaping = false
  let depth = 0

  for (let i = start; i < text.length; i++) {
    const char = text[i]

    if (inString) {
      if (escaping) {
        escaping = false
      } else if (char === '\\') {
        escaping = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') depth++
    if (char === '}') {
      depth--
      if (depth === 0) {
        return text.slice(start, i + 1)
      }
    }
  }

  // If model response got truncated, try closing missing braces.
  if (depth > 0) {
    return `${text.slice(start)}${'}'.repeat(depth)}`
  }

  return null
}

function tryParseExpenseJson(raw: string): Partial<ParsedExpense> | null {
  const cleaned = stripCodeFence(raw)
  const candidates = [cleaned]
  const extracted = extractBalancedJsonObject(cleaned)
  if (extracted && extracted !== cleaned) {
    candidates.push(extracted)
  }

  for (const candidate of candidates) {
    const sanitized = candidate
      .trim()
      .replace(/,\s*([}\]])/g, '$1')

    if (!sanitized) continue

    try {
      return JSON.parse(sanitized) as Partial<ParsedExpense>
    } catch {
      // Try next candidate.
    }
  }

  return null
}

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null

  const normalized = value.replace(/[^0-9.-]/g, '')
  if (!normalized) return null
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeDate(value: unknown, fallbackDate: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallbackDate
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return fallbackDate
  return parsed.toISOString().slice(0, 10)
}

function normalizeParsedExpense(
  input: Partial<ParsedExpense> | null,
  rawText: string,
  fallbackDate: string
): ParsedExpense | null {
  if (!input) return null

  const amount = parseAmount(input.amount)
  if (amount === null) return null

  const date = normalizeDate(input.date, fallbackDate)
  const category = toCategoryOrOther(String(input.category || 'other'))
  const description = typeof input.description === 'string' && input.description.trim()
    ? input.description.trim()
    : rawText.trim()

  return {
    amount,
    category,
    date,
    description,
  }
}

function inferCategoryFromText(text: string): Category {
  const lower = text.toLowerCase()
  if (/\bbreakfast\b|\bmorning\b/.test(lower)) return 'breakfast'
  if (/\blunch\b|\bnoon\b/.test(lower)) return 'lunch'
  if (/\bdinner\b|\bsupper\b|\bnight meal\b/.test(lower)) return 'dinner'
  if (/\bbus\b|\btaxi\b|\bgrab\b|\buber\b|\btrain\b|\btransport/.test(lower)) return 'transportation'
  if (/\bgrocery\b|\bsupermarket\b|\bmart\b/.test(lower)) return 'groceries'
  if (/\bshop\b|\bshopping\b/.test(lower)) return 'shopping'
  if (/\bmovie\b|\bnetflix\b|\bgame\b|\bconcert\b/.test(lower)) return 'entertainment'
  if (/\bdoctor\b|\bclinic\b|\bpharmacy\b|\bmedicine\b|\bhospital\b/.test(lower)) return 'health'
  if (/\bschool\b|\btuition\b|\bcourse\b|\bbook\b/.test(lower)) return 'education'
  if (/\binsurance\b/.test(lower)) return 'insurance'
  if (/\bdonation\b|\bcharity\b/.test(lower)) return 'donations'
  if (/\belectric\b|\bwater bill\b|\butility\b|\binternet bill\b/.test(lower)) return 'utilities'
  return 'other'
}

function parseExpenseTextHeuristic(text: string, fallbackDate: string): ParsedExpense | null {
  const lower = text.toLowerCase()
  const amountMatch = text.match(/-?\d[\d,]*(?:\.\d+)?/)
  if (!amountMatch) return null

  const amount = parseAmount(amountMatch[0])
  if (amount === null) return null

  let date = fallbackDate
  if (/\byesterday\b/.test(lower)) {
    const d = new Date(`${fallbackDate}T00:00:00`)
    d.setDate(d.getDate() - 1)
    date = d.toISOString().slice(0, 10)
  } else if (/\btoday\b/.test(lower)) {
    date = fallbackDate
  } else {
    const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/)
    if (isoMatch?.[1]) date = isoMatch[1]
  }

  return {
    amount,
    category: inferCategoryFromText(text),
    date,
    description: text.trim(),
  }
}

export async function suggestCategory(description: string, apiKey: string, model?: string): Promise<Category> {
  if (!apiKey) throw new Error('API key required')
  if (!description.trim()) return 'other'

  const prompt = `You categorize expenses.
Return exactly one category from this list:
${CATEGORIES.join(', ')}

Description: "${description}"
Output rules:
- Return only the category name in lowercase.
- No extra words or punctuation.`

  try {
    const response = await requestChatCompletion(
      [{ role: 'user', content: prompt }],
      apiKey,
      { temperature: 0, model }
    )

    return toCategoryOrOther(response || 'other')
  } catch (error) {
    console.error('Error suggesting category:', error)
    return 'other'
  }
}

export async function getSpendingInsights(
  expenses: Expense[],
  incomes: Income[],
  subscriptions: Subscription[],
  monthlySavings: number,
  apiKey: string,
  language: 'en' | 'my' = 'en',
  currency = 'SGD',
  model?: string
): Promise<string> {
  if (!apiKey) throw new Error('API key required')
  if (expenses.length === 0 && incomes.length === 0) return 'No financial data yet'

  const totalByCategory: Record<string, number> = {}
  expenses.forEach((expense) => {
    totalByCategory[expense.category] = (totalByCategory[expense.category] || 0) + expense.amount
  })

  const currencyCode = currency.trim() || 'SGD'

  const expenseSummary = Object.entries(totalByCategory)
    .map(([category, total]) => `${CATEGORY_LABELS[category as Category][language]}: ${total.toLocaleString()} ${currencyCode}`)
    .join('\n')

  const totalExpense = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const totalIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0)
  const activeSubs = subscriptions.filter(s => s.isActive).map(s => `${s.name}: ${s.amount}/${s.billingCycle}`).join(', ')

  const prompt = `You are a practical financial advisor for an expense tracking app in Myanmar.
Analyze the user's financial summary and provide concise, actionable advice focusing on cash flow, savings, and expense categories.

CRITICAL RULE:
- You MUST respond in Myanmar (Burmese) language ONLY. Do not use English.

Currency code is ${currencyCode}. All amounts are in ${currencyCode}.
Output requirements:
- Return only the final advice text in Myanmar language.
- Do not include analysis steps, reasoning, labels, markdown, bullet points, or numbering.
- Write 3-4 complete sentences summarizing their financial health and providing a tip.

Financial Summary:
- Total Income: ${totalIncome.toLocaleString()} ${currencyCode}
- Total Expense: ${totalExpense.toLocaleString()} ${currencyCode}
- Net Monthly Savings: ${monthlySavings.toLocaleString()} ${currencyCode}
- Active Subscriptions: ${activeSubs || 'None'}

Expenses by Category:
${expenseSummary || 'None'}`

  try {
    const response = await requestChatCompletion(
      [{ role: 'user', content: prompt }],
      apiKey,
      { temperature: 0.2, maxTokens: 1500, disableThinking: true, model }
    )

    return response || 'Unable to generate insights'
  } catch (error) {
    console.error('Error getting insights:', error)
    throw error
  }
}

export async function* streamChatAboutExpenses(
  message: string,
  expenses: Expense[],
  apiKey: string,
  language: 'en' | 'my' = 'en',
  incomes: import('@/types').Income[] = [],
  subscriptions: import('@/types').Subscription[] = [],
  monthlySavings: number = 0,
  model?: string
): AsyncGenerator<string> {
  if (!apiKey) throw new Error('API key required')

  const recentExpenses = expenses
    .slice(0, 20)
    .map((expense) => `${expense.date}: ${CATEGORY_LABELS[expense.category][language]} - ${expense.amount} (${expense.description || 'n/a'})`)
    .join('\n')

  const recentIncomes = incomes
    .slice(0, 10)
    .map((inc) => `${inc.date}: ${inc.category} - ${inc.amount} (${inc.description || 'n/a'})`)
    .join('\n')

  const totalByCategory: Record<string, number> = {}
  expenses.forEach((expense) => {
    totalByCategory[expense.category] = (totalByCategory[expense.category] || 0) + expense.amount
  })

  const categorySummary = Object.entries(totalByCategory)
    .map(([category, total]) => `${CATEGORY_LABELS[category as Category][language]}: ${total}`)
    .join(', ')

  const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const totalIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0)
  const activeSubs = subscriptions.filter(s => s.isActive).map(s => `${s.name}: ${s.amount}/${s.billingCycle}`).join(', ')

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a financial assistant for a personal finance app.
Rules:
1) Always respond in Myanmar (Burmese) language.
2) Answer only finance-related questions (expenses, incomes, budgeting, subscriptions, savings).
3) If user asks unrelated topics, politely decline in Myanmar.
4) Keep response concise and actionable.
5) Use provided financial context.`,
    },
    {
      role: 'user',
      content: `Financial context:
- Total spent (all time): ${totalSpent}
- Total income (all time): ${totalIncome}
- Current Monthly Savings: ${monthlySavings}
- Active Subscriptions: ${activeSubs || 'None'}
- Expenses by category: ${categorySummary || 'No expenses yet'}

Recent expenses:
${recentExpenses || 'No expenses yet'}

Recent incomes:
${recentIncomes || 'No incomes yet'}

User question:
${message}`,
    },
  ]

  try {
    for await (const chunk of streamChatCompletion(messages, apiKey, { temperature: 0.5, maxTokens: 1200, model })) {
      yield chunk
    }
  } catch (streamError) {
    const fallback = await requestChatCompletion(messages, apiKey, { temperature: 0.5, maxTokens: 1200, model })
    if (fallback) yield fallback
    else throw streamError
  }
}

export async function parseExpenseText(text: string, apiKey: string, model?: string): Promise<ParsedExpense | null> {
  if (!apiKey) throw new Error('API key required')
  if (!text.trim()) return null

  const today = new Date().toISOString().split('T')[0]

  const prompt = `Extract structured expense data from this user input.
If no explicit date is mentioned, use today's date (${today}).
If "yesterday" is mentioned, use the date for yesterday.
Category must be one of: ${CATEGORIES.join(', ')}.
Amount must be a number only (strip currency signs and commas).

Text:
"${text}"

Return raw JSON only (no markdown), in this exact shape:
{
  "amount": 12.34,
  "category": "groceries",
  "date": "YYYY-MM-DD",
  "description": "short description"
}`

  try {
    const response = await requestChatCompletion(
      [{ role: 'user', content: prompt }],
      apiKey,
      { temperature: 0.1, maxTokens: 300, model }
    )

    let normalized = normalizeParsedExpense(tryParseExpenseJson(response), text, today)
    if (normalized) return normalized

    if (!normalized) {
      // Retry once with stricter instruction when initial output is malformed/truncated.
      const retryResponse = await requestChatCompletion(
        [{
          role: 'user',
          content: `${prompt}

IMPORTANT:
- Return only valid JSON.
- Do not add markdown, explanation, or trailing text.
- Ensure braces and quotes are complete.`,
        }],
        apiKey,
        { temperature: 0, maxTokens: 300, model }
      )
      normalized = normalizeParsedExpense(tryParseExpenseJson(retryResponse), text, today)
      if (normalized) return normalized
    }

    // Final fallback: local heuristic parser for simple natural language.
    return parseExpenseTextHeuristic(text, today)
  } catch {
    return parseExpenseTextHeuristic(text, today)
  }
}
