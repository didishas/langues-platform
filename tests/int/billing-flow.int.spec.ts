import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { isValidStructuredCommunication } from '@/billing'
import { prepareDraftInvoice } from '@/billing/service'
import config from '@/payload.config'

let payload: Payload
let studentId: number
const year = new Date().getFullYear()

/** Numéro attendu pour la prochaine facture, d'après le compteur en base (les autres fichiers de tests en consomment aussi). */
async function nextNumber(offset = 1) {
  const res = await payload.find({ collection: 'invoice-counters', where: { year: { equals: year } }, limit: 1 })
  return `F${year}-${String((res.docs[0]?.last ?? 0) + offset).padStart(4, '0')}`
}

async function createPrestation(description: string, euros: number) {
  return payload.create({
    collection: 'prestations',
    data: { student: studentId, date: `${year}-10-01`, description, quantity: 1, unitPrice: euros } as any,
  })
}

describe('facturation de bout en bout (base de test)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await payload.updateGlobal({
      slug: 'billing-settings',
      data: {
        activeProvider: 'direct',
        invoicePrefix: 'F',
        vatRegime: 'franchise',
        vatMention: 'Régime particulier de franchise des petites entreprises',
        paymentTermDays: 15,
        onlinePayments: false,
      },
    })
    const student = await payload.create({
      collection: 'students',
      data: {
        firstName: 'Noa',
        lastName: 'Test',
        email: 'noa@example.com',
        password: 'motdepasse-de-test',
      } as any,
    })
    studentId = student.id
  })

  it('stocke en centimes un prix saisi en euros', async () => {
    const p = await createPrestation('Cours d’hébreu, 60 min', 37.5)
    expect(p.unitPriceCents).toBe(3750)
    expect(p.unitPrice).toBe(37.5)
    expect(p.status).toBe('to_invoice')
  })

  it('prépare un brouillon sans numéro, puis numérote à la validation', async () => {
    const a = await createPrestation('Cours d’anglais, 60 min', 40)
    const b = await createPrestation('Cours d’anglais, 60 min', 40)
    const draft = await prepareDraftInvoice(payload, { studentId, prestationIds: [a.id, b.id] })

    const expected = await nextNumber()
    expect(draft.status).toBe('to_validate')
    expect(draft.number ?? null).toBeNull()
    expect(draft.totalCents).toBe(8000)

    const validated = await payload.update({ collection: 'invoices', id: draft.id, data: { status: 'validated' } })
    expect(validated.number).toBe(expected)
    expect(isValidStructuredCommunication(validated.structuredCommunication!)).toBe(true)
    expect(validated.vatMention).toBe('Régime particulier de franchise des petites entreprises')

    const after = await payload.findByID({ collection: 'prestations', id: a.id })
    expect(after.status).toBe('invoiced')
  })

  it('ne consomme pas de numéro pour un brouillon supprimé', async () => {
    const p1 = await createPrestation('Cours d’espagnol', 40)
    const abandoned = await prepareDraftInvoice(payload, { studentId, prestationIds: [p1.id] })
    await payload.delete({ collection: 'invoices', id: abandoned.id })
    const freed = await payload.findByID({ collection: 'prestations', id: p1.id })
    expect(freed.invoice ?? null).toBeNull()

    const expected = await nextNumber()
    const again = await prepareDraftInvoice(payload, { studentId, prestationIds: [p1.id] })
    const validated = await payload.update({ collection: 'invoices', id: again.id, data: { status: 'validated' } })
    expect(validated.number).toBe(expected)
  })

  it('refuse de facturer deux fois la même prestation', async () => {
    const p = await createPrestation('Cours de roumain', 40)
    await prepareDraftInvoice(payload, { studentId, prestationIds: [p.id] })
    await expect(prepareDraftInvoice(payload, { studentId, prestationIds: [p.id] })).rejects.toThrow()
  })

  it('protège les factures validées et les prestations facturées', async () => {
    const validated = await payload.find({ collection: 'invoices', where: { status: { equals: 'validated' } } })
    const invoice = validated.docs[0]
    await expect(payload.delete({ collection: 'invoices', id: invoice.id })).rejects.toThrow()
    await expect(
      payload.update({ collection: 'invoices', id: invoice.id, data: { status: 'to_validate' } }),
    ).rejects.toThrow()

    const invoiced = await payload.find({ collection: 'prestations', where: { status: { equals: 'invoiced' } } })
    await expect(payload.delete({ collection: 'prestations', id: invoiced.docs[0].id })).rejects.toThrow()
  })

  it('bascule vers Smart par simple réglage, sans numéro propre', async () => {
    await payload.updateGlobal({ slug: 'billing-settings', data: { activeProvider: 'smart', switchDate: null } })
    const p = await createPrestation('Cours d’hébreu, 60 min', 45)
    const draft = await prepareDraftInvoice(payload, { studentId, prestationIds: [p.id] })
    expect(draft.provider).toBe('smart')
    const validated = await payload.update({ collection: 'invoices', id: draft.id, data: { status: 'validated' } })
    expect(validated.number ?? null).toBeNull()
    expect(validated.structuredCommunication ?? null).toBeNull()
    expect(validated.delivery).toBe('smart')

    // Les factures de la phase 1 restent consultables après la bascule.
    const phase1 = await payload.find({ collection: 'invoices', where: { provider: { equals: 'direct' } } })
    expect(phase1.totalDocs).toBeGreaterThan(0)
    await payload.updateGlobal({ slug: 'billing-settings', data: { activeProvider: 'direct' } })
  })
})

