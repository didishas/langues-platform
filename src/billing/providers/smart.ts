import { addDays, toLines } from '../totals'
import type { BillingProvider, InvoiceDraft } from '../types'

/**
 * Phase 2 : l'activité passe par Smart. Smart émet la facture, applique la TVA,
 * encaisse et numérote. Le site prépare seulement la demande et en suit le statut.
 * Aucun paiement en ligne n'est proposé.
 */
export const smartProvider: BillingProvider = {
  id: 'smart',

  supportsOnlinePayment() {
    return false
  },

  prepareInvoice({ customer, prestations, issueDate }, settings) {
    if (prestations.length === 0) throw new Error('Aucune prestation à facturer')
    const lines = toLines(prestations)
    const subtotalCents = lines.reduce((sum, l) => sum + l.totalCents, 0)
    return {
      provider: 'smart',
      number: null,
      customer,
      lines,
      // Montants hors TVA : Smart applique son propre régime.
      subtotalCents,
      vatRatePercent: 0,
      vatCents: 0,
      totalCents: subtotalCents,
      vatMention: null,
      issueDate,
      dueDate: addDays(issueDate, settings.paymentTermDays),
      structuredCommunication: null,
      delivery: 'smart',
      status: 'to_validate',
    }
  },

  async requestPayment() {
    return null
  },

  async getPaymentStatus() {
    return null
  },
}

const csvCell = (value: string | number) => {
  const s = String(value)
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Export des demandes validées, une ligne par prestation, à reporter dans l'outil « Activité » de Smart.
 * Séparateur « ; » et montants en euros avec virgule, pour une ouverture directe dans un tableur belge.
 */
export function toSmartCsv(drafts: InvoiceDraft[]): string {
  const header = ['client', 'email', 'type_client', 'tva_client', 'date_prestation', 'description', 'quantite', 'prix_unitaire_eur', 'total_eur']
  const euros = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')
  const rows = drafts.flatMap((d) =>
    d.lines.map((l) =>
      [
        d.customer.name,
        d.customer.email,
        d.customer.kind === 'business' ? 'entreprise' : 'particulier',
        d.customer.vatNumber ?? '',
        l.date.slice(0, 10),
        l.description,
        l.quantity,
        euros(l.unitPriceCents),
        euros(l.totalCents),
      ]
        .map(csvCell)
        .join(';'),
    ),
  )
  return [header.join(';'), ...rows].join('\n')
}
