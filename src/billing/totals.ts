import type { BillingSettings, InvoiceLine, PrestationInput } from './types'

export function toLines(prestations: PrestationInput[]): InvoiceLine[] {
  return prestations.map((p) => {
    if (!Number.isInteger(p.unitPriceCents) || p.unitPriceCents < 0) {
      throw new Error(`Prix invalide pour la prestation ${p.id}`)
    }
    if (!Number.isFinite(p.quantity) || p.quantity <= 0) {
      throw new Error(`Quantité invalide pour la prestation ${p.id}`)
    }
    const discountPercent = p.discountPercent ?? 0
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      throw new Error(`Remise invalide pour la prestation ${p.id}`)
    }
    return {
      prestationId: p.id,
      description: p.description,
      date: p.date,
      quantity: p.quantity,
      unitPriceCents: p.unitPriceCents,
      discountPercent,
      totalCents: Math.round((p.quantity * p.unitPriceCents * (100 - discountPercent)) / 100),
    }
  })
}

export function computeTotals(lines: InvoiceLine[], settings: BillingSettings) {
  const subtotalCents = lines.reduce((sum, l) => sum + l.totalCents, 0)
  const vatRatePercent = settings.vatRegime === 'standard' ? settings.vatRatePercent : 0
  const vatCents = Math.round((subtotalCents * vatRatePercent) / 100)
  return { subtotalCents, vatRatePercent, vatCents, totalCents: subtotalCents + vatCents }
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function formatInvoiceNumber(prefix: string, year: number, sequence: number): string {
  return `${prefix}${year}-${String(sequence).padStart(4, '0')}`
}
