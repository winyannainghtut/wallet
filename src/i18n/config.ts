import en from './en.json'
import my from './my.json'

export const translations = {
  en,
  my,
}

export type Language = 'en' | 'my'

let currentLanguage: Language = 'en'

export function setLanguage(lang: Language) {
  currentLanguage = lang
}

export function getLanguage(): Language {
  return currentLanguage
}

export function t(key: string): string {
  const keys = key.split('.')
  let value: unknown = translations[currentLanguage]

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k]
    } else {
      // Fallback to English
      value = translations.en
      for (const k2 of keys) {
        if (value && typeof value === 'object' && k2 in value) {
          value = (value as Record<string, unknown>)[k2]
        } else {
          return key
        }
      }
      break
    }
  }

  return typeof value === 'string' ? value : key
}
