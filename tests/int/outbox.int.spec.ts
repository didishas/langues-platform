/**
 * « Rien ne part sans Catherine » pour les e-mails, sur une vraie base, avec un service d'envoi en mémoire.
 */
import { REST_POST } from '@payloadcms/next/routes'
import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { prepareDraftInvoice } from '@/billing/service'
import { approveAndSend } from '@/mail/outbox'
import { sentInMemory } from '@/mail/transport'
import config from '@/payload.config'
import type { Outbox } from '@/payload-types'

let payload: Payload
let teacher: any
let student: any
const PASSWORD = 'mot-de-passe-test'

const as = (u: any) => ({ user: u, overrideAccess: false as const })
const sentTo = (email: string) => sentInMemory().filter((m) => m.to === email)

async function draftsFor(kind: string, extra: Record<string, unknown> = {}) {
  return (
    await payload.find({
      collection: 'outbox',
      where: { and: [{ student: { equals: student.id } }, { kind: { equals: kind } }, ...Object.entries(extra).map(([k, v]) => ({ [k]: { equals: v } }))] },
      sort: '-createdAt',
      depth: 0,
    })
  ).docs as Outbox[]
}

async function validatedInvoice(euros: number) {
  const p = await payload.create({
    collection: 'prestations',
    data: { student: student.id, date: new Date().toISOString(), description: 'Cours', quantity: 1, unitPrice: euros } as any,
  })
  const inv = await prepareDraftInvoice(payload, { studentId: student.id, prestationIds: [p.id] })
  return payload.update({ collection: 'invoices', id: inv.id, data: { status: 'validated' } })
}

