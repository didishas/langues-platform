import { structuredCommunicationFor } from '../structuredCommunication'
import { addDays, computeTotals, formatInvoiceNumber, toLines } from '../totals'
import type { BillingProvider, PaymentGateway } from '../types'

/**
 * Phase 1 : Catherine est indépendante et facture elle-même.
 * Numérotation propre et continue, communication structurée pour le virement,
 * paiement en ligne via la passerelle injectée (Mollie) si activé dans le CMS,
 * Peppol pour les clients entreprises, PDF pour les particuliers.
 */
export function createDirectProvider(gateway: PaymentGateway | null): BillingProvider {
  return {
    id: 'direct',

    supportsOnlinePayment(settings) {
      return settings.onlinePayments && gateway !== null
    },

    prepareInvoice({ customer, prestations, issueDate, sequence }, settings) {
      if (prestations.length === 0) throw new Error('Aucune prestation à facturer')
      const year = Number(issueDate.slice(0, 4))
      const lines = toLines(prestations)
      const totals = computeTotals(lines, settings)
      return {
        provider: 'direct',
        number: sequence === null ? null : formatInvoiceNumber(settings.invoicePrefix, year, sequence),
        customer,
        lines,
        ...totals,
        vatMention: settings.vatRegime === 'standard' ? null : (settings.vatMention ?? null),
        issueDate,
        dueDate: addDays(issueDate, settings.paymentTermDays),
        structuredCommunication: sequence === null ? null : structuredCommunicationFor(year, sequence),
        delivery: customer.kind === 'business' ? 'peppol' : 'pdf',
        status: 'to_validate',
      }
    },

    async requestPayment(invoice, settings, context) {
      if (!this.supportsOnlinePayment(settings) || !gateway) return null
      if (!invoice.number) throw new Error('Facture sans numéro')
      return gateway.createPayment({
        amountCents: invoice.totalCents,
        description: `Facture ${invoice.number}`,
        reference: invoice.number,
        redirectUrl: context.redirectUrl,
        webhookUrl: context.webhookUrl,
      })
    },

    async getPaymentStatus(paymentId) {
      return gateway ? gateway.getStatus(paymentId) : null
    },
  }
}
