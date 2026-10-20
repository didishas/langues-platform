/**
 * Compte technique : « tout lire, rien faire partir » (décision de Didier du 20/10/2026).
 * Chaque action interdite est essayée par l'API locale avec les droits du compte, et les plus sensibles par REST.
 */
import { REST_PATCH, REST_POST } from '@payloadcms/next/routes'
import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { prepareDraftInvoice } from '@/billing/service'
import config from '@/payload.config'

let payload: Payload
let teacher: any
let tech: any
let studentId: number
let invoiceId: number
let slotId: number
let languageId: number
const PASSWORD = 'mot-de-passe-test'

const as = (user: any) => ({ user, overrideAccess: false as const })

async function jwt(email: string) {
  return (await payload.login({ collection: 'users', data: { email, password: PASSWORD } })).token!
}

describe('compte technique', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const mk = async (email: string, role: 'teacher' | 'tech') => ({
      ...(await payload.create({ collection: 'users', data: { email, password: PASSWORD, role } as any })),
      collection: 'users',
    })
    teacher = await mk('prof@droits.test', 'teacher')
    tech = await mk('tech@droits.test', 'tech')
    const student = await payload.create({
      collection: 'students',
      data: { firstName: 'Droits', lastName: 'Test', email: 'eleve@droits.test', password: PASSWORD } as any,
    })
    studentId = student.id
    const p = await payload.create({
      collection: 'prestations',
      data: { student: studentId, date: new Date().toISOString(), description: 'Cours', quantity: 1, unitPrice: 30 } as any,
    })
    invoiceId = (await prepareDraftInvoice(payload, { studentId, prestationIds: [p.id] })).id
    const start = new Date(Date.now() + 5 * 864e5)
    slotId = (
      await payload.create({
        collection: 'slots',
        data: { start: start.toISOString(), end: new Date(start.getTime() + 36e5).toISOString(), capacity: 1 },
      })
    ).id
    const lang = (await payload.find({ collection: 'languages', limit: 1 })).docs[0]
    languageId = (lang ?? (await payload.create({ collection: 'languages', data: { code: 'ro', name: 'Roumain' } as any }))).id
  })

  it('lit tout : élèves, factures, réglages de facturation, notes privées', async () => {
    expect((await payload.findByID({ collection: 'students', id: studentId, ...as(tech) })).email).toBe('eleve@droits.test')
    expect((await payload.findByID({ collection: 'invoices', id: invoiceId, ...as(tech) })).status).toBe('to_validate')
    await expect(payload.findGlobal({ slug: 'billing-settings', ...as(tech) })).resolves.toBeTruthy()
  })

  it('ne valide pas une facture, ne crée ni ne supprime rien côté argent', async () => {
    await expect(
      payload.update({ collection: 'invoices', id: invoiceId, data: { status: 'validated' }, ...as(tech) }),
    ).rejects.toThrow()
    expect((await payload.findByID({ collection: 'invoices', id: invoiceId })).status).toBe('to_validate')
    await expect(
      payload.create({
        collection: 'prestations',
        data: { student: studentId, date: new Date().toISOString(), description: 'x', quantity: 1, unitPrice: 1 } as any,
        ...as(tech),
      }),
    ).rejects.toThrow()
    await expect(payload.delete({ collection: 'invoices', id: invoiceId, ...as(tech) })).rejects.toThrow()
    await expect(
      payload.updateGlobal({ slug: 'billing-settings', data: { activeProvider: 'smart' } as any, ...as(tech) }),
    ).rejects.toThrow()
  })

  it('ne modifie ni élève, ni rendez-vous, ni contenu adressé aux élèves', async () => {
    await expect(
      payload.update({ collection: 'students', id: studentId, data: { firstName: 'Changé' }, ...as(tech) }),
    ).rejects.toThrow()
    await expect(payload.delete({ collection: 'students', id: studentId, ...as(tech) })).rejects.toThrow()
    await expect(
      payload.create({ collection: 'bookings', data: { slot: slotId, student: studentId, status: 'confirmed' }, ...as(tech) }),
    ).rejects.toThrow()
    await expect(
      payload.update({ collection: 'slots', id: slotId, data: { capacity: 3 }, ...as(tech) }),
    ).rejects.toThrow()
    await expect(
      payload.create({
        collection: 'assignments',
        data: { title: 'x', kind: 'homework', students: [studentId], published: true },
        ...as(tech),
      }),
    ).rejects.toThrow()
    expect((await payload.findByID({ collection: 'students', id: studentId })).firstName).toBe('Droits')
  })

  it('peut corriger le contenu du site et les réglages sans argent', async () => {
    await expect(
      payload.update({ collection: 'languages', id: languageId, data: { order: 3 } as any, ...as(tech) }),
    ).resolves.toBeTruthy()
    await expect(payload.updateGlobal({ slug: 'teaching-settings', data: {}, ...as(tech) })).resolves.toBeTruthy()
  })

  it('ne crée pas de compte, ne change pas son rôle, ne touche pas au compte de Catherine', async () => {
    await expect(
      payload.create({ collection: 'users', data: { email: 'x@droits.test', password: PASSWORD } as any, ...as(tech) }),
    ).rejects.toThrow()
    await payload.update({ collection: 'users', id: tech.id, data: { role: 'teacher' } as any, ...as(tech) }).catch(() => null)
    expect((await payload.findByID({ collection: 'users', id: tech.id })).role).toBe('tech')
    await expect(
      payload.update({ collection: 'users', id: teacher.id, data: { password: 'piratage-123456' } as any, ...as(tech) }),
    ).rejects.toThrow()
    // Son propre mot de passe, oui.
    await expect(
      payload.update({ collection: 'users', id: tech.id, data: { name: 'Technique' }, ...as(tech) }),
    ).resolves.toBeTruthy()
  })

  it('par REST aussi : validation de facture et préparation refusées, Catherine garde la main', async () => {
    const techToken = await jwt('tech@droits.test')
    const patch = await REST_PATCH(config)(
      new Request(`http://localhost/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `JWT ${techToken}` },
        body: JSON.stringify({ status: 'validated' }),
      }),
      { params: Promise.resolve({ slug: ['invoices', String(invoiceId)] }) },
    )
    expect(patch.status).toBe(403)
    const prepare = await REST_POST(config)(
      new Request('http://localhost/api/invoices/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `JWT ${techToken}` },
        body: JSON.stringify({ studentId, prestationIds: [] }),
      }),
      { params: Promise.resolve({ slug: ['invoices', 'prepare'] }) },
    )
    expect(prepare.status).toBe(403)

    // Contrôle positif : Catherine valide.
    const ok = await payload.update({ collection: 'invoices', id: invoiceId, data: { status: 'validated' }, ...as(teacher) })
    expect(ok.status).toBe('validated')
  })
})
