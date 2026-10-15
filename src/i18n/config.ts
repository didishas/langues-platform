export const LOCALES = [
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'he', label: 'עברית', dir: 'rtl' },
] as const

export type Locale = (typeof LOCALES)[number]['code']
export type Direction = 'ltr' | 'rtl'

export const DEFAULT_LOCALE: Locale = 'fr'

export const isLocale = (value: string): value is Locale => LOCALES.some((l) => l.code === value)

/** Sens d'écriture de l'interface, d'après la langue de l'interface. */
export const uiDir = (locale: Locale): Direction => (locale === 'he' ? 'rtl' : 'ltr')

const RTL_LANGUAGES = new Set(['he', 'ar', 'fa', 'yi'])

/**
 * Sens d'écriture d'un contenu, d'après la langue du contenu lui-même (règle du projet) :
 * une phrase en hébreu s'affiche de droite à gauche, même sur une page en français.
 */
export const contentDir = (languageCode: string | null | undefined): Direction =>
  languageCode && RTL_LANGUAGES.has(languageCode) ? 'rtl' : 'ltr'
