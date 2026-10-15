import { describe, expect, it, vi } from 'vitest'

import { getBillingProvider, resolveProviderId, toSmartCsv } from '@/billing'
import { createMollieGateway } from '@/billing/gateways/mollie'
import { createDirectProvider } from '@/billing/providers/direct'
import { smartProvider } from '@/billing/providers/smart'
import {
  checkDigits,
  isValidStructuredCommunication,
  structuredCommunicationFor,
} from '@/billing/structuredCommunication'
import type { BillingSettings, PaymentGateway, PrepareInvoiceInput } from '@/billing/types'

const settings: BillingSettings = {
  activeProvider: 'direct',
  switchDate: null,
  invoicePrefix: 'F',
  vatRegime: 'franchise',
  vatRatePercent: 21,
  vatMention: 'Régime particulier de franchise des petites entreprises',
  paymentTermDays: 15,
  onlinePayments: true,
}

const input: PrepareInvoiceInput = {
  customer: { id: 's1', name: 'Élève Test', email: 'eleve@example.com', kind: 'individual' },
  prestations: [
    { id: 'p1', description: 'Cours d’hébreu, 60 min', date: '2026-10-01', quantity: 1, unitPriceCents: 4000 },
    { id: 'p2', description: 'Cours d’hébreu, 60 min', date: '2026-10-08', quantity: 1, unitPriceCents: 4000 },
  ],
  issueDate: '2026-10-15',
  sequence: 7,
}

const fakeGateway = (): PaymentGateway => ({
  createPayment: vi.fn(async () => ({ paymentId: 'tr_1', checkoutUrl: 'https://pay.example/tr_1' })),
  getStatus: vi.fn(async () => 'paid' as const),
})

describe('communication structurée', () => {
  it('calcule le modulo 97 et remplace 0 par 97', () => {
    expect(checkDigits('0000000001')).toBe('01')
    expect(checkDigits('0000000097')).toBe('97')
  })

  it('produit une communication valide au format belge', () => {
    const ogm = structuredCommunicationFor(2026, 7)
    expect(ogm).toMatch(/^\+\+\+\d{3}\/\d{4}\/\d{5}\+\+\+$/)
    expect(isValidStructuredCommunication(ogm)).toBe(true)
  })

  it('rejette une communication altérée', () => {
    const ogm = structuredCommunicationFor(2026, 7)
    const broken = ogm.replace(/\d(?=\+\+\+$)/, (d) => String((Number(d) + 1) % 10))
    expect(isValidStructuredCommunication(broken)).toBe(false)
  })
})

describe('choix du fournisseur', () => {
  it('reste en direct tant que la date de bascule vers Smart n’est pas atteinte', () => {
    const s = { ...settings, activeProvider: 'smart' as const, switchDate: '2027-10-01T00:00:00Z' }
    expect(resolveProviderId(s, new Date('2027-09-30T12:00:00Z'))).toBe('direct')
    expect(resolveProviderId(s, new Date('2027-10-01T00:00:00Z'))).toBe('smart')
  })

  it('passe à Smart immédiatement sans date de bascule', () => {
    expect(resolveProviderId({ ...settings, activeProvider: 'smart' })).toBe('smart')
  })

  it('renvoie le fournisseur correspondant', () => {
    expect(getBillingProvider(settings, { gateway: null }).id).toBe('direct')
    expect(getBillingProvider({ ...settings, activeProvider: 'smart' }).id).toBe('smart')
  })
})

