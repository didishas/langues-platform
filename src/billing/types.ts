/**
 * Types de la couche de facturation.
 *
 * Règle du projet : aucun code métier hors de `src/billing/` ne connaît Mollie ou Smart.
 * Le reste du site manipule des prestations et des brouillons de facture génériques.
 */

export type ProviderId = 'direct' | 'smart'

/** franchise : régime de franchise des petites entreprises ; exempt : exonération ; standard : TVA appliquée. */
export type VatRegime = 'franchise' | 'exempt' | 'standard'

export interface BillingSettings {
  /** Fournisseur choisi dans le CMS. */
  activeProvider: ProviderId
  /** Date (ISO) à partir de laquelle `activeProvider: 'smart'` prend effet. Vide = immédiat. */
  switchDate?: string | null
  /** Préfixe de numérotation, ex. "F" donne F2026-0001. */
  invoicePrefix: string
  vatRegime: VatRegime
  /** Taux appliqué si `vatRegime` vaut `standard`, ex. 21. */
  vatRatePercent: number
  /** Mention légale imprimée sur la facture (franchise ou exonération), saisie dans le CMS. */
  vatMention?: string | null
  /** Délai de paiement en jours. */
  paymentTermDays: number
  /** Paiements en ligne activés dans le CMS (n'a d'effet qu'avec le fournisseur direct). */
  onlinePayments: boolean
}

export interface Customer {
  id: string
  name: string
  email: string
  kind: 'individual' | 'business'
  vatNumber?: string | null
}

export interface PrestationInput {
  id: string
  description: string
  /** Date de la prestation (ISO). */
  date: string
  quantity: number
  unitPriceCents: number
  /** Remise en pourcentage (réduction multi-langues, famille, 2e séance…), 0 par défaut. */
  discountPercent?: number
}

export interface InvoiceLine {
  prestationId: string
  description: string
  date: string
  quantity: number
  unitPriceCents: number
  discountPercent: number
  totalCents: number
}

/**
 * Brouillon produit par un fournisseur. Il arrive toujours au statut `to_validate` :
 * rien ne part sans la validation de la professeure.
 */
export interface InvoiceDraft {
  provider: ProviderId
  /** Numéro légal ; `null` avec Smart, qui numérote lui-même. */
  number: string | null
  customer: Customer
  lines: InvoiceLine[]
  subtotalCents: number
  vatRatePercent: number
  vatCents: number
  totalCents: number
  vatMention: string | null
  issueDate: string
  dueDate: string
  /** Communication structurée belge (+++xxx/xxxx/xxxxx+++), `null` avec Smart. */
  structuredCommunication: string | null
  /** Canal d'envoi une fois validée. */
  delivery: 'pdf' | 'peppol' | 'smart'
  status: 'to_validate'
}

export interface PrepareInvoiceInput {
  customer: Customer
  prestations: PrestationInput[]
  /** Date d'émission (ISO, jour). */
  issueDate: string
  /**
   * Numéro d'ordre de l'année, attribué uniquement à la validation (numérotation continue).
   * `null` pour un brouillon : ni numéro ni communication structurée.
   */
  sequence: number | null
}

export type PaymentStatus = 'open' | 'paid' | 'failed' | 'expired' | 'canceled'

/** Paiement tel que le prestataire le décrit, relu côté serveur. */
export interface PaymentInfo {
  id: string
  status: PaymentStatus
  amountCents: number | null
  currency: string | null
  /** Référence transmise à la création (numéro de facture). */
  reference: string | null
}

export interface PaymentRequest {
  paymentId: string
  checkoutUrl: string
}

/** Passerelle de paiement en ligne. Seule l'implémentation Mollie existe, dans `gateways/`. */
export interface PaymentGateway {
  createPayment(args: {
    amountCents: number
    description: string
    reference: string
    redirectUrl: string
    webhookUrl?: string
  }): Promise<PaymentRequest>
  getPayment(paymentId: string): Promise<PaymentInfo>
}

export interface PaymentContext {
  redirectUrl: string
  webhookUrl?: string
}

export interface BillingProvider {
  readonly id: ProviderId
  /** Le site peut-il proposer un paiement en ligne avec ce fournisseur et ces réglages ? */
  supportsOnlinePayment(settings: BillingSettings): boolean
  prepareInvoice(input: PrepareInvoiceInput, settings: BillingSettings): InvoiceDraft
  /** Crée une demande de paiement en ligne, ou `null` si ce fournisseur n'en propose pas. */
  requestPayment(
    invoice: Pick<InvoiceDraft, 'number' | 'totalCents' | 'structuredCommunication'>,
    settings: BillingSettings,
    context: PaymentContext,
  ): Promise<PaymentRequest | null>
  /** Paiement redemandé au prestataire (jamais lu depuis la notification ni l'URL de retour). */
  getPayment(paymentId: string): Promise<PaymentInfo | null>
}
