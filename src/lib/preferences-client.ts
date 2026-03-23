import type { AppSettings, CustomCategory } from '@/types'

export type PreferenceChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string | Date
}

export type UserPreferencesResponse = {
  exists: boolean
  settings: AppSettings
  customCategories: CustomCategory[]
  chatHistory: PreferenceChatMessage[]
}

export type UserPreferencesPatch = {
  settings?: Partial<AppSettings>
  customCategories?: CustomCategory[]
  chatHistory?: PreferenceChatMessage[]
}

type PreferencesError = {
  error?: string
}

async function parsePreferencesResponse(response: Response): Promise<UserPreferencesResponse> {
  if (!response.ok) {
    let message = 'Failed to load user preferences'
    try {
      const data = (await response.json()) as PreferencesError
      if (typeof data.error === 'string' && data.error.length > 0) {
        message = data.error
      }
    } catch {
      // ignore parse errors
    }

    throw new Error(message)
  }

  return await response.json() as UserPreferencesResponse
}

export async function fetchUserPreferences(): Promise<UserPreferencesResponse> {
  const response = await fetch('/api/preferences')
  return parsePreferencesResponse(response)
}

export async function updateUserPreferences(patch: UserPreferencesPatch): Promise<UserPreferencesResponse> {
  const response = await fetch('/api/preferences', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  })

  return parsePreferencesResponse(response)
}
