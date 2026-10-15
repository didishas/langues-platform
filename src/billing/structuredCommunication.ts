/**
 * Communication structurée belge (OGM/VCS) : 10 chiffres + 2 chiffres de contrôle (modulo 97),
 * affichée sous la forme +++123/4567/89002+++.
 */

export function checkDigits(base: string): string {
  if (!/^\d{10}$/.test(base)) {
    throw new Error('La base doit contenir exactement 10 chiffres')
  }
  const rest = Number(BigInt(base) % 97n)
  return String(rest === 0 ? 97 : rest).padStart(2, '0')
}

export function formatStructuredCommunication(digits12: string): string {
  return `+++${digits12.slice(0, 3)}/${digits12.slice(3, 7)}/${digits12.slice(7)}+++`
}

/** Construit une communication à partir de l'année et du numéro d'ordre de la facture. */
export function structuredCommunicationFor(year: number, sequence: number): string {
  if (sequence < 1 || sequence > 999_999) {
    throw new Error("Numéro d'ordre hors limites")
  }
  const base = `${String(year).padStart(4, '0')}${String(sequence).padStart(6, '0')}`
  return formatStructuredCommunication(base + checkDigits(base))
}

export function isValidStructuredCommunication(value: string): boolean {
  const digits = value.replace(/[^\d]/g, '')
  if (digits.length !== 12) return false
  return checkDigits(digits.slice(0, 10)) === digits.slice(10)
}
