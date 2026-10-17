/**
 * Paiements en ligne, de bout en bout sur Postgres.
 *
 * Un faux serveur Mollie tourne en local (HTTP réel) : le site crée les paiements chez lui et
 * relit leur état chez lui, exactement comme avec l'API officielle. Les notifications arrivent
 * par la route REST de Payload, celle que Mollie appelle en production.
 */
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { REST_POST } from '@payloadcms/next/routes'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { prepareDraftInvoice } from '@/billing/service'
import config from '@/payload.config'

type FakePayment = { id: string; status: string; amount: { value: string; currency: string }; metadata: { reference: string } }

const fake = {
  server: null as Server | null,
  payments: new Map<string, FakePayment>(),
  createCalls: 0,
  reads: 0,
}

function startFakeMollie(): Promise<string> {
  return new Promise((resolve) => {
    fake.server = createServer((req, res) => {
      const send = (status: number, body: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(body))
      }
      if (req.headers.authorization !== 'Bearer test_fake_mollie') return send(401, { detail: 'clé invalide' })
      if (req.method === 'POST' && req.url === '/v2/payments') {
        let raw = ''
        req.on('data', (c) => (raw += c))
        req.on('end', () => {
          const body = JSON.parse(raw)
          fake.createCalls += 1
          const id = `tr_fake${fake.createCalls}`
          fake.payments.set(id, { id, status: 'open', amount: body.amount, metadata: body.metadata })
          send(201, { id, _links: { checkout: { href: `https://pay.fake/${id}` } } })
        })
        return
      }
      const m = req.url?.match(/^\/v2\/payments\/([^/]+)$/)
      if (req.method === 'GET' && m) {
        fake.reads += 1
        const p = fake.payments.get(decodeURIComponent(m[1]))
        return p ? send(200, p) : send(404, { detail: 'inconnu' })
      }
      send(404, {})
    })
    fake.server.listen(0, '127.0.0.1', () => {
      const { port } = fake.server!.address() as AddressInfo
      resolve(`http://127.0.0.1:${port}/v2`)
    })
  })
}

let payload: Payload
let studentId: number

/** Envoie une notification comme Mollie : POST form-urlencoded « id=tr_… » sur la route REST. */
async function notify(paymentId: string) {
  const handler = REST_POST(config)
  const res = await handler(
    new Request('http://localhost/api/invoices/payment-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id: paymentId }).toString(),
    }),
    { params: Promise.resolve({ slug: ['invoices', 'payment-webhook'] }) },
  )
  return { status: res.status, body: (await res.json()) as { ok: boolean; outcome?: string } }
}

async function validatedInvoice(euros: number) {
  const p = await payload.create({
    collection: 'prestations',
    data: { student: studentId, date: '2026-10-05', description: 'Cours en ligne', quantity: 1, unitPrice: euros } as any,
  })
  const draft = await prepareDraftInvoice(payload, { studentId, prestationIds: [p.id] })
  const validated = await payload.update({ collection: 'invoices', id: draft.id, data: { status: 'validated' } })
  const withLink = await payload.findByID({ collection: 'invoices', id: validated.id })
  return { invoice: withLink, prestationId: p.id }
}

