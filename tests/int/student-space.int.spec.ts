import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { Student } from '@/payload-types'

let payload: Payload
let alice: Student & { collection: 'students' }
let bob: Student & { collection: 'students' }
let assignmentId: number
let hiddenAssignmentId: number
let slotId: number

const asStudent = (s: Student) => ({ user: { ...s, collection: 'students' as const }, overrideAccess: false })
/** Un PDF minimal mais valide (en-tête, objets, table xref, %%EOF). */
const pdf = (name: string) => {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [] /Count 0 >>']
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
  const data = Buffer.from(body, 'latin1')
  return { data, mimetype: 'application/pdf', name, size: data.length }
}

describe('espace élève : chaque élève ne voit que ce qui le concerne', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const mk = async (firstName: string) =>
      ({
        ...(await payload.create({
          collection: 'students',
          data: { firstName, lastName: 'Test', email: `${firstName.toLowerCase()}@espace.test`, password: 'mot-de-passe-test' } as any,
        })),
        collection: 'students',
      }) as Student & { collection: 'students' }
    alice = await mk('Alice')
    bob = await mk('Bob')

    const doc = await payload.create({
      collection: 'documents',
      data: { title: 'Alphabet hébreu', sharedWith: [alice.id] },
      file: pdf('alphabet.pdf'),
    })
    const assignment = await payload.create({
      collection: 'assignments',
      data: { title: 'Écrire son prénom', kind: 'homework', students: [alice.id], attachments: [doc.id], published: true },
    })
    assignmentId = assignment.id
    const hidden = await payload.create({
      collection: 'assignments',
      data: { title: 'Brouillon de devoir', kind: 'homework', students: [alice.id], published: false },
    })
    hiddenAssignmentId = hidden.id

    const slot = await payload.create({
      collection: 'slots',
      data: {
        start: '2030-03-01T09:00:00.000Z',
        end: '2030-03-01T10:30:00.000Z',
        capacity: 2,
        meetingUrl: 'https://visio.example/salle-secrete',
      },
    })
    slotId = slot.id
  })

  it('montre les documents partagés à leur destinataire seulement', async () => {
    const forAlice = await payload.find({ collection: 'documents', ...asStudent(alice) })
    const forBob = await payload.find({ collection: 'documents', ...asStudent(bob) })
    expect(forAlice.totalDocs).toBe(1)
    expect(forBob.totalDocs).toBe(0)
  })

  it('ne montre que les devoirs publiés et attribués', async () => {
    const forAlice = await payload.find({ collection: 'assignments', ...asStudent(alice) })
    expect(forAlice.docs.map((a) => a.id)).toEqual([assignmentId])
    const forBob = await payload.find({ collection: 'assignments', ...asStudent(bob) })
    expect(forBob.totalDocs).toBe(0)
  })

  it('laisse l’élève rendre son devoir avec un fichier, une seule fois', async () => {
    const file = await payload.create({ collection: 'submission-files', data: {}, file: pdf('copie.pdf'), ...asStudent(alice) })
    expect(file.owner && typeof file.owner === 'object' ? file.owner.id : file.owner).toBe(alice.id)

    const sub = await payload.create({
      collection: 'submissions',
      data: { assignment: assignmentId, text: 'שלום', files: [file.id] },
      ...asStudent(alice),
    })
    expect(sub.status).toBe('submitted')
    expect(sub.submittedAt).toBeTruthy()

    await expect(
      payload.create({ collection: 'submissions', data: { assignment: assignmentId, text: 'encore' }, ...asStudent(alice) }),
    ).rejects.toThrow()
  })

  it('refuse un devoir non attribué ou non publié', async () => {
    await expect(
      payload.create({ collection: 'submissions', data: { assignment: assignmentId, text: 'x' }, ...asStudent(bob) }),
    ).rejects.toThrow()
    await expect(
      payload.create({ collection: 'submissions', data: { assignment: hiddenAssignmentId, text: 'x' }, ...asStudent(alice) }),
    ).rejects.toThrow()
  })

  it('empêche l’élève de joindre le fichier d’un autre ou de se corriger lui-même', async () => {
    const bobAssignment = await payload.create({
      collection: 'assignments',
      data: { title: 'Devoir de Bob', kind: 'homework', students: [bob.id], published: true },
    })
    const alicesFile = await payload.find({ collection: 'submission-files', ...asStudent(alice) })
    await expect(
      payload.create({
        collection: 'submissions',
        data: { assignment: bobAssignment.id, files: [alicesFile.docs[0].id] },
        ...asStudent(bob),
      }),
    ).rejects.toThrow()

    const mine = await payload.find({ collection: 'submissions', ...asStudent(alice) })
    expect(mine.totalDocs).toBe(1)
    // Tant que la remise n'est pas renvoyée « à refaire », l'élève ne peut pas la modifier.
    await expect(
      payload.update({ collection: 'submissions', id: mine.docs[0].id, data: { text: 'modifié' }, ...asStudent(alice) }),
    ).rejects.toThrow()
  })

  it('permet de refaire un devoir renvoyé, sans toucher à la correction', async () => {
    const mine = (await payload.find({ collection: 'submissions', ...asStudent(alice) })).docs[0]
    await payload.update({
      collection: 'submissions',
      id: mine.id,
      data: { status: 'returned', feedback: 'Revoir la lettre ש' },
    })
    const redone = await payload.update({
      collection: 'submissions',
      id: mine.id,
      data: { text: 'שלום, תוקן', feedback: 'Je me mets 20/20' } as any,
      ...asStudent(alice),
    })
    expect(redone.status).toBe('submitted')
    expect(redone.text).toBe('שלום, תוקן')
    expect(redone.feedback).toBe('Revoir la lettre ש')
  })

  it('ne montre ni les fichiers rendus ni les remises des autres élèves', async () => {
    expect((await payload.find({ collection: 'submission-files', ...asStudent(bob) })).totalDocs).toBe(0)
    expect((await payload.find({ collection: 'submissions', ...asStudent(bob) })).totalDocs).toBe(0)
  })

  it('cache le lien de visio aux élèves et au public', async () => {
    const asAlice = await payload.findByID({ collection: 'slots', id: slotId, ...asStudent(alice) })
    expect(asAlice.meetingUrl).toBeUndefined()
    const anonymous = await payload.findByID({ collection: 'slots', id: slotId, overrideAccess: false })
    expect(anonymous.meetingUrl).toBeUndefined()
  })

  it('ne laisse pas un élève lire la fiche ou les notes d’un autre', async () => {
    const others = await payload.find({ collection: 'students', ...asStudent(alice) })
    expect(others.docs.map((s) => s.id)).toEqual([alice.id])
    expect(others.docs[0].notes).toBeUndefined()
  })
})