describe('réductions', () => {
  it('recopie le pourcentage de la réduction choisie et l’applique sur la facture', async () => {
    await payload.updateGlobal({ slug: 'billing-settings', data: { activeProvider: 'direct' } })
    const half = await payload.create({
      collection: 'discounts',
      data: { title: '2e cours à moitié prix', type: 'extra_session', percent: 50 },
    })
    const p = await payload.create({
      collection: 'prestations',
      data: { student: studentId, date: `${year}-10-02`, description: 'Cours individuel', quantity: 1, unitPrice: 30, discount: half.id } as any,
    })
    expect(p.discountPercent).toBe(50)
    const draft = await prepareDraftInvoice(payload, { studentId, prestationIds: [p.id] })
    expect(draft.totalCents).toBe(1500)
  })
})

describe('langue des prestations', () => {
  it('reprend la langue de la formule ou de l’élève quand il n’y en a qu’une, sans écraser un choix', async () => {
    const [he, en] = await Promise.all(
      ['he', 'en'].map(async (code, i) =>
        (await payload.find({ collection: 'languages', where: { code: { equals: code } }, limit: 1 })).docs[0] ??
        payload.create({ collection: 'languages', data: { code, name: code, order: i } as any }),
      ),
    )
    const single = await payload.create({
      collection: 'offers',
      data: { title: 'Hébreu seul', kind: 'single', format: 'individual', price: 35, languages: [he.id] } as any,
    })
    const multi = await payload.create({
      collection: 'offers',
      data: { title: 'Plusieurs', kind: 'single', format: 'individual', price: 30, languages: [he.id, en.id] } as any,
    })
    const mk = (offer: number, extra: object = {}) =>
      payload.create({
        collection: 'prestations',
        data: { student: studentId, date: `${year}-10-03`, description: 'x', quantity: 1, unitPrice: 30, offer, ...extra } as any,
      })

    const fromOffer = await mk(single.id)
    expect(typeof fromOffer.language === 'object' ? fromOffer.language?.id : fromOffer.language).toBe(he.id)

    await payload.update({ collection: 'students', id: studentId, data: { languages: [en.id] } as any })
    const fromStudent = await mk(multi.id)
    expect(typeof fromStudent.language === 'object' ? fromStudent.language?.id : fromStudent.language).toBe(en.id)

    const chosen = await mk(single.id, { language: en.id })
    expect(typeof chosen.language === 'object' ? chosen.language?.id : chosen.language).toBe(en.id)
  })
})

describe('réservations', () => {
  it('refuse une réservation sur un créneau complet', async () => {
    const slot = await payload.create({
      collection: 'slots',
      data: { start: `${year + 1}-01-10T09:00:00.000Z`, end: `${year + 1}-01-10T10:00:00.000Z`, capacity: 1 },
    })
    expect(slot.label).toBeTruthy()
    await payload.create({ collection: 'bookings', data: { slot: slot.id, student: studentId } })
    await expect(
      payload.create({ collection: 'bookings', data: { slot: slot.id, student: studentId } }),
    ).rejects.toThrow()
  })

  it('refuse un créneau qui finit avant de commencer', async () => {
    await expect(
      payload.create({
        collection: 'slots',
        data: { start: `${year + 1}-01-11T10:00:00.000Z`, end: `${year + 1}-01-11T09:00:00.000Z` },
      }),
    ).rejects.toThrow()
  })
})
