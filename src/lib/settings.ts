import type { AppSettings } from '@/types'

export const DEFAULT_APP_SETTINGS: AppSettings = {
  language: 'en',
  currency: 'SGD',
  aiModel: 'glm-5',
  theme: 'dark',
}

const VALID_AI_MODELS = new Set(['glm-4.7', 'glm-5'])
const VALID_THEMES = new Set(['dark', 'light', 'blossom', 'glowing-horizon'])

export function normalizeLanguage(value: unknown): AppSettings['language'] {
  return value === 'my' ? 'my' : 'en'
}

export function normalizeCurrency(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return DEFAULT_APP_SETTINGS.currency
  }

  const normalized = value.trim().toUpperCase()
  if (normalized === 'MMK') {
    return DEFAULT_APP_SETTINGS.currency
  }

  return normalized
}

export function normalizeAiModel(value: unknown): AppSettings['aiModel'] {
  if (value === 'glm-5-turbo') {
    return 'glm-5'
  }

  if (typeof value === 'string' && VALID_AI_MODELS.has(value)) {
    return value as AppSettings['aiModel']
  }

  return DEFAULT_APP_SETTINGS.aiModel
}

export function normalizeTheme(value: unknown): AppSettings['theme'] {
  if (typeof value === 'string' && VALID_THEMES.has(value)) {
    return value as AppSettings['theme']
  }

  return DEFAULT_APP_SETTINGS.theme
}

export function normalizeAppSettings(input?: Partial<AppSettings> | null): AppSettings {
  return {
    language: normalizeLanguage(input?.language),
    currency: normalizeCurrency(input?.currency),
    aiModel: normalizeAiModel(input?.aiModel),
    theme: normalizeTheme(input?.theme),
  }
}

export function hasCustomAppSettings(settings: AppSettings): boolean {
  return (
    settings.language !== DEFAULT_APP_SETTINGS.language ||
    settings.currency !== DEFAULT_APP_SETTINGS.currency ||
    settings.aiModel !== DEFAULT_APP_SETTINGS.aiModel ||
    settings.theme !== DEFAULT_APP_SETTINGS.theme
  )
}