async function sendViaRest(id: number, version: string, email: string) {
  const jwt = (await payload.login({ collection: email.includes('eleve') ? 'students' : 'users', data: { email, password: PASSWORD } })).token
  const res = await REST_POST(config)(
    new Request(`http://localhost/api/outbox/${id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `JWT ${jwt}` },
      body: JSON.stringify({ version }),
    }),
    { params: Promise.resolve({ slug: ['outbox', String(id), 'send'] }) },
  )
  return { status: res.status, body: (await res.json()) as any }
}

describe('messages à envoyer', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await payload.updateGlobal({
      slug: 'billing-settings',
      data: { activeProvider: 'direct', invoicePrefix: 'F', paymentTermDays: 15, onlinePayments: false } as any,
    })
    teacher = { ...(await payload.create({ collection: 'users', data: { email: 'prof@mail.test', password: PASSWORD, role: 'teacher' } as any })), collection: 'users' }
    await payload.create({ collection: 'users', data: { email: 'tech@mail.test', password: PASSWORD, role: 'tech' } as any })
    student = {
      ...(await payload.create({
        collection: 'students',
        data: { firstName: 'Lina', lastName: 'Mail', email: 'eleve@mail.test', password: PASSWORD, timeZone: 'Asia/Jerusalem' } as any,
      })),
      collection: 'students',
    }
  })

  it('une facture validée prépare un brouillon, sans rien envoyer', async () => {
    const before = sentInMemory().length
    const inv = await validatedInvoice(35)
    const [draft] = await draftsFor('invoice', { invoice: inv.id })
    expect(draft).toMatchObject({ status: 'draft', to: 'eleve@mail.test', amountCents: 3500 })
    expect(draft.subject).toContain(inv.number!)
    expect(draft.body).toContain('Bonjour Lina')
    expect(draft.body).toContain(inv.structuredCommunication!)
    expect(draft.body).toMatch(/35,00\s€/)
    expect(sentInMemory().length).toBe(before)
  })

  it('une séance future confirmée prépare un brouillon à l’heure de l’élève ; une séance passée, non', async () => {
    const mkSlot = async (days: number) => {
      const start = new Date(Date.now() + days * 864e5)
      start.setUTCHours(15, 0, 0, 0)
      return payload.create({ collection: 'slots', data: { start: start.toISOString(), end: new Date(start.getTime() + 36e5).toISOString(), capacity: 3 } })
    }
    const future = await mkSlot(6)
    const b = await payload.create({ collection: 'bookings', data: { slot: future.id, student: student.id, status: 'requested' } })
    expect(await draftsFor('booking', { booking: b.id })).toHaveLength(0)
    await payload.update({ collection: 'bookings', id: b.id, data: { status: 'confirmed' } })
    const [draft] = await draftsFor('booking', { booking: b.id })
    // Date relative au jour du test : on vérifie la forme (heure de l'élève, puis de Bruxelles), pas l'heure exacte.
    expect(draft.body).toContain('heure d’Israël')
    expect(draft.body).toMatch(/Bruxelles : \d\d:\d\d/)
    const past = await mkSlot(-6)
    const old = await payload.create({ collection: 'bookings', data: { slot: past.id, student: student.id, status: 'confirmed' } })
    expect(await draftsFor('booking', { booking: old.id })).toHaveLength(0)
  })

  it('refusé au compte technique, à l’élève et sans connexion : rien ne part', async () => {
    const inv = await validatedInvoice(20)
    const [draft] = await draftsFor('invoice', { invoice: inv.id })
    const before = sentInMemory().length
    expect((await sendViaRest(draft.id, draft.updatedAt, 'tech@mail.test')).status).toBe(403)
    expect((await sendViaRest(draft.id, draft.updatedAt, 'eleve@mail.test')).status).toBe(403)
    const anon = await REST_POST(config)(
      new Request(`http://localhost/api/outbox/${draft.id}/send`, { method: 'POST', body: JSON.stringify({ version: draft.updatedAt }) }),
      { params: Promise.resolve({ slug: ['outbox', String(draft.id), 'send'] }) },
    )
    expect(anon.status).toBe(403)
    expect(sentInMemory().length).toBe(before)
  })

  it('Catherine valide : le message part une fois, la facture passe à « envoyée »', async () => {
    const inv = await validatedInvoice(42)
    const [draft] = await draftsFor('invoice', { invoice: inv.id })
    const before = sentTo('eleve@mail.test').length
    const r = await sendViaRest(draft.id, draft.updatedAt, 'prof@mail.test')
    expect(r).toMatchObject({ status: 200, body: { ok: true, outcome: 'sent' } })
    const mails = sentTo('eleve@mail.test')
    expect(mails.length - before).toBe(1)
    expect(mails.at(-1)!.subject).toBe(draft.subject)
    expect(mails.at(-1)!.html).toContain('dir="ltr"')
    const after = await payload.findByID({ collection: 'outbox', id: draft.id, depth: 0 })
    expect(after).toMatchObject({ status: 'sent', approvedBy: teacher.id })
    expect(after.approvedHash).toMatch(/^[0-9a-f]{64}$/)
    expect((await payload.findByID({ collection: 'invoices', id: inv.id })).status).toBe('sent')

    // Deuxième clic : rien de plus ne part.
    const again = await sendViaRest(draft.id, after.updatedAt, 'prof@mail.test')
    expect(again.body.outcome).toBe('already_sent')
    expect(sentTo('eleve@mail.test').length - before).toBe(1)
    // Un message parti n'est plus modifiable ni supprimable.
    await expect(payload.update({ collection: 'outbox', id: draft.id, data: { body: 'autre' }, ...as(teacher) })).rejects.toThrow()
    await expect(payload.delete({ collection: 'outbox', id: draft.id, ...as(teacher) })).rejects.toThrow()
  })

  it('la version validée est celle qui part : un message modifié depuis l’ouverture est refusé', async () => {
    const m = await payload.create({
      collection: 'outbox',
      data: { student: student.id, subject: 'Bonjour', body: 'Première version', kind: 'message' } as any,
      ...as(teacher),
    })
    const edited = await payload.update({ collection: 'outbox', id: m.id, data: { body: 'Deuxième version' }, ...as(teacher) })
    expect((await approveAndSend(payload, m.id, teacher.id, m.updatedAt)).outcome).toBe('refused')
    const ok = await approveAndSend(payload, m.id, teacher.id, edited.updatedAt)
    expect(ok.outcome).toBe('sent')
    expect(sentTo('eleve@mail.test').at(-1)!.text).toBe('Deuxième version')
  })

  it('le destinataire vient toujours de la fiche : adresse forcée ignorée, adresse changée refusée', async () => {
    const m = await payload.create({
      collection: 'outbox',
      data: { student: student.id, subject: 'Test', body: 'x', kind: 'message', to: 'pirate@ailleurs.test' } as any,
      ...as(teacher),
    })
    expect(m.to).toBe('eleve@mail.test')
    const forced = await payload.update({ collection: 'outbox', id: m.id, data: { to: 'pirate@ailleurs.test' } as any, ...as(teacher) })
    expect(forced.to).toBe('eleve@mail.test')
    await payload.update({ collection: 'students', id: student.id, data: { email: 'nouvelle@mail.test' } })
    const r = await approveAndSend(payload, m.id, teacher.id, forced.updatedAt)
    expect(r).toEqual({ outcome: 'refused', reason: 'recipient' })
    expect(sentInMemory().some((x) => x.to === 'pirate@ailleurs.test')).toBe(false)
    await payload.update({ collection: 'students', id: student.id, data: { email: 'eleve@mail.test' } })
  })

  it('facture annulée entre-temps : brouillon annulé et envoi refusé', async () => {
    const inv = await validatedInvoice(15)
    const [draft] = await draftsFor('invoice', { invoice: inv.id })
    // Même si un e-mail est relu au moment de l'annulation, la facture est revérifiée à l'envoi.
    await payload.update({ collection: 'invoices', id: inv.id, data: { status: 'cancelled' } })
    const after = await payload.findByID({ collection: 'outbox', id: draft.id, depth: 0 })
    expect(after.status).toBe('cancelled')
    expect((await approveAndSend(payload, draft.id, teacher.id, draft.updatedAt)).outcome).toBe('refused')
    // Contrôle direct de la règle du montant : le total de la facture doit être celui du message préparé.
    const inv2 = await validatedInvoice(16)
    const [draft2] = await draftsFor('invoice', { invoice: inv2.id })
    const tampered = await payload.update({ collection: 'outbox', id: draft2.id, data: { amountCents: 9999 } })
    expect(await approveAndSend(payload, draft2.id, teacher.id, tampered.updatedAt)).toEqual({ outcome: 'refused', reason: 'invoice' })
  })

  it('« envoyé » ne peut pas être coché à la main', async () => {
    const before = sentInMemory().length
    const m = await payload.create({
      collection: 'outbox',
      data: { student: student.id, subject: 'x', body: 'x', kind: 'message', status: 'sent' } as any,
      ...as(teacher),
    })
    expect(m.status).toBe('draft')
    expect(sentInMemory().length).toBe(before)
  })

  it('service d’envoi non configuré : échec signalé, rien ne part, puis renvoi possible', async () => {
    const m = await payload.create({
      collection: 'outbox',
      data: { student: student.id, subject: 'Échec', body: 'x', kind: 'message' } as any,
      ...as(teacher),
    })
    process.env.MAIL_TRANSPORT = 'smtp'
    try {
      const r = await approveAndSend(payload, m.id, teacher.id, m.updatedAt)
      expect(r.outcome).toBe('failed')
    } finally {
      process.env.MAIL_TRANSPORT = 'memory'
    }
    const failed = await payload.findByID({ collection: 'outbox', id: m.id, depth: 0 })
    expect(failed.status).toBe('failed')
    expect(failed.error).toContain('SMTP')
    expect((await approveAndSend(payload, m.id, teacher.id, failed.updatedAt)).outcome).toBe('sent')
  })

  it('cinq clics simultanés : un seul e-mail (répété 5 fois)', async () => {
    for (let round = 0; round < 5; round++) {
      const m = await payload.create({
        collection: 'outbox',
        data: { student: student.id, subject: `Simultané ${round}`, body: 'x', kind: 'message' } as any,
        ...as(teacher),
      })
      const results = await Promise.allSettled(Array.from({ length: 5 }, () => approveAndSend(payload, m.id, teacher.id, m.updatedAt)))
      const outcomes = results.map((r) => (r.status === 'fulfilled' ? r.value.outcome : 'error'))
      expect(outcomes.filter((o) => o === 'sent')).toHaveLength(1)
      expect(outcomes.filter((o) => o === 'already_sent')).toHaveLength(4)
      expect(sentInMemory().filter((x) => x.subject === `Simultané ${round}`)).toHaveLength(1)
    }
  })
})
