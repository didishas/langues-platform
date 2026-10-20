/**
 * Heures des séances pour les élèves qui vivent ailleurs qu'en Belgique (Israël, Roumanie…).
 * Catherine donne cours à l'heure de Bruxelles ; l'élève voit d'abord son heure, puis celle de Bruxelles.
 * Fonctions pures (pas de base de données), utilisables partout.
 */
import type { Locale } from '@/i18n/config'
import { fill } from '@/i18n/format'

export const BRUSSELS = 'Europe/Brussels'

const TAG: Record<Locale, string> = { fr: 'fr-BE', en: 'en-GB', he: 'he-IL' }

/** Vrai pour un fuseau IANA connu du système (« Asia/Jerusalem »). */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.length === 0 || tz.length > 64) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Fuseau d'affichage d'un élève : le sien s'il est valide, sinon Bruxelles. */
export const studentTimeZone = (tz: string | null | undefined): string => (isValidTimeZone(tz) ? tz : BRUSSELS)

const dayKey = (d: Date, tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, dateStyle: 'short' }).format(d)
const clock = (d: Date, tz: string, locale: Locale) =>
  new Intl.DateTimeFormat(TAG[locale], { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(d)

/**
 * « mardi 21 octobre 2026 à 18:00 (heure d’Israël) » et « Bruxelles : 17:00 ».
 * Si l'heure est la même qu'à Bruxelles à cet instant (élève en Belgique, en France…), une seule heure.
 * `brusselsTemplate` vient des textes de l'interface : « Bruxelles : {time} ».
 */
export function formatSessionTime(
  iso: string | Date,
  locale: Locale,
  tz: string | null | undefined,
  brusselsTemplate: string,
): { local: string; brussels: string | null } {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const zone = studentTimeZone(tz)
  const sameAsBrussels = clock(d, zone, locale) === clock(d, BRUSSELS, locale) && dayKey(d, zone) === dayKey(d, BRUSSELS)
  const local = new Intl.DateTimeFormat(TAG[locale], {
    timeZone: zone,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(d)
  if (sameAsBrussels) return { local, brussels: null }

  const zoneName =
    new Intl.DateTimeFormat(TAG[locale], { timeZone: zone, timeZoneName: 'longGeneric' })
      .formatToParts(d)
      .find((p) => p.type === 'timeZoneName')?.value ?? zone
  const brusselsTime =
    dayKey(d, zone) === dayKey(d, BRUSSELS)
      ? clock(d, BRUSSELS, locale)
      : new Intl.DateTimeFormat(TAG[locale], { timeZone: BRUSSELS, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(d)
  return { local: `${local} (${zoneName})`, brussels: fill(brusselsTemplate, { time: brusselsTime }) }
}
