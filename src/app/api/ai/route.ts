import { NextRequest, NextResponse } from 'next/server'
import type { AiSavingsContext, Expense, Income, Subscription } from '@/types'
import { createPbServer } from '@/lib/pb'
import { getSpendingInsights, parseExpenseText, resolveZaiModel, streamChatAboutExpenses, suggestCategory } from '@/lib/ai'
import { resolveUserZaiApiKey } from '@/lib/ai-secrets'

type AiAction = 'suggestCategory' | 'parseExpenseText' | 'insights' | 'chat'

type PocketBaseAuthModel = {
  id: string
  email?: string
}

type PocketBaseLikeError = {
  message?: string
}

type AiRequestBody = {
  action?: AiAction
  model?: string
  description?: string
  text?: string
  message?: string
  expenses?: Expense[]
  incomes?: Income[]
  subscriptions?: Subscription[]
  monthlySavings?: number
  savingsContext?: AiSavingsContext
  language?: 'en' | 'my'
  currency?: string
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as PocketBaseLikeError).message
    if (typeof message === 'string' && message.length > 0) {
      return message
    }
  }
  return fallback
}

function getAuthenticatedUser(request: NextRequest):
  | { userId: string; email?: string }
  | { error: NextResponse } {
  const authCookie = request.cookies.get('pb_auth')?.value
  const pb = createPbServer(authCookie)

  if (!pb.authStore.isValid || !pb.authStore.model) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const model = pb.authStore.model as unknown as PocketBaseAuthModel
  return { userId: model.id, email: model.email }
}

function normalizeModel(model?: string): string {
  return resolveZaiModel(model)
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthenticatedUser(request)
    if ('error' in auth) {
      return auth.error
    }

    const apiKey = resolveUserZaiApiKey(auth.userId, auth.email)
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'AI key is not configured for this user. Contact administrator.',
          code: 'AI_KEY_NOT_CONFIGURED',
        },
        { status: 503 }
      )
    }

    const body = (await request.json()) as AiRequestBody
    const action = body.action
    const model = normalizeModel(body.model)

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 })
    }

    if (action === 'suggestCategory') {
      if (!body.description || typeof body.description !== 'string') {
        return NextResponse.json({ error: 'description is required' }, { status: 400 })
      }
      const suggestion = await suggestCategory(body.description, apiKey, model)
      return NextResponse.json(suggestion)
    }

    if (action === 'parseExpenseText') {
      if (!body.text || typeof body.text !== 'string') {
        return NextResponse.json({ error: 'text is required' }, { status: 400 })
      }
      const parsed = await parseExpenseText(body.text, apiKey, model)
      return NextResponse.json({ parsed })
    }

    if (action === 'insights') {
      const expenses = Array.isArray(body.expenses) ? body.expenses : []
      const incomes = Array.isArray(body.incomes) ? body.incomes : []
      const subscriptions = Array.isArray(body.subscriptions) ? body.subscriptions : []
      const monthlySavings = typeof body.monthlySavings === 'number' ? body.monthlySavings : 0
      const savingsContext = body.savingsContext && typeof body.savingsContext === 'object'
        ? body.savingsContext
        : undefined
      const language = body.language === 'my' ? 'my' : 'en'
      const currency = typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim() : 'SGD'

      const insight = await getSpendingInsights(
        expenses,
        incomes,
        subscriptions,
        monthlySavings,
        apiKey,
        language,
        currency,
        model,
        savingsContext
      )
      return NextResponse.json({ insight })
    }

    if (action === 'chat') {
      if (!body.message || typeof body.message !== 'string') {
        return NextResponse.json({ error: 'message is required' }, { status: 400 })
      }

      const expenses = Array.isArray(body.expenses) ? body.expenses : []
      const incomes = Array.isArray(body.incomes) ? body.incomes : []
      const subscriptions = Array.isArray(body.subscriptions) ? body.subscriptions : []
      const monthlySavings = typeof body.monthlySavings === 'number' ? body.monthlySavings : 0
      const savingsContext = body.savingsContext && typeof body.savingsContext === 'object'
        ? body.savingsContext
        : undefined
      const language = body.language === 'my' ? 'my' : 'en'

      let message = ''
      for await (const chunk of streamChatAboutExpenses(
        body.message,
        expenses,
        apiKey,
        language,
        incomes,
        subscriptions,
        monthlySavings,
        model,
        savingsContext
      )) {
        message += chunk
      }

      return NextResponse.json({ message })
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  } catch (error: unknown) {
    console.error('AI route error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'AI request failed') },
      { status: 500 }
    )
  }
}
