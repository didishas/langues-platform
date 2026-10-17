/**
 * Élève de démonstration pour essayer l'espace élève : un devoir, un document, une séance et une facture.
 * À lancer après `pnpm seed`. Ne pas utiliser en production.
 *
 *   pnpm seed:demo
 *   → connexion sur /fr/espace/connexion avec demo.eleve@motamot.test / demo-eleve-2026
 */
import 'dotenv/config'

import fs from 'fs'
import path from 'path'

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
    await demoVideos(payload)
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
      visioTool: 'meet',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
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

  await demoHistory(payload)
  await demoVideos(payload)

  payload.logger.info(`Élève de démonstration créé : ${EMAIL} / ${PASSWORD}`)
  process.exit(0)
}

/**
 * Historique FICTIF de quelques mois pour voir le tableau de bord en local :
 * trois élèves « Démo », des cours passés, des factures payées à des dates passées et une en retard.
 * Ces chiffres ne correspondent à aucune activité réelle.
 */
async function demoHistory(payload: Awaited<ReturnType<typeof getPayload>>) {
  const DAY = 864e5
  const langs = await payload.find({ collection: 'languages', limit: 10, depth: 0 })
  const lang = (code: string) => langs.docs.find((l) => l.code === code)?.id
  const people = [
    { firstName: 'Ana', code: 'es', price: 30 },
    { firstName: 'Tom', code: 'en', price: 30 },
    { firstName: 'Ilan', code: 'he', price: 35 },
  ]
  for (const [i, person] of people.entries()) {
    const student = await payload.create({
      collection: 'students',
      data: {
        firstName: person.firstName,
        lastName: 'Démo',
        email: `demo.${person.firstName.toLowerCase()}@motamot.test`,
        password: PASSWORD,
        languages: lang(person.code) ? [lang(person.code)] : [],
      } as any,
    })
    // Un cours toutes les deux semaines pendant ~5 mois (Ilan arrête il y a 6 semaines : « à relancer »).
    const stopAfter = person.firstName === 'Ilan' ? 42 : 0
    for (let daysAgo = 150 - i * 3; daysAgo > stopAfter; daysAgo -= 14) {
      const start = new Date(Date.now() - daysAgo * DAY)
      start.setUTCHours(15, 0, 0, 0)
      const slot = await payload.create({
        collection: 'slots',
        data: { start: start.toISOString(), end: new Date(start.getTime() + 90 * 60e3).toISOString(), capacity: 1, status: 'closed' },
      })
      await payload.create({ collection: 'bookings', data: { slot: slot.id, student: student.id, status: 'confirmed' } })
      const prestation = await payload.create({
        collection: 'prestations',
        data: { student: student.id, date: start.toISOString(), description: 'Cours individuel, 90 min (démo)', quantity: 1, unitPrice: person.price } as any,
      })
      const draft = await prepareDraftInvoice(payload, { studentId: student.id, prestationIds: [prestation.id] })
      await payload.update({ collection: 'invoices', id: draft.id, data: { status: 'validated' } })
      if (daysAgo > 20) {
        await payload.update({ collection: 'invoices', id: draft.id, data: { status: 'paid' } })
        await payload.update({
          collection: 'invoices',
          id: draft.id,
          data: { paidAt: new Date(start.getTime() + 6 * DAY).toISOString() } as any,
        })
      } else if (person.firstName === 'Tom') {
        // Facture laissée impayée, échéance dépassée.
        await payload.update({ collection: 'invoices', id: draft.id, data: { dueDate: new Date(Date.now() - 4 * DAY).toISOString() } as any })
      }
    }
  }
  // Un créneau de groupe à venir, partiellement rempli.
  const group = new Date(Date.now() + 9 * DAY)
  group.setUTCHours(17, 0, 0, 0)
  await payload.create({
    collection: 'slots',
    data: { start: group.toISOString(), end: new Date(group.getTime() + 90 * 60e3).toISOString(), capacity: 4, format: 'group' },
  })
}

/** Deux vidéos de démonstration (une image unie et un son, sans personne filmée), dont une avec ses exercices. */
async function demoVideos(payload: Awaited<ReturnType<typeof getPayload>>) {
  const TITLE = 'Se présenter en hébreu (démo)'
  const already = await payload.count({ collection: 'videos', where: { title: { equals: TITLE } } })
  if (already.totalDocs > 0) return
  const hebrew = (await payload.find({ collection: 'languages', where: { code: { equals: 'he' } }, limit: 1 })).docs[0]
  if (!hebrew) return
  const data = fs.readFileSync(path.resolve(process.cwd(), 'src/seed/assets/demo-video.mp4'))
  const file = (name: string) => ({ data, mimetype: 'video/mp4', name, size: data.length })

  await payload.create({
    collection: 'videos',
    data: {
      title: TITLE,
      language: hebrew.id,
      level: 'A1',
      visibility: 'language',
      published: true,
      showSolutions: true,
      description: {
        root: {
          type: 'root',
          version: 1,
          direction: 'rtl',
          format: '',
          indent: 0,
          children: [paragraph('בשיעור הזה לומדים להגיד שלום, להציג את עצמנו ולספור עד שלוש.')],
        },
      } as any,
      exercises: [
        {
          blockType: 'mcq',
          question: 'Comment dit-on « merci » en hébreu ?',
          options: [{ text: 'תודה', correct: true }, { text: 'שלום' }, { text: 'בבקשה' }],
          explanation: 'תודה (toda) veut dire merci ; בבקשה (bevakasha), s’il vous plaît.',
        },
        {
          blockType: 'gap',
          instructions: 'Complétez la présentation de Noa.',
          text: 'שלום, [אני] נועה. אני [גרה|גר] בבריסל.',
          explanation: 'אני = je. Au féminin on dit גרה, au masculin גר.',
        },
        {
          blockType: 'matching',
          instructions: 'Associez chaque nombre à sa traduction.',
          pairs: [
            { item: 'אחת', match: 'un' },
            { item: 'שתיים', match: 'deux' },
            { item: 'שלוש', match: 'trois' },
          ],
        },
        { blockType: 'audio', prompt: 'Présentez-vous en hébreu : votre prénom et la ville où vous habitez.', maxSeconds: 45 },
      ],
    } as any,
    file: file('se-presenter-demo.mp4'),
  })
  await payload.create({
    collection: 'videos',
    data: { title: 'Les lettres finales (démo)', language: hebrew.id, level: 'A1', visibility: 'language', published: true } as any,
    file: file('lettres-finales-demo.mp4'),
  })
}

demo().catch((e) => {
  console.error(e)
  process.exit(1)
})
