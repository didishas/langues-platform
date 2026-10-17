import type { PaymentGateway, PaymentInfo, PaymentStatus } from '../types'

const DEFAULT_MOLLIE_API = 'https://api.mollie.com/v2'

type FetchLike = typeof fetch

/** « 80.00 » → 8000, sans passer par un nombre à virgule flottante. */
export function parseAmountToCents(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+(\.\d{1,2})?$/.test(value)) return null
  const [units, decimals = ''] = value.split('.')
  return Number(units) * 100 + Number(decimals.padEnd(2, '0'))
}

/**
 * Passerelle Mollie (Bancontact, carte, SEPA) via l'API REST v2.
 * `baseUrl` ne sert qu'aux tests (faux serveur Mollie local) ; en production, l'API officielle.
 */
export function createMollieGateway(
  apiKey: string,
  options: { fetchImpl?: FetchLike; baseUrl?: string } = {},
): PaymentGateway {
  const fetchImpl = options.fetchImpl ?? fetch
  const baseUrl = (options.baseUrl ?? DEFAULT_MOLLIE_API).replace(/\/$/, '')

  const call = async (path: string, init?: RequestInit) => {
    const res = await fetchImpl(`${baseUrl}${path}`, {
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

    async getPayment(paymentId): Promise<PaymentInfo> {
      const json = await call(`/payments/${encodeURIComponent(paymentId)}`)
      const known: PaymentStatus[] = ['open', 'paid', 'failed', 'expired', 'canceled']
      return {
        id: String(json.id ?? ''),
        // Mollie utilise aussi « pending » et « authorized » : tant que ce n'est pas payé, c'est ouvert.
        status: known.includes(json.status) ? (json.status as PaymentStatus) : 'open',
        amountCents: parseAmountToCents(json?.amount?.value),
        currency: typeof json?.amount?.currency === 'string' ? json.amount.currency : null,
        reference: typeof json?.metadata?.reference === 'string' ? json.metadata.reference : null,
      }
    },
  }
}
