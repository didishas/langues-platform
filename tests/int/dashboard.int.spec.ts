/**
 * Tableau de bord sur une vraie base : on mesure l'écart avant / après l'ajout de données connues,
 * pour ne pas dépendre de ce que les autres fichiers de tests ont déjà créé.
 */
import { getPayload, type Payload, type TypedUser } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { prepareDraftInvoice } from '@/billing/service'
import { loadDashboard } from '@/dashboard/load'
import config from '@/payload.config'

let payload: Payload
let staff: TypedUser
let studentId: number
let hebrewId: number

const DAY = 864e5
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString()

async function snapshot() {
  const r = await loadDashboard(payload, staff, 'fr')
  if (!r) throw new Error('tableau de bord vide')
  return r.dashboard
}

describe('tableau de bord sur Postgres', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await payload.updateGlobal({
      slug: 'billing-settings',
      data: { activeProvider: 'direct', invoicePrefix: 'F', paymentTermDays: 15, onlinePayments: false },
    })
    staff = {
      ...(await payload.create({
        collection: 'users',
        data: { email: 'dash@tableau.test', password: 'mot-de-passe-test', role: 'teacher' } as any,
      })),
      collection: 'users',
    } as TypedUser
    const he =
      (await payload.find({ collection: 'languages', where: { code: { equals: 'he' } }, limit: 1 })).docs[0] ??
      (await payload.create({ collection: 'languages', data: { code: 'he', name: 'Hébreu' } as any }))
    hebrewId = he.id
    const s = await payload.create({
      collection: 'students',
      data: {
        firstName: 'Tableau',
        lastName: 'Test',
        email: 'eleve@tableau.test',
        password: 'mot-de-passe-test',
        languages: [hebrewId],
      } as any,
    })
    studentId = s.id
  })

  it('reflète paiements, retards, factures à valider, prestations par langue, devoirs et demandes', async () => {
    const before = await snapshot()

    // Une prestation d’hébreu réalisée, facturée, validée puis payée maintenant.
    const p1 = await payload.create({
      collection: 'prestations',
      data: { student: studentId, date: iso(-2), description: 'Cours', quantity: 1, unitPrice: 35 } as any,
    })
    expect(typeof p1.language === 'object' ? p1.language?.id : p1.language).toBe(hebrewId)
    const inv1 = await prepareDraftInvoice(payload, { studentId, prestationIds: [p1.id] })
    await payload.update({ collection: 'invoices', id: inv1.id, data: { status: 'validated' } })
    await payload.update({ collection: 'invoices', id: inv1.id, data: { status: 'paid' } })

    // Une facture validée dont l’échéance est dépassée de 5 jours.
    const p2 = await payload.create({
      collection: 'prestations',
      data: { student: studentId, date: iso(-25), description: 'Cours', quantity: 1, unitPrice: 30 } as any,
    })
    const inv2 = await prepareDraftInvoice(payload, { studentId, prestationIds: [p2.id] })
    await payload.update({ collection: 'invoices', id: inv2.id, data: { status: 'validated' } })
    await payload.update({ collection: 'invoices', id: inv2.id, data: { dueDate: iso(-5) } as any, overrideAccess: true })

    // Un brouillon à valider, une prestation non facturée, un devoir rendu, une demande d’essai.
    const p3 = await payload.create({
      collection: 'prestations',
      data: { student: studentId, date: iso(-1), description: 'Cours', quantity: 1, unitPrice: 20 } as any,
    })
    await prepareDraftInvoice(payload, { studentId, prestationIds: [p3.id] })
    await payload.create({
      collection: 'prestations',
      data: { student: studentId, date: iso(-1), description: 'Cours', quantity: 1, unitPrice: 15 } as any,
    })
    const assignment = await payload.create({
      collection: 'assignments',
      data: { title: 'Devoir tableau', kind: 'homework', students: [studentId], published: true },
    })
    await payload.create({ collection: 'submissions', data: { assignment: assignment.id, student: studentId, text: 'x' } as any })
    await payload.create({
      collection: 'trial-requests',
      data: { name: 'Nouvelle demande', email: 'essai@tableau.test', privacyConsent: true, status: 'new' } as any,
    })

    const after = await snapshot()
    expect(after.money.collectedThisMonth - before.money.collectedThisMonth).toBe(3500)
    expect(after.money.overdueCents - before.money.overdueCents).toBe(3000)
    const late = after.money.overdue.find((o) => o.id === inv2.id)
    expect(late?.daysLate).toBe(5)
    expect(after.money.toValidateCount - before.money.toValidateCount).toBe(1)
    expect(after.money.toInvoiceCount - before.money.toInvoiceCount).toBe(2)
    const heCents = (d: typeof before) => d.byLanguage.find((l) => l.code === 'he')?.cents ?? 0
    expect(heCents(after) - heCents(before)).toBe(3500 + 3000 + 2000 + 1500)
    expect(after.todo.submissions.length - before.todo.submissions.length).toBe(1)
    expect(after.todo.trialRequests.length - before.todo.trialRequests.length).toBe(1)
  })

  it('affiche la réserve seulement quand un pourcentage est saisi', async () => {
    expect((await snapshot()).money.taxReserveCents).toBeNull()
    await payload.updateGlobal({ slug: 'billing-settings', data: { taxReservePercent: 25 } })
    const d = await snapshot()
    expect(d.money.taxReserveCents).toBe(Math.round(d.money.collectedThisYear * 0.25))
    await payload.updateGlobal({ slug: 'billing-settings', data: { taxReservePercent: null } as any })
  })

  it('ne renvoie rien à un compte élève', async () => {
    const student = await payload.findByID({ collection: 'students', id: studentId })
    expect(await loadDashboard(payload, { ...student, collection: 'students' } as TypedUser, 'fr')).toBeNull()
  })
})
