/**
 * RGPD : export et effacement des données d'un élève, sur une vraie base.
 * Cible : Eve. Témoin : Frank, dont rien ne doit changer.
 */
import fs from 'fs'
import path from 'path'

import { REST_GET, REST_POST } from '@payloadcms/next/routes'
import { strFromU8, unzipSync } from 'fflate'
import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { prepareDraftInvoice } from '@/billing/service'
import { tinyPdf } from '../e2e/fixtures'
import config from '@/payload.config'

let payload: Payload
const PASSWORD = 'mot-de-passe-test'
let eve: any
let frank: any
const ids: Record<string, number> = {}
let eveFilePath = ''
let eveJwt = ''

const asUser = (u: any) => ({ user: u, overrideAccess: false as const })

async function token(collection: 'users' | 'students', email: string) {
  return (await payload.login({ collection, data: { email, password: PASSWORD } })).token!
}

async function exportAs(jwt?: string) {
  return REST_GET(config)(
    new Request(`http://localhost/api/students/${eve.id}/privacy-export`, { headers: jwt ? { Authorization: `JWT ${jwt}` } : {} }),
    { params: Promise.resolve({ slug: ['students', String(eve.id), 'privacy-export'] }) },
  )
}

async function eraseAs(jwt: string, confirmEmail: string) {
  const res = await REST_POST(config)(
    new Request(`http://localhost/api/students/${eve.id}/privacy-erase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `JWT ${jwt}` },
      body: JSON.stringify({ confirmEmail }),
    }),
    { params: Promise.resolve({ slug: ['students', String(eve.id), 'privacy-erase'] }) },
  )
  return { status: res.status, body: (await res.json()) as any }
}

/** PDF minimal mais valide (table xref comprise) : Payload refuse un PDF incomplet. */
const pdf = () => tinyPdf()

describe('RGPD : export et effacement d’un élève', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await payload.updateGlobal({ slug: 'billing-settings', data: { activeProvider: 'direct', invoicePrefix: 'F', onlinePayments: false } as any })
    await payload.create({ collection: 'users', data: { email: 'prof@rgpd.test', password: PASSWORD, role: 'teacher' } as any })
    await payload.create({ collection: 'users', data: { email: 'tech@rgpd.test', password: PASSWORD, role: 'tech' } as any })
    const mk = async (firstName: string) => ({
      ...(await payload.create({
        collection: 'students',
        data: {
          firstName,
          lastName: 'Rgpd',
          email: `${firstName.toLowerCase()}@rgpd.test`,
          password: PASSWORD,
          phone: '+32 470 00 00 00',
          notes: `Note privée sur ${firstName}`,
          billingAddress: `Rue de ${firstName} 1, 1000 Bruxelles`,
          timeZone: 'Asia/Jerusalem',
        } as any,
      })),
      collection: 'students',
    })
    eve = await mk('Eve')
    frank = await mk('Frank')

    const shared = await payload.create({
      collection: 'assignments',
      data: { title: 'Devoir commun', kind: 'homework', students: [eve.id, frank.id], published: true },
    })
    const onlyEve = await payload.create({
      collection: 'assignments',
      data: { title: 'Devoir d’Eve', kind: 'homework', students: [eve.id], published: true },
    })
    ids.shared = shared.id
    ids.onlyEve = onlyEve.id

    const data = pdf()
    const file = await payload.create({
      collection: 'submission-files',
      data: {},
      file: { data, mimetype: 'application/pdf', name: 'copie-eve.pdf', size: data.length },
      ...asUser(eve),
    })
    ids.eveFile = file.id
    eveFilePath = path.join(payload.collections['submission-files'].config.upload!.staticDir as string, file.filename!)
    await payload.create({ collection: 'submissions', data: { assignment: shared.id, text: 'Réponse d’Eve', files: [file.id] } as any, ...asUser(eve) })
    ids.frankSubmission = (
      await payload.create({ collection: 'submissions', data: { assignment: shared.id, text: 'Réponse de Frank' } as any, ...asUser(frank) })
    ).id

    const docOnlyEve = await payload.create({
      collection: 'documents',
      data: { title: 'Copie corrigée d’Eve', sharedWith: [eve.id] },
      file: { data, mimetype: 'application/pdf', name: 'corrige-eve.pdf', size: data.length },
    })
    const docShared = await payload.create({
      collection: 'documents',
      data: { title: 'Alphabet', sharedWith: [eve.id, frank.id] },
      file: { data, mimetype: 'application/pdf', name: 'alphabet-rgpd.pdf', size: data.length },
    })
    ids.docOnlyEve = docOnlyEve.id
    ids.docShared = docShared.id

    const lang = (await payload.find({ collection: 'languages', limit: 1 })).docs[0] ?? (await payload.create({ collection: 'languages', data: { code: 'he', name: 'Hébreu' } as any }))
    const video = fs.readFileSync(path.resolve('src/seed/assets/demo-video.mp4'))
    ids.video = (
      await payload.create({
        collection: 'videos',
        data: { title: 'Vidéo RGPD', language: lang.id, visibility: 'selected', students: [eve.id, frank.id], published: true } as any,
        file: { data: video, mimetype: 'video/mp4', name: 'rgpd.mp4', size: video.length },
      })
    ).id

    const slot = async (days: number) => {
      const start = new Date(Date.now() + days * 864e5)
      return payload.create({ collection: 'slots', data: { start: start.toISOString(), end: new Date(start.getTime() + 36e5).toISOString(), capacity: 2 } })
    }
    const past = await slot(-10)
    const future = await slot(10)
    ids.pastBooking = (await payload.create({ collection: 'bookings', data: { slot: past.id, student: eve.id, status: 'confirmed' } })).id
    ids.futureBooking = (await payload.create({ collection: 'bookings', data: { slot: future.id, student: eve.id, status: 'confirmed' } })).id

    const p = await payload.create({
      collection: 'prestations',
      data: { student: eve.id, date: new Date(Date.now() - 10 * 864e5).toISOString(), description: 'Cours d’Eve', quantity: 1, unitPrice: 30 } as any,
    })
    const inv = await prepareDraftInvoice(payload, { studentId: eve.id, prestationIds: [p.id] })
    await payload.update({ collection: 'invoices', id: inv.id, data: { status: 'validated' } })
    await payload.update({ collection: 'invoices', id: inv.id, data: { status: 'paid' } })
    ids.invoice = inv.id

    ids.trial = (
      await payload.create({ collection: 'trial-requests', data: { name: 'Eve', email: 'eve@rgpd.test', privacyConsent: true, status: 'new' } as any })
    ).id
  })

  it('export : refusé au compte technique, à l’élève et aux visiteurs', async () => {
    expect((await exportAs(await token('users', 'tech@rgpd.test'))).status).toBe(403)
    eveJwt = await token('students', 'eve@rgpd.test')
    expect((await exportAs(eveJwt)).status).toBe(403)
    expect((await exportAs()).status).toBe(403)
  })

  it('export : toutes les données d’Eve et ses fichiers, rien de Frank, aucun secret de compte', async () => {
    const res = await exportAs(await token('users', 'prof@rgpd.test'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/zip')
    const files = unzipSync(new Uint8Array(await res.arrayBuffer()))
    const json = strFromU8(files['donnees.json'])
    const data = JSON.parse(json)
    expect(data.student.email).toBe('eve@rgpd.test')
    expect(data.submissions).toHaveLength(1)
    expect(data.invoices).toHaveLength(1)
    expect(data.sessions).toHaveLength(2)
    expect(data.trialRequests).toHaveLength(1)
    expect(json).not.toContain('frank@rgpd.test')
    expect(json).not.toContain('Réponse de Frank')
    for (const secret of ['"hash"', '"salt"', '"sessions":[{', 'resetPasswordToken']) expect(json).not.toContain(secret)
    expect(Object.keys(files).some((k) => k.startsWith('fichiers/copie-eve'))).toBe(true)
  })

  it('effacement : refusé au compte technique, ou si l’e-mail retapé ne correspond pas', async () => {
    expect((await eraseAs(await token('users', 'tech@rgpd.test'), 'eve@rgpd.test')).status).toBe(403)
    const wrong = await eraseAs(await token('users', 'prof@rgpd.test'), 'frank@rgpd.test')
    expect(wrong.status).toBe(400)
    expect((await payload.findByID({ collection: 'students', id: eve.id })).firstName).toBe('Eve')
  })

  it('effacement : refusé tant qu’il reste une prestation non facturée, sans rien toucher', async () => {
    const open = await payload.create({
      collection: 'prestations',
      data: { student: eve.id, date: new Date().toISOString(), description: 'Cours pas encore facturé', quantity: 1, unitPrice: 30 } as any,
    })
    const r = await eraseAs(await token('users', 'prof@rgpd.test'), 'eve@rgpd.test')
    expect(r.status).toBe(409)
    expect(r.body.details.join(' ')).toContain('Cours pas encore facturé')
    expect((await payload.findByID({ collection: 'students', id: eve.id })).firstName).toBe('Eve')
    expect(fs.existsSync(eveFilePath)).toBe(true)
    await payload.delete({ collection: 'prestations', id: open.id })
  })

  it('effacement : plus rien de personnel hors factures, Frank intact', async () => {
    const r = await eraseAs(await token('users', 'prof@rgpd.test'), ' EVE@rgpd.test ')
    expect(r.status).toBe(200)
    expect(r.body.summary).toMatchObject({ submissions: 1, files: 1, futureBookings: 1, assignmentsDeleted: 1, documentsDeleted: 1, trialRequests: 1, messages: 2, invoicesKept: 1 })

    const after = await payload.findByID({ collection: 'students', id: eve.id })
    expect(after.fullName).toBe(`Ancien élève n°${eve.id}`)
    expect(after.email).toBe(`ancien-eleve-${eve.id}@supprime.invalid`)
    for (const field of ['phone', 'notes', 'billingAddress', 'timeZone'] as const) expect(after[field] ?? null).toBeNull()
    expect(after.erasedAt).toBeTruthy()
    await expect(payload.login({ collection: 'students', data: { email: 'eve@rgpd.test', password: PASSWORD } })).rejects.toThrow()
    await expect(
      payload.login({ collection: 'students', data: { email: after.email, password: PASSWORD } }),
    ).rejects.toThrow()

    // La session ouverte avant l'effacement ne fonctionne plus.
    const me = await REST_GET(config)(
      new Request('http://localhost/api/students/me', { headers: { Authorization: `JWT ${eveJwt}` } }),
      { params: Promise.resolve({ slug: ['students', 'me'] }) },
    )
    expect(((await me.json()) as { user: unknown }).user).toBeNull()

    expect(fs.existsSync(eveFilePath)).toBe(false)
    expect((await payload.find({ collection: 'submissions', where: { student: { equals: eve.id } } })).totalDocs).toBe(0)
    await expect(payload.findByID({ collection: 'assignments', id: ids.onlyEve })).rejects.toThrow()
    await expect(payload.findByID({ collection: 'documents', id: ids.docOnlyEve })).rejects.toThrow()
    await expect(payload.findByID({ collection: 'bookings', id: ids.futureBooking })).rejects.toThrow()
    await expect(payload.findByID({ collection: 'trial-requests', id: ids.trial })).rejects.toThrow()
    expect((await payload.find({ collection: 'outbox', where: { student: { equals: eve.id } } })).totalDocs).toBe(0)
    const pastBooking = await payload.findByID({ collection: 'bookings', id: ids.pastBooking, depth: 0 })
    expect(pastBooking.student).toBe(eve.id)

    const invoice = await payload.findByID({ collection: 'invoices', id: ids.invoice, depth: 0 })
    expect(invoice.status).toBe('paid')
    expect(invoice.number).toBeTruthy()
    expect(invoice.customer?.name).toContain('Eve')

    const ids2 = (v: any[] | null | undefined) => (v ?? []).map((x) => (typeof x === 'object' ? x.id : x))
    expect(ids2((await payload.findByID({ collection: 'assignments', id: ids.shared, depth: 0 })).students)).toEqual([frank.id])
    expect(ids2((await payload.findByID({ collection: 'documents', id: ids.docShared, depth: 0 })).sharedWith)).toEqual([frank.id])
    expect(ids2((await payload.findByID({ collection: 'videos', id: ids.video, depth: 0 })).students)).toEqual([frank.id])
    expect((await payload.findByID({ collection: 'submissions', id: ids.frankSubmission })).text).toBe('Réponse de Frank')
    const f = await payload.findByID({ collection: 'students', id: frank.id })
    expect([f.email, f.notes]).toEqual(['frank@rgpd.test', 'Note privée sur Frank'])
  })

  it('effacement : une seconde fois, refusé proprement', async () => {
    const r = await eraseAs(await token('users', 'prof@rgpd.test'), `ancien-eleve-${eve.id}@supprime.invalid`)
    expect(r.status).toBe(409)
  })
})
