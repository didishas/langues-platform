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

/** Passerelle de paiement configurée par l'environnement, ou `null` si aucune clé Mollie n'est définie. */
export function getConfiguredGateway(): PaymentGateway | null {
  const key = process.env.MOLLIE_API_KEY
  return key ? createMollieGateway(key, { baseUrl: process.env.MOLLIE_API_BASE_URL || undefined }) : null
}

/**
 * Fournisseur direct avec la passerelle configurée, quel que soit le fournisseur actif :
 * un paiement d'une facture de la phase 1 doit pouvoir être vérifié même après la bascule vers Smart.
 */
export function getDirectProviderForPayments(gateway: PaymentGateway | null = getConfiguredGateway()): BillingProvider {
  return createDirectProvider(gateway)
}

export function getBillingProvider(
  settings: BillingSettings,
  options: { at?: Date; gateway?: PaymentGateway | null } = {},
): BillingProvider {
  if (resolveProviderId(settings, options.at) === 'smart') return smartProvider
  const gateway = options.gateway !== undefined ? options.gateway : getConfiguredGateway()
  return createDirectProvider(gateway)
}