describe('paiements Mollie : vérification côté serveur et notifications', () => {
  beforeAll(async () => {
    process.env.MOLLIE_API_BASE_URL = await startFakeMollie()
    process.env.MOLLIE_API_KEY = 'test_fake_mollie'
    payload = await getPayload({ config: await config })
    await payload.updateGlobal({
      slug: 'billing-settings',
      data: { activeProvider: 'direct', invoicePrefix: 'F', onlinePayments: true, vatRegime: 'franchise' },
    })
    const s = await payload.create({
      collection: 'students',
      data: { firstName: 'Pay', lastName: 'Test', email: 'pay@paiement.test', password: 'mot-de-passe-test' } as any,
    })
    studentId = s.id
  })

  afterAll(async () => {
    delete process.env.MOLLIE_API_KEY
    delete process.env.MOLLIE_API_BASE_URL
    await new Promise((r) => fake.server?.close(r))
  })

  it('la validation crée un seul paiement, du bon montant, avec le numéro de facture comme référence', async () => {
    const before = fake.createCalls
    const { invoice } = await validatedInvoice(30)
    expect(fake.createCalls).toBe(before + 1)
    expect(invoice.paymentId).toMatch(/^tr_fake/)
    const p = fake.payments.get(invoice.paymentId!)!
    expect(p.amount).toEqual({ value: '30.00', currency: 'EUR' })
    expect(p.metadata.reference).toBe(invoice.number)
  })

  it('double validation simultanée de la même facture : un seul paiement créé chez Mollie (10 essais)', async () => {
    for (let round = 0; round < 10; round++) {
      const p = await payload.create({
        collection: 'prestations',
        data: { student: studentId, date: '2026-10-06', description: `Double clic ${round}`, quantity: 1, unitPrice: 25 } as any,
      })
      const draft = await prepareDraftInvoice(payload, { studentId, prestationIds: [p.id] })
      const before = fake.createCalls
      const rs = await Promise.allSettled([
        payload.update({ collection: 'invoices', id: draft.id, data: { status: 'validated' } }),
        payload.update({ collection: 'invoices', id: draft.id, data: { status: 'validated' } }),
      ])
      expect(rs.map((r) => r.status), `essai ${round + 1}`).toEqual(['fulfilled', 'fulfilled'])
      expect(fake.createCalls - before, `essai ${round + 1}`).toBe(1)
    }
  })

  it('un paiement encore ouvert ne valide rien', async () => {
    const { invoice } = await validatedInvoice(30)
    const r = await notify(invoice.paymentId!)
    expect(r).toEqual({ status: 200, body: { ok: true, outcome: 'not_paid' } })
    expect((await payload.findByID({ collection: 'invoices', id: invoice.id })).status).toBe('validated')
  })

  it('un paiement payé et conforme marque la facture payée ; une notification répétée ne change rien', async () => {
    const { invoice } = await validatedInvoice(30)
    fake.payments.get(invoice.paymentId!)!.status = 'paid'

    const first = await notify(invoice.paymentId!)
    expect(first.body.outcome).toBe('paid')
    const paid = await payload.findByID({ collection: 'invoices', id: invoice.id })
    expect(paid.status).toBe('paid')
    expect(paid.paidAt).toBeTruthy()

    const again = await notify(invoice.paymentId!)
    expect(again.body.outcome).toBe('already_paid')
    const after = await payload.findByID({ collection: 'invoices', id: invoice.id })
    expect(after.paidAt).toBe(paid.paidAt)
  })

  it('cinq notifications simultanées : la facture n’est marquée payée qu’une seule fois (10 essais)', async () => {
    for (let round = 0; round < 10; round++) {
      const { invoice } = await validatedInvoice(20)
      fake.payments.get(invoice.paymentId!)!.status = 'paid'
      const results = await Promise.all(Array.from({ length: 5 }, () => notify(invoice.paymentId!)))
      const outcomes = results.map((r) => r.body.outcome).sort()
      expect(outcomes, `essai ${round + 1}`).toEqual(['already_paid', 'already_paid', 'already_paid', 'already_paid', 'paid'])
      expect(results.every((r) => r.status === 200)).toBe(true)
    }
  })

  it.each([
    ['montant différent', (p: FakePayment) => (p.amount.value = '3.00'), /montant 300 centimes au lieu de 3000/],
    ['devise différente', (p: FakePayment) => (p.amount.currency = 'USD'), /devise USD/],
    ['référence d’une autre facture', (p: FakePayment) => (p.metadata.reference = 'F1999-0001'), /référence « F1999-0001 »/],
  ])('payé mais %s : facture non payée, prestation inchangée, anomalie notée', async (_label, tamper, issue) => {
    const { invoice, prestationId } = await validatedInvoice(30)
    const p = fake.payments.get(invoice.paymentId!)!
    p.status = 'paid'
    tamper(p)

    const r = await notify(invoice.paymentId!)
    expect(r.body.outcome).toBe('mismatch')
    const stored = await payload.findByID({ collection: 'invoices', id: invoice.id })
    expect(stored.status).toBe('validated')
    expect(stored.paidAt ?? null).toBeNull()
    expect(stored.paymentIssue).toMatch(issue)
    const prestation = await payload.findByID({ collection: 'prestations', id: prestationId })
    expect(prestation.status).toBe('invoiced')
  })

  it('un identifiant de paiement inconnu ou mal formé est ignoré sans rien modifier', async () => {
    expect((await notify('tr_inexistant')).body.outcome).toBe('unknown_payment')
    expect((await notify("tr_1' OR 1=1 --")).body.outcome).toBe('unknown_payment')
  })

  it('si Mollie est injoignable, la route répond 500 pour que Mollie réessaie, et rien n’est modifié', async () => {
    const { invoice } = await validatedInvoice(30)
    const saved = process.env.MOLLIE_API_BASE_URL
    process.env.MOLLIE_API_BASE_URL = 'http://127.0.0.1:9/v2'
    try {
      const r = await notify(invoice.paymentId!)
      expect(r.status).toBe(500)
    } finally {
      process.env.MOLLIE_API_BASE_URL = saved
    }
    expect((await payload.findByID({ collection: 'invoices', id: invoice.id })).status).toBe('validated')
  })
})
