import { NextRequest, NextResponse } from 'next/server'
import type { AppSettings, CustomCategory } from '@/types'
import { createPbServer } from '@/lib/pb'
import { normalizeAppSettings } from '@/lib/settings'

type PocketBaseLikeError = {
  status?: number
  message?: string
}

type PreferencesRecord = {
  id: string
  user?: string
  language?: string
  currency?: string
  currencySign?: string
  aiModel?: string
  theme?: string
  customCategories?: string
  chatHistory?: string
}

type PreferenceChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string | Date
}

type PreferencesResponse = {
  exists: boolean
  settings: AppSettings
  customCategories: CustomCategory[]
  chatHistory: PreferenceChatMessage[]
}

type PreferencesInput = {
  settings?: Partial<AppSettings>
  customCategories?: unknown
  chatHistory?: unknown
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

function isMissingCollectionContext(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const status = 'status' in error ? (error as PocketBaseLikeError).status : undefined
  const message = 'message' in error ? (error as PocketBaseLikeError).message : undefined
  return status === 404 && typeof message === 'string' && message.toLowerCase().includes('collection context')
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && (error as PocketBaseLikeError).status === 404
}

function getAuthenticatedPb(request: NextRequest):
  | { pb: ReturnType<typeof createPbServer>; userId: string }
  | { error: NextResponse } {
  const authCookie = request.cookies.get('pb_auth')?.value
  const pb = createPbServer(authCookie)

  if (!pb.authStore.isValid || !pb.authStore.model) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  return { pb, userId: pb.authStore.model.id }
}

function stripUndefined(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined))
}

function hasOwn<T extends object>(obj: T, key: keyof T): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function sanitizeCustomCategory(item: unknown): CustomCategory | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const raw = item as Partial<CustomCategory>
  const id = typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id.trim() : null
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  const type = raw.type === 'income' ? 'income' : raw.type === 'expense' ? 'expense' : null
  const icon = typeof raw.icon === 'string' && raw.icon.trim().length > 0 ? raw.icon.trim() : undefined
  const color = typeof raw.color === 'string' && raw.color.trim().length > 0 ? raw.color.trim() : undefined

  if (!id || !name || !type) {
    return null
  }

  return {
    id,
    name: name.slice(0, 40),
    type,
    icon,
    color,
  }
}

function parseCustomCategories(value: unknown): CustomCategory[] {
  const raw = typeof value === 'string' ? safeJsonParse(value) : value
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map(sanitizeCustomCategory)
    .filter((item): item is CustomCategory => item !== null)
}

function sanitizeChatMessage(item: unknown): PreferenceChatMessage | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const raw = item as Partial<PreferenceChatMessage>
  const id = typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id.trim() : null
  const role = raw.role === 'assistant' ? 'assistant' : raw.role === 'user' ? 'user' : null
  const content = typeof raw.content === 'string' ? raw.content.trim() : ''
  const timestamp = raw.timestamp instanceof Date
    ? raw.timestamp.toISOString()
    : typeof raw.timestamp === 'string' && raw.timestamp.trim().length > 0
      ? raw.timestamp.trim()
      : null

  if (!id || !role || !content || !timestamp) {
    return null
  }

  return {
    id,
    role,
    content: content.slice(0, 4000),
    timestamp,
  }
}

function parseChatHistory(value: unknown): PreferenceChatMessage[] {
  const raw = typeof value === 'string' ? safeJsonParse(value) : value
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map(sanitizeChatMessage)
    .filter((item): item is PreferenceChatMessage => item !== null)
    .slice(-100)
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function serializePreferences(record: PreferencesRecord | null): PreferencesResponse {
  return {
    exists: Boolean(record),
    settings: normalizeAppSettings(record ? {
      language: record.language === 'my' ? 'my' : record.language === 'en' ? 'en' : undefined,
      currency: record.currency,
      currencySign: record.currencySign,
      aiModel: record.aiModel as AppSettings['aiModel'],
      theme: record.theme as AppSettings['theme'],
    } : undefined),
    customCategories: parseCustomCategories(record?.customCategories),
    chatHistory: parseChatHistory(record?.chatHistory),
  }
}

async function getPreferencesRecord(
  pb: ReturnType<typeof createPbServer>,
  userId: string
): Promise<PreferencesRecord | null> {
  try {
    return await pb.collection('user_preferences').getFirstListItem(`user = "${userId}"`) as PreferencesRecord
  } catch (error) {
    if (isNotFoundError(error)) {
      return null
    }

    throw error
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) {
      return auth.error
    }

    const { pb, userId } = auth
    const record = await getPreferencesRecord(pb, userId)
    return NextResponse.json(serializePreferences(record))
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'User preferences collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Get user preferences error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch user preferences') },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = getAuthenticatedPb(request)
    if ('error' in auth) {
      return auth.error
    }

    const { pb, userId } = auth
    const body = (await request.json()) as PreferencesInput
    const existing = await getPreferencesRecord(pb, userId)
    const current = serializePreferences(existing)

    const nextSettings = body.settings
      ? normalizeAppSettings({ ...current.settings, ...body.settings })
      : current.settings
    const nextCustomCategories = body.customCategories !== undefined
      ? parseCustomCategories(body.customCategories)
      : current.customCategories
    const nextChatHistory = body.chatHistory !== undefined
      ? parseChatHistory(body.chatHistory)
      : current.chatHistory

    const payload = stripUndefined({
      user: userId,
      ...(body.settings && hasOwn(body.settings, 'language') ? { language: nextSettings.language } : {}),
      ...(body.settings && hasOwn(body.settings, 'currency') ? { currency: nextSettings.currency } : {}),
      ...(body.settings && hasOwn(body.settings, 'currencySign') ? { currencySign: nextSettings.currencySign } : {}),
      ...(body.settings && hasOwn(body.settings, 'aiModel') ? { aiModel: nextSettings.aiModel } : {}),
      ...(body.settings && hasOwn(body.settings, 'theme') ? { theme: nextSettings.theme } : {}),
      ...(body.customCategories !== undefined ? { customCategories: JSON.stringify(nextCustomCategories) } : {}),
      ...(body.chatHistory !== undefined ? { chatHistory: JSON.stringify(nextChatHistory) } : {}),
    })

    if (existing) {
      await pb.collection('user_preferences').update(existing.id, payload)
    } else {
      await pb.collection('user_preferences').create(payload)
    }

    const storedRecord = await getPreferencesRecord(pb, userId)

    return NextResponse.json(serializePreferences(storedRecord))
  } catch (error: unknown) {
    if (isMissingCollectionContext(error)) {
      return NextResponse.json(
        { error: 'User preferences collection is missing. Apply latest PocketBase migrations.' },
        { status: 503 }
      )
    }

    console.error('Update user preferences error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to update user preferences') },
      { status: 500 }
    )
  }
}
