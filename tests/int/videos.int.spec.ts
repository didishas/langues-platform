/**
 * Vidéothèque sur une vraie base : qui voit quelle vidéo (et son fichier), et correction côté serveur.
 */
import fs from 'fs'
import path from 'path'

import { REST_GET, REST_POST } from '@payloadcms/next/routes'
import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadDashboard } from '@/dashboard/load'
import { latestAttempts, listVideosForStudent, loadVideoForStudent, submitAttempt } from '@/exercises/service'
import config from '@/payload.config'
import type { Student, Video } from '@/payload-types'

type S = Student & { collection: 'students' }
let payload: Payload
let alice: S // apprend l'hébreu
let bob: S // apprend l'espagnol
let carol: S // choisie nommément
let hebrewId: number
const videos: Record<string, Video> = {}
const PASSWORD = 'mot-de-passe-test'

const videoFile = (name: string) => {
  const data = fs.readFileSync(path.resolve('src/seed/assets/demo-video.mp4'))
  return { data, mimetype: 'video/mp4', name, size: data.length }
}
const as = (s: S) => ({ user: s, overrideAccess: false as const })

async function languageId(code: string, name: string) {
  const found = (await payload.find({ collection: 'languages', where: { code: { equals: code } }, limit: 1 })).docs[0]
  return (found ?? (await payload.create({ collection: 'languages', data: { code, name } as any }))).id
}

async function token(s: S) {
  const r = await payload.login({ collection: 'students', data: { email: s.email, password: PASSWORD } })
  return r.token!
}

async function getFile(video: Video, jwt?: string) {
  const res = await REST_GET(config)(
    new Request(`http://localhost/api/videos/file/${video.filename}`, { headers: jwt ? { Authorization: `JWT ${jwt}` } : {} }),
    { params: Promise.resolve({ slug: ['videos', 'file', video.filename!] }) },
  )
  return res.status
}

describe('vidéothèque : accès', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    hebrewId = await languageId('he', 'Hébreu')
    const spanishId = await languageId('es', 'Espagnol')
    const mk = async (firstName: string, languages: number[]) =>
      ({
        ...(await payload.create({
          collection: 'students',
          data: { firstName, lastName: 'Vidéo', email: `${firstName.toLowerCase()}@video.test`, password: PASSWORD, languages } as any,
        })),
        collection: 'students',
      }) as S
    alice = await mk('Alice', [hebrewId])
    bob = await mk('Bob', [spanishId])
    carol = await mk('Carol', [])

    const mkVideo = async (key: string, data: Record<string, unknown>) => {
      videos[key] = await payload.create({
        collection: 'videos',
        data: { title: `Vidéo ${key}`, language: hebrewId, published: true, ...data } as any,
        file: videoFile(`${key}.mp4`),
      })
    }
    await mkVideo('hebreu', { visibility: 'language' })
    await mkVideo('tous', { visibility: 'all' })
    await mkVideo('carol', { visibility: 'selected', students: [carol.id] })
    await mkVideo('brouillon', { visibility: 'all', published: false })
    await mkVideo('exercices', {
      visibility: 'language',
      showSolutions: true,
      exercises: [
        { blockType: 'mcq', question: 'Bonjour ?', options: [{ text: 'שלום', correct: true }, { text: 'תודה' }], explanation: 'Secret' },
        { blockType: 'gap', text: 'אני [תלמיד|תלמידה] חדש' },
        {
          blockType: 'matching',
          pairs: [
            { item: 'אחת', match: 'un' },
            { item: 'שתיים', match: 'deux' },
          ],
        },
        { blockType: 'audio', prompt: 'הציגו את עצמכם', maxSeconds: 30 },
      ],
    })
  })

  it('chaque élève voit seulement les vidéos qui lui sont destinées', async () => {
    const titles = async (s: S) => (await listVideosForStudent(payload, s)).map((v) => v.title).filter((t) => t.startsWith('Vidéo '))
    expect((await titles(alice)).sort()).toEqual(['Vidéo exercices', 'Vidéo hebreu', 'Vidéo tous'])
    expect(await titles(bob)).toEqual(['Vidéo tous'])
    expect((await titles(carol)).sort()).toEqual(['Vidéo carol', 'Vidéo tous'])
  })

  it('refuse une vidéo non destinée ou en brouillon, même par son numéro', async () => {
    expect(await loadVideoForStudent(payload, bob, videos.hebreu.id)).toBeNull()
    expect(await loadVideoForStudent(payload, alice, videos.carol.id)).toBeNull()
    expect(await loadVideoForStudent(payload, alice, videos.brouillon.id)).toBeNull()
    await expect(payload.findByID({ collection: 'videos', id: videos.hebreu.id, ...as(bob) })).rejects.toThrow()
  })

  it('le fichier vidéo n’est servi qu’aux élèves autorisés', async () => {
    expect(await getFile(videos.hebreu, await token(alice))).toBe(200)
    expect(await getFile(videos.hebreu, await token(bob))).toBe(403)
    expect(await getFile(videos.hebreu)).toBe(403)
    expect(await getFile(videos.brouillon, await token(alice))).toBe(403)
  })

  it('l’API ne livre jamais les solutions ni la liste des élèves choisis', async () => {
    const raw = JSON.stringify(await payload.findByID({ collection: 'videos', id: videos.exercices.id, ...as(alice) }))
    expect(raw).not.toContain('"correct"')
    expect(raw).not.toContain('Secret')
    expect(raw).not.toContain('תלמידה')
    expect(raw).not.toContain('שתיים')
    const carolsVideo = await payload.findByID({ collection: 'videos', id: videos.carol.id, ...as(carol) })
    expect(carolsVideo).not.toHaveProperty('students')

    const loaded = await loadVideoForStudent(payload, alice, videos.exercices.id)
    expect(loaded!.exercises.map((e) => e.kind)).toEqual(['mcq', 'gap', 'matching', 'audio'])
    const page = JSON.stringify({ video: loaded!.video, exercises: loaded!.exercises })
    expect(page).not.toContain('Secret')
    expect(page).not.toContain('תלמידה')
  })

  it('un élève ne peut pas créer une réponse ni fixer sa note via l’API', async () => {
    await expect(
      payload.create({
        collection: 'exercise-attempts',
        data: { student: alice.id, video: videos.exercices.id, exerciseId: 'x', kind: 'mcq', score: 99, maxScore: 1 } as any,
        ...as(alice),
      }),
    ).rejects.toThrow()
    const res = await REST_POST(config)(
      new Request('http://localhost/api/exercise-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `JWT ${await token(alice)}` },
        body: JSON.stringify({ student: alice.id, video: videos.exercices.id, exerciseId: 'x', kind: 'mcq', score: 99 }),
      }),
      { params: Promise.resolve({ slug: ['exercise-attempts'] }) },
    )
    expect(res.status).toBe(403)
  })
})

