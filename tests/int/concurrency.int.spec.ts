/**
 * Situations concurrentes réelles, sur Postgres.
 *
 * Chaque appel `payload.create` / `payload.update` lancé sans `req` ouvre sa propre transaction
 * sur sa propre connexion du pool : `Promise.allSettled` fait donc s'exécuter les requêtes en
 * même temps dans la base, comme deux visiteurs ou deux onglets.
 */
import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { prepareDraftInvoice } from '@/billing/service'
import config from '@/payload.config'

let payload: Payload
const studentIds: number[] = []
let slotSeq = 0

async function makeSlot(capacity: number) {
  slotSeq += 1
  const start = new Date(Date.UTC(2031, 0, 1, 9) + slotSeq * 864e5)
  return payload.create({
    collection: 'slots',
    data: { start: start.toISOString(), end: new Date(start.getTime() + 90 * 60e3).toISOString(), capacity },
  })
}

async function draftFor(studentId: number, label: string) {
  const p = await payload.create({
    collection: 'prestations',
    data: { student: studentId, date: '2026-10-01', description: label, quantity: 1, unitPrice: 30 } as any,
  })
  return prepareDraftInvoice(payload, { studentId, prestationIds: [p.id] })
}

async function counterValue(): Promise<number> {
  const year = new Date().getFullYear()
  const res = await payload.find({ collection: 'invoice-counters', where: { year: { equals: year } }, limit: 1 })
  return res.docs[0]?.last ?? 0
}

const sequenceOf = (number: string | null | undefined) => Number(String(number).split('-').at(-1))

describe('concurrence : réservations', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await payload.updateGlobal({ slug: 'billing-settings', data: { activeProvider: 'direct', invoicePrefix: 'F' } })
    for (let i = 0; i < 6; i++) {
      const s = await payload.create({
        collection: 'students',
        data: { firstName: `Conc${i}`, lastName: 'Test', email: `conc${i}@concurrence.test`, password: 'mot-de-passe-test' } as any,
      })
      studentIds.push(s.id)
    }
  })

  it('dernière place : deux réservations simultanées, une seule acceptée, avec un message clair (10 essais)', async () => {
    for (let round = 0; round < 10; round++) {
      const slot = await makeSlot(1)
      const results = await Promise.allSettled([
        payload.create({ collection: 'bookings', data: { slot: slot.id, student: studentIds[0] } }),
        payload.create({ collection: 'bookings', data: { slot: slot.id, student: studentIds[1] } }),
      ])
      const accepted = results.filter((r) => r.status === 'fulfilled')
      const refused = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      expect(accepted, `essai ${round + 1}`).toHaveLength(1)
      expect(refused[0].reason.message).toMatch(/complet/i)
      const stored = await payload.count({ collection: 'bookings', where: { slot: { equals: slot.id } } })
      expect(stored.totalDocs, `essai ${round + 1}`).toBe(1)
    }
  })

  it('groupe de 2 places : six demandes simultanées, jamais plus de 2 réservations (10 essais)', async () => {
    for (let round = 0; round < 10; round++) {
      const slot = await makeSlot(2)
      const results = await Promise.allSettled(
        studentIds.map((student) => payload.create({ collection: 'bookings', data: { slot: slot.id, student } })),
      )
      expect(results.filter((r) => r.status === 'fulfilled'), `essai ${round + 1}`).toHaveLength(2)
      const stored = await payload.count({ collection: 'bookings', where: { slot: { equals: slot.id } } })
      expect(stored.totalDocs, `essai ${round + 1}`).toBe(2)
    }
  })

  it('une annulation libère la place, et réactiver une réservation annulée respecte la capacité', async () => {
    const slot = await makeSlot(1)
    const first = await payload.create({ collection: 'bookings', data: { slot: slot.id, student: studentIds[0] } })
    await payload.update({ collection: 'bookings', id: first.id, data: { status: 'cancelled' } })
    await payload.create({ collection: 'bookings', data: { slot: slot.id, student: studentIds[1] } })
    await expect(
      payload.update({ collection: 'bookings', id: first.id, data: { status: 'confirmed' } }),
    ).rejects.toThrow(/complet/i)
  })
})

describe('concurrence : numérotation des factures', () => {
  it('deux factures validées en même temps reçoivent deux numéros distincts et consécutifs', async () => {
    const a = await draftFor(studentIds[2], 'Cours A')
    const b = await draftFor(studentIds[3], 'Cours B')
    const before = await counterValue()
    const results = await Promise.allSettled([
      payload.update({ collection: 'invoices', id: a.id, data: { status: 'validated' } }),
      payload.update({ collection: 'invoices', id: b.id, data: { status: 'validated' } }),
    ])
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled'])
    const numbers = results.map((r) => sequenceOf((r as PromiseFulfilledResult<any>).value.number)).sort((x, y) => x - y)
    expect(numbers).toEqual([before + 1, before + 2])
    expect(await counterValue()).toBe(before + 2)
  })

  it('la même facture validée deux fois en même temps (double clic) ne consomme qu’un seul numéro (10 essais)', async () => {
    for (let round = 0; round < 9; round++) {
      const d = await draftFor(studentIds[4], `Cours C${round}`)
      const start = await counterValue()
      const rs = await Promise.allSettled([
        payload.update({ collection: 'invoices', id: d.id, data: { status: 'validated' } }),
        payload.update({ collection: 'invoices', id: d.id, data: { status: 'validated' } }),
      ])
      expect(rs.map((r) => r.status), `essai ${round + 1}`).toEqual(['fulfilled', 'fulfilled'])
      const s = await payload.findByID({ collection: 'invoices', id: d.id })
      expect(sequenceOf(s.number), `essai ${round + 1}`).toBe(start + 1)
      expect(await counterValue(), `essai ${round + 1}`).toBe(start + 1)
    }

    const draft = await draftFor(studentIds[4], 'Cours C')
    const before = await counterValue()
    const results = await Promise.allSettled([
      payload.update({ collection: 'invoices', id: draft.id, data: { status: 'validated' } }),
      payload.update({ collection: 'invoices', id: draft.id, data: { status: 'validated' } }),
    ])
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled'])
    const stored = await payload.findByID({ collection: 'invoices', id: draft.id })
    expect(sequenceOf(stored.number)).toBe(before + 1)
    expect(await counterValue()).toBe(before + 1)

    // Une nouvelle tentative plus tard ne change pas le numéro non plus.
    const retried = await payload.update({ collection: 'invoices', id: draft.id, data: { status: 'validated' } })
    expect(retried.number).toBe(stored.number)
    expect(await counterValue()).toBe(before + 1)

    // La facture suivante prend le numéro juste après : aucun trou.
    const next = await draftFor(studentIds[5], 'Cours D')
    const validatedNext = await payload.update({ collection: 'invoices', id: next.id, data: { status: 'validated' } })
    expect(sequenceOf(validatedNext.number)).toBe(before + 2)
  })
})