describe('DirectProvider', () => {
  it('prépare un brouillon numéroté, à valider, avec communication structurée', () => {
    const draft = createDirectProvider(null).prepareInvoice(input, settings)
    expect(draft.number).toBe('F2026-0007')
    expect(draft.status).toBe('to_validate')
    expect(draft.subtotalCents).toBe(8000)
    expect(draft.vatCents).toBe(0)
    expect(draft.totalCents).toBe(8000)
    expect(draft.vatMention).toBe(settings.vatMention)
    expect(draft.dueDate).toBe('2026-10-30')
    expect(isValidStructuredCommunication(draft.structuredCommunication!)).toBe(true)
    expect(draft.delivery).toBe('pdf')
  })

  it('ne consomme aucun numéro tant que le brouillon n’est pas validé', () => {
    const draft = createDirectProvider(null).prepareInvoice({ ...input, sequence: null }, settings)
    expect(draft.number).toBeNull()
    expect(draft.structuredCommunication).toBeNull()
    expect(draft.totalCents).toBe(8000)
  })

  it('applique une remise ligne par ligne (ex. deuxième cours à moitié prix)', () => {
    const draft = createDirectProvider(null).prepareInvoice(
      { ...input, prestations: [input.prestations[0], { ...input.prestations[1], discountPercent: 50 }] },
      settings,
    )
    expect(draft.lines[1].totalCents).toBe(2000)
    expect(draft.totalCents).toBe(6000)
    expect(() =>
      createDirectProvider(null).prepareInvoice(
        { ...input, prestations: [{ ...input.prestations[0], discountPercent: 120 }] },
        settings,
      ),
    ).toThrow()
  })

  it('applique la TVA en régime standard, sans mention', () => {
    const draft = createDirectProvider(null).prepareInvoice(input, { ...settings, vatRegime: 'standard' })
    expect(draft.vatCents).toBe(1680)
    expect(draft.totalCents).toBe(9680)
    expect(draft.vatMention).toBeNull()
  })

  it('envoie les factures entreprises par Peppol', () => {
    const draft = createDirectProvider(null).prepareInvoice(
      { ...input, customer: { ...input.customer, kind: 'business', vatNumber: 'BE0123456789' } },
      settings,
    )
    expect(draft.delivery).toBe('peppol')
  })

  it('refuse une facture vide ou un prix invalide', () => {
    const p = createDirectProvider(null)
    expect(() => p.prepareInvoice({ ...input, prestations: [] }, settings)).toThrow()
    expect(() =>
      p.prepareInvoice({ ...input, prestations: [{ ...input.prestations[0], unitPriceCents: 40.5 }] }, settings),
    ).toThrow()
  })

  it('ne propose le paiement en ligne que si activé et passerelle configurée', async () => {
    const gateway = fakeGateway()
    const draft = createDirectProvider(gateway).prepareInvoice(input, settings)
    const ctx = { redirectUrl: 'https://site.example/merci' }

    expect(createDirectProvider(null).supportsOnlinePayment(settings)).toBe(false)
    expect(createDirectProvider(gateway).supportsOnlinePayment({ ...settings, onlinePayments: false })).toBe(false)

    const payment = await createDirectProvider(gateway).requestPayment(draft, settings, ctx)
    expect(payment?.checkoutUrl).toBe('https://pay.example/tr_1')
    expect(gateway.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 8000, reference: 'F2026-0007' }),
    )
  })
})

describe('SmartProvider', () => {
  it('prépare une demande sans numéro, sans TVA, sans paiement en ligne', async () => {
    const draft = smartProvider.prepareInvoice(input, settings)
    expect(draft.provider).toBe('smart')
    expect(draft.number).toBeNull()
    expect(draft.structuredCommunication).toBeNull()
    expect(draft.vatCents).toBe(0)
    expect(draft.totalCents).toBe(8000)
    expect(draft.delivery).toBe('smart')
    expect(draft.status).toBe('to_validate')
    expect(smartProvider.supportsOnlinePayment({ ...settings, onlinePayments: true })).toBe(false)
    expect(await smartProvider.requestPayment(draft, settings, { redirectUrl: 'x' })).toBeNull()
  })

  it('exporte les demandes en CSV pour Smart', () => {
    const csv = toSmartCsv([smartProvider.prepareInvoice(input, settings)])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0].startsWith('client;email;')).toBe(true)
    expect(lines[1]).toContain('2026-10-01')
    expect(lines[1]).toContain('40,00')
    expect(lines[1]).toContain('particulier')
  })
})

describe('passerelle Mollie', () => {
  it('crée un paiement en euros avec la référence de facture', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'tr_9', _links: { checkout: { href: 'https://mollie/co' } } }), {
        status: 201,
      }),
    )
    const gw = createMollieGateway('test_key', fetchMock as unknown as typeof fetch)
    const res = await gw.createPayment({
      amountCents: 8000,
      description: 'Facture F2026-0007',
      reference: 'F2026-0007',
      redirectUrl: 'https://site.example/merci',
    })
    expect(res).toEqual({ paymentId: 'tr_9', checkoutUrl: 'https://mollie/co' })
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string).amount).toEqual({ currency: 'EUR', value: '80.00' })
  })

  it('traite les statuts intermédiaires comme ouverts', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: 'pending' })))
    const gw = createMollieGateway('k', fetchMock as unknown as typeof fetch)
    expect(await gw.getStatus('tr_1')).toBe('open')
  })
})
