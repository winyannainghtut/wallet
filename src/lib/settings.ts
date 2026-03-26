import type { AppSettings } from '@/types'

export const DEFAULT_APP_SETTINGS: AppSettings = {
  language: 'en',
  currency: 'SGD',
  currencySign: 'SGD',
  aiModel: 'glm-5',
  theme: 'dark',
}

const VALID_AI_MODELS = new Set(['glm-4.7', 'glm-5', 'glm-5-turbo'])
const VALID_THEMES = new Set(['dark', 'light', 'blossom', 'glowing-horizon'])
const CURRENCY_SIGN_PRESETS: Record<string, string[]> = {
  SGD: ['SGD', 'S$', '$'],
  USD: ['USD', '$'],
  EUR: ['EUR', '\u20AC'],
  GBP: ['GBP', '\u00A3'],
  AUD: ['AUD', 'A$', '$'],
  CAD: ['CAD', 'C$', '$'],
  NZD: ['NZD', 'NZ$', '$'],
  JPY: ['JPY', '\u00A5'],
  CNY: ['CNY', 'CN\u00A5', '\u00A5'],
  HKD: ['HKD', 'HK$', '$'],
  MYR: ['MYR', 'RM'],
  THB: ['THB', '\u0E3F'],
  INR: ['INR', '\u20B9'],
  IDR: ['IDR', 'Rp'],
}

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

export function getCurrencySignOptions(currency: string): string[] {
  const normalizedCurrency = normalizeCurrency(currency)
  return Array.from(
    new Set([normalizedCurrency, ...(CURRENCY_SIGN_PRESETS[normalizedCurrency] || [])])
  )
}

export function getDefaultCurrencySign(currency: string): string {
  return getCurrencySignOptions(currency)[0] || normalizeCurrency(currency)
}

export function normalizeCurrencySign(value: unknown, currency: string): string {
  if (typeof value !== 'string') {
    return getDefaultCurrencySign(currency)
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return getDefaultCurrencySign(currency)
  }

  return trimmed.slice(0, 8)
}

export function normalizeAiModel(value: unknown): AppSettings['aiModel'] {
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
  const currency = normalizeCurrency(input?.currency)
  return {
    language: normalizeLanguage(input?.language),
    currency,
    currencySign: normalizeCurrencySign(input?.currencySign, currency),
    aiModel: normalizeAiModel(input?.aiModel),
    theme: normalizeTheme(input?.theme),
  }
}

export function getCurrencyDisplayLabel(settings: Pick<AppSettings, 'currency' | 'currencySign'>): string {
  return normalizeCurrencySign(settings.currencySign, settings.currency)
}

export function hasCustomAppSettings(settings: AppSettings): boolean {
  return (
    settings.language !== DEFAULT_APP_SETTINGS.language ||
    settings.currency !== DEFAULT_APP_SETTINGS.currency ||
    settings.currencySign !== DEFAULT_APP_SETTINGS.currencySign ||
    settings.aiModel !== DEFAULT_APP_SETTINGS.aiModel ||
    settings.theme !== DEFAULT_APP_SETTINGS.theme
  )
}
