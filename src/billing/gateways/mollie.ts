import type { PaymentGateway, PaymentStatus } from '../types'

const MOLLIE_API = 'https://api.mollie.com/v2'

type FetchLike = typeof fetch

/** Passerelle Mollie (Bancontact, carte, SEPA) via l'API REST v2. */
export function createMollieGateway(apiKey: string, fetchImpl: FetchLike = fetch): PaymentGateway {
  const call = async (path: string, init?: RequestInit) => {
    const res = await fetchImpl(`${MOLLIE_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
    if (!res.ok) {
      throw new Error(`Mollie a répondu ${res.status}`)
    }
    return res.json() as Promise<Record<string, any>>
  }

  return {
    async createPayment({ amountCents, description, reference, redirectUrl, webhookUrl }) {
      const body = {
        amount: { currency: 'EUR', value: (amountCents / 100).toFixed(2) },
        description,
        redirectUrl,
        ...(webhookUrl ? { webhookUrl } : {}),
        metadata: { reference },
      }
      const json = await call('/payments', { method: 'POST', body: JSON.stringify(body) })
      const checkoutUrl = json?._links?.checkout?.href
      if (typeof json?.id !== 'string' || typeof checkoutUrl !== 'string') {
        throw new Error('Réponse Mollie inattendue')
      }
      return { paymentId: json.id, checkoutUrl }
    },

    async getStatus(paymentId) {
      const json = await call(`/payments/${encodeURIComponent(paymentId)}`)
      const known: PaymentStatus[] = ['open', 'paid', 'failed', 'expired', 'canceled']
      // Mollie utilise aussi "pending" et "authorized" : tant que ce n'est pas payé, c'est ouvert.
      return known.includes(json.status) ? (json.status as PaymentStatus) : 'open'
    },
  }
}