describe('vidéothèque : correction côté serveur', () => {
  it('corrige QCM, trous et paires, et enregistre la réponse', async () => {
    const loaded = (await loadVideoForStudent(payload, alice, videos.exercices.id))!
    const [mcq, gap, matching] = loaded.exercises

    const r1 = await submitAttempt(payload, alice, { videoId: videos.exercices.id, exerciseId: mcq.id, answers: ['0'] })
    expect(r1.result).toMatchObject({ score: 1, max: 1, solution: ['שלום'], explanation: 'Secret' })

    const r2 = await submitAttempt(payload, alice, { videoId: videos.exercices.id, exerciseId: gap.id, answers: ['תַּלְמִידָה'] })
    expect(r2.result).toMatchObject({ score: 1, max: 1 })

    const r3 = await submitAttempt(payload, alice, { videoId: videos.exercices.id, exerciseId: matching.id, answers: ['deux', 'un'] })
    expect(r3.result).toMatchObject({ score: 0, max: 2 })

    const latest = await latestAttempts(payload, alice, videos.exercices.id)
    expect(latest[mcq.id]).toMatchObject({ score: 1, maxScore: 1, status: 'graded' })
    expect(latest[matching.id]).toMatchObject({ score: 0, maxScore: 2 })
    // Bob ne voit pas les réponses d'Alice.
    expect(await latestAttempts(payload, bob, videos.exercices.id)).toEqual({})
  })

  it('refuse une réponse à une vidéo non autorisée ou à un exercice inconnu', async () => {
    const loaded = (await loadVideoForStudent(payload, alice, videos.exercices.id))!
    await expect(
      submitAttempt(payload, bob, { videoId: videos.exercices.id, exerciseId: loaded.exercises[0].id, answers: ['0'] }),
    ).rejects.toThrow('not_found')
    await expect(submitAttempt(payload, alice, { videoId: videos.exercices.id, exerciseId: 'inconnu', answers: [] })).rejects.toThrow(
      'not_found',
    )
  })

  it('réponse orale : enregistrée « à écouter », fichier privé à l’élève', async () => {
    const loaded = (await loadVideoForStudent(payload, alice, videos.exercices.id))!
    const audio = loaded.exercises[3]
    await expect(submitAttempt(payload, alice, { videoId: videos.exercices.id, exerciseId: audio.id, answers: [] })).rejects.toThrow(
      'audio_missing',
    )
    const staff = await payload.create({
      collection: 'users',
      data: { email: 'videos@staff.test', password: PASSWORD, role: 'teacher' } as any,
    })
    const oralToReview = async () =>
      (await loadDashboard(payload, { ...staff, collection: 'users' } as any, 'fr'))!.dashboard.todo.oralToReview
    const before = await oralToReview()
    const data = fs.readFileSync(path.resolve('tests/fixtures/answer.webm'))
    const r = await submitAttempt(payload, alice, {
      videoId: videos.exercices.id,
      exerciseId: audio.id,
      answers: [],
      audio: { data, mimetype: 'audio/webm', name: 'reponse.webm', size: data.length },
    })
    expect(r.status).toBe('to_review')
    expect((await oralToReview()) - before).toBe(1)
    const attempt = (
      await payload.find({ collection: 'exercise-attempts', where: { exerciseId: { equals: audio.id } }, depth: 1 })
    ).docs[0]
    expect(attempt.status).toBe('to_review')
    const file = attempt.audio as { id: number; owner: unknown }
    expect(typeof file === 'object' && (typeof file.owner === 'object' ? (file.owner as any).id : file.owner)).toBe(alice.id)
    await expect(payload.findByID({ collection: 'submission-files', id: file.id, ...as(bob) })).rejects.toThrow()
  })
})
