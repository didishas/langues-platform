/**
 * Élève de démonstration pour essayer l'espace élève : un devoir, un document, une séance et une facture.
 * À lancer après `pnpm seed`. Ne pas utiliser en production.
 *
 *   pnpm seed:demo
 *   → connexion sur /fr/espace/connexion avec demo.eleve@motamot.test / demo-eleve-2026
 */
import 'dotenv/config'

import config from '@payload-config'
import { getPayload } from 'payload'

import { prepareDraftInvoice } from '@/billing/service'

const EMAIL = 'demo.eleve@motamot.test'
const PASSWORD = 'demo-eleve-2026'

/** PDF minimal valide (une page vide) pour le document de démonstration. */
function tinyPdf(): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>',
  ]
  let body = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((o, i) => {
    offsets.push(body.length)
    body += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = body.length
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  body += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(body, 'latin1')
}

const paragraph = (text: string) => ({
  type: 'paragraph',
  version: 1,
  direction: null,
  format: '',
  indent: 0,
  textFormat: 0,
  children: [{ type: 'text', version: 1, text, format: 0, style: '', mode: 'normal', detail: 0 }],
})

async function demo() {
  if (process.env.NODE_ENV === 'production') throw new Error('Démo interdite en production.')
  const payload = await getPayload({ config: await config })

  const existing = await payload.find({ collection: 'students', where: { email: { equals: EMAIL } }, limit: 1 })
  if (existing.docs[0]) {
    payload.logger.info(`L'élève de démonstration existe déjà : ${EMAIL}`)
    process.exit(0)
  }

  const hebrew = (await payload.find({ collection: 'languages', where: { code: { equals: 'he' } }, limit: 1 })).docs[0]
  const student = await payload.create({
    collection: 'students',
    data: {
      firstName: 'Noa',
      lastName: 'Démo',
      email: EMAIL,
      password: PASSWORD,
      languages: hebrew ? [hebrew.id] : [],
      level: 'A1',
    } as any,
  })

  const data = tinyPdf()
  const doc = await payload.create({
    collection: 'documents',
    data: { title: 'L’alphabet hébreu', language: hebrew?.id, sharedWith: [student.id], note: 'À garder sous la main.' },
    file: { data, mimetype: 'application/pdf', name: 'alphabet-hebreu.pdf', size: data.length },
  })

  const inAWeek = new Date(Date.now() + 7 * 864e5).toISOString()
  await payload.create({
    collection: 'assignments',
    data: {
      title: 'Écrire son prénom en hébreu',
      kind: 'homework',
      language: hebrew?.id,
      dueDate: inAWeek,
      students: [student.id],
      attachments: [doc.id],
      published: true,
      instructions: {
        root: {
          type: 'root',
          version: 1,
          direction: 'rtl',
          format: '',
          indent: 0,
          children: [paragraph('כתבו את השם שלכם באותיות עבריות.'), paragraph('הקליטו את עצמכם קוראים אותו.')],
        },
      } as any,
    },
  })
  await payload.create({
    collection: 'assignments',
    data: { title: 'Les salutations', kind: 'practical', language: hebrew?.id, students: [student.id], published: true },
  })

  const start = new Date(Date.now() + 2 * 864e5)
  start.setUTCHours(16, 0, 0, 0)
  const slot = await payload.create({
    collection: 'slots',
    data: {
      start: start.toISOString(),
      end: new Date(start.getTime() + 90 * 60e3).toISOString(),
      capacity: 1,
      status: 'closed',
      meetingUrl: 'https://meet.example/motamot-demo',
    },
  })
  await payload.create({ collection: 'bookings', data: { slot: slot.id, student: student.id, status: 'confirmed' } })

  const past = await payload.create({
    collection: 'prestations',
    data: {
      student: student.id,
      date: new Date(Date.now() - 7 * 864e5).toISOString(),
      description: 'Cours individuel d’hébreu, 90 min',
      quantity: 1,
      unitPrice: 35,
    } as any,
  })
  const draft = await prepareDraftInvoice(payload, { studentId: student.id, prestationIds: [past.id] })
  await payload.update({ collection: 'invoices', id: draft.id, data: { status: 'validated' } })

  payload.logger.info(`Élève de démonstration créé : ${EMAIL} / ${PASSWORD}`)
  process.exit(0)
}

demo().catch((e) => {
  console.error(e)
  process.exit(1)
})
