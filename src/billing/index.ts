import { createMollieGateway } from './gateways/mollie'
import { createDirectProvider } from './providers/direct'
import { smartProvider } from './providers/smart'
import type { BillingProvider, BillingSettings, PaymentGateway, ProviderId } from './types'

export * from './types'
export { toSmartCsv } from './providers/smart'
export { isValidStructuredCommunication, structuredCommunicationFor } from './structuredCommunication'

/**
 * Fournisseur réellement actif à une date donnée.
 * Smart ne prend effet qu'à partir de sa date de bascule : avant, on reste en facturation directe.
 */
export function resolveProviderId(settings: BillingSettings, at: Date = new Date()): ProviderId {
  if (settings.activeProvider !== 'smart') return 'direct'
  if (!settings.switchDate) return 'smart'
  return at.getTime() >= new Date(settings.switchDate).getTime() ? 'smart' : 'direct'
}

export function getBillingProvider(
  settings: BillingSettings,
  options: { at?: Date; gateway?: PaymentGateway | null } = {},
): BillingProvider {
  if (resolveProviderId(settings, options.at) === 'smart') return smartProvider
  const gateway =
    options.gateway !== undefined
      ? options.gateway
      : process.env.MOLLIE_API_KEY
        ? createMollieGateway(process.env.MOLLIE_API_KEY)
        : null
  return createDirectProvider(gateway)
}
