/** Fuseau horaire de l'élève : modifiable par Catherine seulement, et toujours un fuseau valide. */
import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

let payload: Payload
let student: any
let teacher: any
let tech: any
const as = (user: any) => ({ user, overrideAccess: false as const })

describe('fuseau horaire de l’élève', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const mkUser = async (email: string, role: string) => ({
      ...(await payload.create({ collection: 'users', data: { email, password: 'mot-de-passe-test', role } as any })),
      collection: 'users',
    })
    teacher = await mkUser('prof@fuseau.test', 'teacher')
    tech = await mkUser('tech@fuseau.test', 'tech')
    student = {
      ...(await payload.create({
        collection: 'students',
        data: { firstName: 'Fuseau', lastName: 'Test', email: 'eleve@fuseau.test', password: 'mot-de-passe-test' } as any,
      })),
      collection: 'students',
    }
  })

  it('Catherine le change ; un fuseau inconnu est refusé', async () => {
    const r = await payload.update({ collection: 'students', id: student.id, data: { timeZone: 'Asia/Jerusalem' }, ...as(teacher) })
    expect(r.timeZone).toBe('Asia/Jerusalem')
    await expect(
      payload.update({ collection: 'students', id: student.id, data: { timeZone: 'Mars/Olympus' }, ...as(teacher) }),
    ).rejects.toThrow()
  })

  it('ni l’élève ni le compte technique ne le changent', async () => {
    await payload.update({ collection: 'students', id: student.id, data: { timeZone: 'America/New_York' }, ...as(student) })
    expect((await payload.findByID({ collection: 'students', id: student.id })).timeZone).toBe('Asia/Jerusalem')
    await expect(
      payload.update({ collection: 'students', id: student.id, data: { timeZone: 'Europe/Bucharest' }, ...as(tech) }),
    ).rejects.toThrow()
    expect((await payload.findByID({ collection: 'students', id: student.id })).timeZone).toBe('Asia/Jerusalem')
  })
})
