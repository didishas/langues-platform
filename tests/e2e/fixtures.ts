import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'

let payloadPromise: Promise<Payload> | null = null
export const payload = () => (payloadPromise ??= getPayload({ config }))

/** Données propres à un lancement de tests, supprimées à la fin. */
export async function createE2EData() {
  const p = await payload()
  const stamp = Date.now()
  const password = `e2e-${stamp}-mot-de-passe`
  const hebrew = (await p.find({ collection: 'languages', where: { code: { equals: 'he' } }, limit: 1 })).docs[0]

  const student = await p.create({
    collection: 'students',
    data: { firstName: 'Ayelet', lastName: 'E2E', email: `e2e-${stamp}@motamot.test`, password } as any,
  })
  const assignment = await p.create({
    collection: 'assignments',
    data: {
      title: `Écrire trois mots en hébreu ${stamp}`,
      kind: 'homework',
      language: hebrew?.id,
      students: [student.id],
      published: true,
    },
  })
  const staff = await p.create({
    collection: 'users',
    data: { email: `e2e-staff-${stamp}@motamot.test`, password, name: 'E2E', role: 'tech' } as any,
  })
  return { student, assignment, staff, password }
}

export async function deleteE2EData(data: Awaited<ReturnType<typeof createE2EData>>) {
  const p = await payload()
  const subs = await p.find({ collection: 'submissions', where: { student: { equals: data.student.id } } })
  for (const s of subs.docs) await p.delete({ collection: 'submissions', id: s.id })
  const files = await p.find({ collection: 'submission-files', where: { owner: { equals: data.student.id } } })
  for (const f of files.docs) await p.delete({ collection: 'submission-files', id: f.id })
  await p.delete({ collection: 'assignments', id: data.assignment.id })
  await p.delete({ collection: 'students', id: data.student.id })
  await p.delete({ collection: 'users', id: data.staff.id })
}

/** PDF minimal valide, pour joindre un fichier à un devoir. */
export function tinyPdf(): Buffer {
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
  return Buffer.from(body, 'latin1')
}
