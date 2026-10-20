import { describe, expect, it } from 'vitest'

import { formatSessionTime, isValidTimeZone, studentTimeZone } from '@/lib/time'

const FR = 'Bruxelles : {time}'

describe('heure des séances selon le fuseau de l’élève', () => {
  it('élève en Belgique ou en France : une seule heure', () => {
    expect(formatSessionTime('2026-07-01T15:00:00Z', 'fr', 'Europe/Brussels', FR)).toEqual({
      local: 'mercredi 1 juillet 2026 à 17:00',
      brussels: null,
    })
    expect(formatSessionTime('2026-07-01T15:00:00Z', 'fr', 'Europe/Paris', FR).brussels).toBeNull()
    // Sans fuseau connu : Bruxelles.
    expect(formatSessionTime('2026-07-01T15:00:00Z', 'fr', null, FR).brussels).toBeNull()
  })

  it('élève en Israël : son heure d’abord, puis celle de Bruxelles, été comme hiver', () => {
    expect(formatSessionTime('2026-07-01T15:00:00Z', 'fr', 'Asia/Jerusalem', FR)).toEqual({
      local: 'mercredi 1 juillet 2026 à 18:00 (heure d’Israël)',
      brussels: 'Bruxelles : 17:00',
    })
    expect(formatSessionTime('2026-01-15T16:00:00Z', 'fr', 'Asia/Jerusalem', FR).brussels).toBe('Bruxelles : 17:00')
    const he = formatSessionTime('2026-01-15T16:00:00Z', 'he', 'Asia/Jerusalem', 'בריסל: {time}')
    expect(he.local).toContain('18:00')
    expect(he.local).toContain('שעון ישראל')
  })

  it('élève en Roumanie : toujours une heure de plus, même la nuit du changement d’heure', () => {
    // 25/10/2026 : passage à l'heure d'hiver à 01:00 UTC en Belgique comme en Roumanie.
    const before = formatSessionTime('2026-10-25T00:30:00Z', 'fr', 'Europe/Bucharest', FR)
    const after = formatSessionTime('2026-10-25T01:30:00Z', 'fr', 'Europe/Bucharest', FR)
    expect(before.local).toContain('03:30')
    expect(before.brussels).toBe('Bruxelles : 02:30')
    expect(after.local).toContain('03:30')
    expect(after.brussels).toBe('Bruxelles : 02:30')
  })

  it('jour différent : la date de Bruxelles est écrite en entier', () => {
    const r = formatSessionTime('2026-01-15T22:30:00Z', 'fr', 'Asia/Jerusalem', FR)
    expect(r.local).toContain('vendredi 16 janvier 2026 à 00:30')
    expect(r.brussels).toBe('Bruxelles : jeudi 15 janvier à 23:30')
  })

  it('refuse un fuseau inconnu', () => {
    expect(isValidTimeZone('Asia/Jerusalem')).toBe(true)
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
    expect(studentTimeZone('n’importe quoi')).toBe('Europe/Brussels')
  })
})
