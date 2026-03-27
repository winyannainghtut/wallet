type KeyMap = Record<string, string>

const EMPTY_MAP: KeyMap = {}

function parseKeyMap(raw: string): KeyMap {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return EMPTY_MAP
    }

    const map: KeyMap = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof key !== 'string' || typeof value !== 'string') continue
      const trimmedKey = key.trim().toLowerCase()
      const trimmedValue = value.trim()
      if (!trimmedKey || !trimmedValue) continue
      map[trimmedKey] = trimmedValue
    }
    return map
  } catch {
    return EMPTY_MAP
  }
}

function getKeyMap(): KeyMap {
  const raw = process.env.ZAI_API_KEYS_JSON || '{}'
  return parseKeyMap(raw)
}

export function resolveUserZaiApiKey(userId: string, email?: string): string | null {
  const map = getKeyMap()
  const byId = map[userId.trim().toLowerCase()]
  if (byId) return byId

  const byEmail = email ? map[email.trim().toLowerCase()] : undefined
  if (byEmail) return byEmail

  const fallback = process.env.ZAI_API_KEY?.trim()
  if (fallback) return fallback

  return null
}
